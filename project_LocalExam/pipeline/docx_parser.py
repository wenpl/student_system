"""
DOCX 解析与题目切割 + OMML→LaTeX 公式转换

功能：
1. 遍历 DOCX 段落，按正则切分题目
2. 将 OMML 公式转换为 LaTeX
3. 重建段落文本，将 <m:oMath> 替换为 $LaTeX$

用法：
    from pipeline.docx_parser import parse_docx
    questions = parse_docx("path/to/file.docx")
"""

import os
import re
import zipfile
from lxml import etree
from docx import Document

# ========== 正则锚点 ==========

# 大题标题：一、选择题 / 二、填空题 / 三、解答题
RE_BIG_TITLE = re.compile(r'^[一二三]、\s*')

# 题号：1. / 1． 开头，后接空格
RE_NUMBER = re.compile(r'^(\d+)[．\.]\s*')

# 跳过标记：答案/解析/分析/详解/点睛
RE_SKIP = re.compile(r'^【(答案|解析|分析|详解|点睛)】')

# 子问：(1) / （1）
RE_SUB_QUESTION = re.compile(r'^[\(（](\d+)[\)）]')

# OMML 命名空间
MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
MAIN_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def _detect_type(text):
    """从大题标题中检测题型"""
    if "选择题" in text:
        return "选择题"
    elif "填空题" in text:
        return "填空题"
    elif "解答题" in text:
        return "解答题"
    return None


def _strip_tag(elem):
    """提取元素标签名（去除命名空间前缀）"""
    tag = elem.tag
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag


def omml_to_latex(elem):
    """递归转换 OMML 元素为 LaTeX 字符串

    支持的元素：
        - m:t           → 文本
        - m:f           → 分数 \\frac{num}{den}
        - m:sSup        → 上标 ^{sup}
        - m:sSub        → 下标 _{sub}
        - m:rad         → 根式 \\sqrt{...} / \\sqrt[deg]{...}
        - m:d           → 分隔符（提取内部内容）
        - m:r           → OMML run（提取其下的 m:t）
        - 容器元素       → 递归拼接子节点
    """
    tag = _strip_tag(elem)

    if tag == 't':
        return elem.text or ''

    if tag == 'f':
        # 分数 \frac{num}{den}
        num = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}num'))
        den = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}den'))
        return f'\\frac{{{num}}}{{{den}}}'

    if tag == 'sSup':
        # 上标 ^{sup}
        base = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}e'))
        sup = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}sup'))
        return f'{{{base}^{{{sup}}}}}'

    if tag == 'sSub':
        # 下标 _{sub}
        base = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}e'))
        sub = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}sub'))
        return f'{{{base}_{{{sub}}}}}'

    if tag == 'rad':
        # 根式 \sqrt{...} 或 \sqrt[deg]{...}
        radicand = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}e'))
        deg_elems = [c for c in elem if c.tag.endswith('}deg')]
        if deg_elems:
            deg = ''.join(omml_to_latex(c) for c in deg_elems[0])
            return f'\\sqrt[{deg}]{{{radicand}}}'
        return f'\\sqrt{{{radicand}}}'

    if tag == 'd':
        # 分隔符（括号等）——提取内部表达式，并用 begChr/endChr 包裹
        inner = ''.join(omml_to_latex(c) for c in elem if c.tag.endswith('}e'))
        # 从 dPr 中读取 begChr 和 endChr
        beg_chr = '('
        end_chr = ')'
        for child in elem:
            if _strip_tag(child) == 'dPr':
                beg = child.find(f'{{{MATH_NS}}}begChr')
                if beg is not None:
                    beg_chr = beg.get(f'{{{MATH_NS}}}val', '(')
                end = child.find(f'{{{MATH_NS}}}endChr')
                if end is not None:
                    end_chr = end.get(f'{{{MATH_NS}}}val', ')')
                break
        # LaTeX 特殊字符转义（如 { → \{）
        _CHR_MAP = {'{': '\\{', '}': '\\}'}
        beg_chr = _CHR_MAP.get(beg_chr, beg_chr)
        end_chr = _CHR_MAP.get(end_chr, end_chr)
        return f'\\left{beg_chr}{inner}\\right{end_chr}'

    if tag == 'r':
        # OMML 运行（run），其下包含 m:t
        for child in elem:
            if _strip_tag(child) == 't':
                return child.text or ''
        return ''

    # 容器元素：递归处理所有子节点
    if tag in ('oMath', 'e', 'num', 'den', 'sup', 'sub', 'deg', 'oMathPara', 'dPr'):
        return ''.join(omml_to_latex(c) for c in elem)

    # 未知元素：递归处理，至少保留文本内容
    return ''.join(omml_to_latex(c) for c in elem)


def reconstruct_paragraph_text(para):
    """重建段落文本：把 <m:oMath> 公式替换为 $LaTeX$

    遍历段落的 XML 子元素，遇到：
        - w:r       → 提取 w:t 中的纯文本
        - w:tab     → 制表符
        - w:br      → 换行符
        - m:oMath   → 转换为 $LaTeX$
        - m:oMathPara → 转换为 $LaTeX$
    """
    result = []

    for child in para._element:
        tag = _strip_tag(child)

        if tag == 'r':
            # 普通文本 run → 提取 w:t 中的文本
            texts = child.findall(f'.//{{{MAIN_NS}}}t')
            for t in texts:
                if t.text:
                    result.append(t.text)

        elif tag == 'tab':
            result.append('\t')

        elif tag == 'br':
            result.append('\n')

        elif tag == 'oMath':
            latex = omml_to_latex(child)
            if latex:
                result.append(f'${latex}$')

        elif tag == 'oMathPara':
            latex = omml_to_latex(child)
            if latex:
                result.append(f'${latex}$')

    return ''.join(result)


def _finalize_question(current_q, current_lines, current_paras, questions):
    """完成当前题目：写入文本字段，追加到列表"""
    current_q["raw_text"] = "\n".join(current_lines)
    current_q["paras_raw"] = [p.text for p in current_paras]
    current_q["paras_with_math"] = [
        reconstruct_paragraph_text(p) for p in current_paras
    ]
    questions.append(current_q)


def parse_docx(filepath):
    """解析单份 DOCX，返回题目列表

    参数：
        filepath: str — DOCX 文件路径

    返回：list[dict]，每项包含：
        - number: int               — 题号
        - question_type: str|None   — 题型（选择题/填空题/解答题）
        - raw_text: str             — 纯文本拼接
        - paras_raw: list[str]      — 每段原始文本
        - paras_with_math: list[str] — 每段含 $LaTeX$ 的文本
        - para_objects: list        — 原始段落对象
    """
    doc = Document(filepath)
    questions = []
    current_q = None
    current_type = None
    current_lines = []
    current_paras = []
    started = False  # 是否已遇到第一个大题标题（跳过注意事项等前置内容）
    all_paras = list(doc.paragraphs)

    for para in all_paras:
        text = para.text.strip()

        # ===== 大题标题：一、选择题 → 切换题型，并标记开始 =====
        if RE_BIG_TITLE.match(text):
            current_type = _detect_type(text)
            started = True
            continue

        # 未遇到大题标题前，跳过所有内容
        if not started:
            continue

        # ===== 跳过答案/解析/分析/详解/点睛 =====
        if RE_SKIP.match(text):
            if current_q is not None:
                _finalize_question(current_q, current_lines, current_paras, questions)
                current_q = None
                current_lines = []
                current_paras = []
            continue

        # ===== 题号：切新题 =====
        m = RE_NUMBER.match(text)
        if m:
            # 保存上一题
            if current_q is not None:
                _finalize_question(current_q, current_lines, current_paras, questions)

            current_q = {
                "number": int(m.group(1)),
                "question_type": current_type,
                "raw_text": "",
                "paras_raw": [],
                "paras_with_math": [],
                "para_objects": [para],
            }
            current_lines = [text]
            current_paras = [para]
            continue

        # ===== 其他内容行 → 归入当前题 =====
        if current_q is not None:
            current_lines.append(text)
            current_paras.append(para)
            current_q["para_objects"].append(para)

    # ===== 最后一题收尾 =====
    if current_q is not None:
        _finalize_question(current_q, current_lines, current_paras, questions)

    return questions


# ========== 图片提取 ==========


def extract_images(para_objects, question_id, docx_path, output_dir, rels_map=None):
    """从 DOCX 段落中提取嵌入图片，以 question_id 命名保存"""
    if rels_map is None:
        rels_map = _load_rels(docx_path)

    images = []
    counter = 0

    for para in para_objects:
        # 检测 drawing（新格式）
        drawings = para._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing')
        for drawing in drawings:
            blip = drawing.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
            for b in blip:
                embed = b.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                if embed and embed in rels_map:
                    media_path = rels_map[embed]
                    if media_path.startswith('media/'):
                        counter += 1
                        ext = os.path.splitext(media_path)[1] or '.png'
                        if counter == 1:
                            filename = f"{question_id}{ext}"
                        else:
                            filename = f"{question_id}_{counter:02d}{ext}"
                        _copy_image(docx_path, media_path, os.path.join(output_dir, filename))
                        images.append(f"images/{filename}")

        # 检测 VML shape（旧格式图片）
        shapes = para._element.findall('.//{urn:schemas-microsoft-com:vml}shape')
        for shape in shapes:
            imagedata = shape.findall('.//{urn:schemas-microsoft-com:vml}imagedata')
            for img in imagedata:
                rid = img.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                if rid and rid in rels_map:
                    media_path = rels_map[rid]
                    if media_path.startswith('media/'):
                        counter += 1
                        ext = os.path.splitext(media_path)[1] or '.png'
                        if counter == 1:
                            filename = f"{question_id}{ext}"
                        else:
                            filename = f"{question_id}_{counter:02d}{ext}"
                        _copy_image(docx_path, media_path, os.path.join(output_dir, filename))
                        images.append(f"images/{filename}")

        # 检测 VML pict
        picts = para._element.findall('.//{urn:schemas-microsoft-com:vml}pict')
        for pict in picts:
            for shape in pict.findall('.//{urn:schemas-microsoft-com:vml}shape'):
                imagedata = shape.findall('.//{urn:schemas-microsoft-com:vml}imagedata')
                for img in imagedata:
                    rid = img.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                    if rid and rid in rels_map:
                        media_path = rels_map[rid]
                        if media_path.startswith('media/'):
                            counter += 1
                            ext = os.path.splitext(media_path)[1] or '.png'
                            if counter == 1:
                                filename = f"{question_id}{ext}"
                            else:
                                filename = f"{question_id}_{counter:02d}{ext}"
                            _copy_image(docx_path, media_path, os.path.join(output_dir, filename))
                            images.append(f"images/{filename}")

    return images


def _load_rels(docx_path):
    """读取 DOCX 的关系映射：rId → media/xxx.png"""
    rels = {}
    with zipfile.ZipFile(docx_path) as z:
        if 'word/_rels/document.xml.rels' not in z.namelist():
            return rels
        rels_xml = z.read('word/_rels/document.xml.rels')
        root = etree.fromstring(rels_xml)
        ns = '{http://schemas.openxmlformats.org/package/2006/relationships}'
        for rel in root:
            rid = rel.get('Id')
            target = rel.get('Target', '')
            if target.startswith('media/'):
                rels[rid] = target
    return rels


def _copy_image(docx_path, media_path, output_path):
    """从 DOCX ZIP 中复制图片到输出目录"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with zipfile.ZipFile(docx_path) as z:
        full_path = f'word/{media_path}'
        if full_path in z.namelist():
            data = z.read(full_path)
            with open(output_path, 'wb') as f:
                f.write(data)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, "d:/claude/project_LocalExam")
    from pipeline.config import DOCX_DIR

    test_file = os.path.join(
        DOCX_DIR,
        "精品解析：天津市南开区2025-2026学年上学期八年级数学期末试卷（解析版）.docx",
    )

    # 解析测试
    qs = parse_docx(test_file)
    print(f"总计提取 {len(qs)} 题\n")
    for q in qs[:3]:
        print(f"[{q['number']}] {q['question_type']}")
        print(f"  LaTeX文本: {q['paras_with_math'][0][:100]}")
        print()

    # 图片提取测试
    print("=== 图片提取测试 ===")
    rels = _load_rels(test_file)
    print(f"找到 {len(rels)} 个媒体关系")
    for rid, target in list(rels.items())[:5]:
        print(f"  {rid} → {target}")
