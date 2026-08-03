"""步骤5：组装 JSON + 主流程编排

功能：
1. 从 DOCX 文件名解析 source 信息（区名、学年、学期、年级、考试类型）
2. 解析选择题选项（A/B/C/D）和解答题子问
3. 清洗题干文本，去掉选项行
4. 处理单份 DOCX，构建完整题目 JSON
5. 遍历所有 DOCX，汇总输出总 JSON
"""

import json
import os
import re
import uuid
from datetime import datetime

from pipeline.config import (
    API_KEY,
    DISTRICT_MAP,
    DOCX_DIR,
    IMAGES_DIR,
    OUTPUT_DIR,
)
from pipeline.docx_parser import extract_images, parse_docx, _load_rels
from pipeline.llm_tagger import tag_knowledge


# ==================== source 信息解析 ====================


def parse_source_from_filename(filename):
    """从文件名解析 source 信息

    示例: 精品解析：天津市南开区2025-2026学年上学期八年级数学期末试卷（解析版）.docx
    """
    source = {
        "province": "天津市",
        "city": "天津市",
        "file_name": filename,
        "district": "未知",
        "year": "未知",
        "semester": "未知",
        "grade": "未知",
        "exam_type": "未知",
    }

    # 提取区名
    for key, val in DISTRICT_MAP.items():
        if key in filename:
            source["district"] = val
            break

    # 提取学年
    m = re.search(r"(\d{4}-\d{4})", filename)
    if m:
        source["year"] = m.group(1)

    # 提取学期
    if "上学期" in filename or "上" in filename:
        source["semester"] = "上学期"
    elif "下学期" in filename:
        source["semester"] = "下学期"

    # 提取年级
    if "八年级" in filename:
        source["grade"] = "八年级"
    elif "七年级" in filename:
        source["grade"] = "七年级"

    # 提取考试类型
    if "期末" in filename:
        source["exam_type"] = "期末"
    elif "期中" in filename:
        source["exam_type"] = "期中"
    elif "月考" in filename:
        source["exam_type"] = "月考"
    elif "模拟" in filename:
        source["exam_type"] = "模拟"

    return source


# ==================== 选项解析 ====================

# 选项标签边界：A-D 后必须跟 ．/./空白（否则题干中的字母如 △ABC、点D、GDP
# 会被误当作选项边界，把选项切成碎片）
_OPTION_SEP = re.compile(r"[A-D]\s*(?:[．.]|\s)")


def _parse_options(stem_text):
    """从题干文本中解析选项 A/B/C/D"""
    options = []
    # 找出可能的选项行：包含连续的 A-D 的行
    for line in stem_text.split("\n"):
        line = line.strip()
        if not _OPTION_SEP.search(line):
            continue

        # 从行中提取所有 A-D 开头的片段
        # 先找到第一个 A-D
        while line:
            m = re.match(r"([A-D])\s*(?:[．.]|\s)(.*)", line)
            if not m:
                break
            label = m.group(1)
            rest = m.group(2)
            # 找到下一个 A-D 的位置
            next_m = _OPTION_SEP.search(rest)
            if next_m:
                content = rest[:next_m.start()].strip()
                line = rest[next_m.start():]
            else:
                content = rest.strip()
                line = ""
            options.append({"label": label, "latex": content})

    return options if options else None


def _parse_sub_questions(paras):
    """从解答题段落中解析子问

    匹配 （1）、(1)、①、②、③ 开头的段落，编号统一为 (n) 格式
    """
    sub_questions = []
    circle_map = {'①': '1', '②': '2', '③': '3'}
    for para in paras:
        text = para.strip()
        m = re.match(r"^[（(](\d+)[）)]\s*(.*)", text)
        if m:
            content = m.group(2).strip()
            sub_questions.append({
                "number": f"({m.group(1)})",
                "latex": content,
            })
            continue
        # 也匹配圆圈数字 ①②③，统一为 (n) 格式
        m = re.match(r"^([①②③])\s*(.*)", text)
        if m:
            content = m.group(2).strip()
            sub_questions.append({
                "number": f"({circle_map[m.group(1)]})",
                "latex": content,
            })
    return sub_questions if sub_questions else None


def _clean_stem(full_text, question_type=None):
    """去掉文本中的选项行和子问行，只保留题干

    识别以 "A．" / "A." / "A"（后跟空格/tab）等开头的行并移除
    如果是解答题，也移除子问行（（1）/ (1) / ① 等）
    """
    lines = full_text.split("\n")
    cleaned = [l for l in lines if not re.match(r"^[A-D][．\.]?", l.strip())]
    # 解答题：只去掉 _parse_sub_questions 能捕获的子问行（（n）/(n)/①②③），
    # 避免误删（Ⅰ）（i）（提示 等无法解析为子问的合法题干行导致内容丢失
    if question_type == "解答题":
        cleaned = [l for l in cleaned if not re.match(r"^(?:[（(]\d+[）)]|[①②③])\s*", l.strip())]
    return "\n".join(cleaned).strip()


# ==================== 单份 DOCX 处理 ====================


def process_one_docx(filepath, api_key=API_KEY):
    """处理单份 DOCX，返回题目列表"""
    filename = os.path.basename(filepath)
    print(f"处理: {filename}")

    source = parse_source_from_filename(filename)
    raw_questions = parse_docx(filepath)
    rels = _load_rels(filepath)

    result_questions = []

    for rq in raw_questions:
        qid = str(uuid.uuid4())

        # 提取图片
        images = extract_images(
            rq["para_objects"],
            qid,
            filepath,
            IMAGES_DIR,
            rels,
        )

        # 构建 stem：所有段落的含公式文本，去掉选项行
        full_text = "\n".join(rq["paras_with_math"])
        stem = _clean_stem(full_text, rq["question_type"])

        content = {
            "images": images,
            "stem": stem,
        }

        # 解析题型特定字段
        if rq["question_type"] == "选择题":
            opts = _parse_options(full_text)
            if opts:
                content["options"] = opts

        elif rq["question_type"] == "解答题":
            subs = _parse_sub_questions(rq["paras_with_math"])
            if subs:
                content["sub_questions"] = subs

        # LLM 知识点标注（仅在 api_key 有效时调用）
        knowledge = tag_knowledge(rq, api_key) if api_key else []

        question = {
            "question_id": qid,
            "source": {**source},
            "number": rq["number"],
            "question_type": rq["question_type"],
            "knowledge": knowledge,
            "status": "success",
            "content": content,
        }

        result_questions.append(question)

    return result_questions


# ==================== 单文件构建（含图片追踪） ====================


def build(filepath, api_key=API_KEY):
    """处理单份 DOCX，返回 {questions, images}"""
    questions = process_one_docx(filepath, api_key)
    images = []
    for q in questions:
        images.extend(q["content"]["images"])
    return {"questions": questions, "images": images}


# ==================== 全量构建 ====================


def build_all(api_key=API_KEY):
    """遍历 解析版/ 下所有 DOCX，组装输出 JSON"""
    os.makedirs(IMAGES_DIR, exist_ok=True)

    all_questions = []

    for fname in sorted(os.listdir(DOCX_DIR)):
        if not fname.endswith(".docx"):
            continue
        try:
            filepath = os.path.join(DOCX_DIR, fname)
            questions = process_one_docx(filepath, api_key)
            all_questions.extend(questions)
            print(f"  ✓ {fname}: {len(questions)} 题")
        except Exception as e:
            print(f"  ✗ {fname}: 处理失败 - {e}")
            continue

    # 组装顶层结构
    output = {
        "version": "1.0",
        "generated_at": datetime.now().strftime("%Y-%m-%d"),
        "total_questions": len(all_questions),
        "questions": all_questions,
    }

    # 写入 JSON
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, "exam_questions.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n完成！共 {len(all_questions)} 题")
    print(f"JSON: {output_path}")
    print(f"图片: {IMAGES_DIR}")

    return output


# ==================== 本地验证 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("builder.py 模块验证")
    print("=" * 50)
    print(f"DOCX_DIR  = {DOCX_DIR}")
    print(f"OUTPUT_DIR = {OUTPUT_DIR}")
    print(f"IMAGES_DIR = {IMAGES_DIR}")

    # 列出解析版目录下的 DOCX 文件
    docx_files = [f for f in os.listdir(DOCX_DIR) if f.endswith(".docx")]
    print(f"\n共 {len(docx_files)} 个 DOCX 文件：")
    for f in docx_files:
        print(f"  - {f}")

    # 测试 parse_source_from_filename
    print("\n--- parse_source_from_filename 测试 ---")
    for fname in docx_files[:3]:
        result = parse_source_from_filename(fname)
        print(f"\n文件名: {fname}")
        print(f"  source: {json.dumps(result, ensure_ascii=False, indent=2)}")

    # 测试 _parse_options
    print("\n--- _parse_options 测试 ---")
    test_text_1 = "A. $x+1$ \t B. $x-1$ \t C. $x^2$ \t D. $x^2+1$"
    opts = _parse_options(test_text_1)
    print(f"输入: {test_text_1}")
    print(f"  选项: {opts}")

    test_text_2 = "A. $\\frac{1}{2}$\nB. $\\frac{3}{4}$\nC. 1\nD. 0"
    opts = _parse_options(test_text_2)
    print(f"\n输入:\n{test_text_2}")
    print(f"  选项: {opts}")

    # 测试 _clean_stem
    print("\n--- _clean_stem 测试 ---")
    test_stem = "已知 $x+y=5$，求 $x^2+y^2$ 的值。\nA. $10$\nB. $15$\nC. $20$\nD. $25$"
    cleaned = _clean_stem(test_stem)
    print(f"输入:\n{test_stem}")
    print(f"清洗后: {cleaned}")

    # 测试 _parse_sub_questions
    print("\n--- _parse_sub_questions 测试 ---")
    sub_qs = [
        "（1）求 $x$ 的值；",
        "（2）求 $y$ 的值；",
        "（3）求证 $\\triangle ABC \\cong \\triangle DEF$。",
    ]
    parsed = _parse_sub_questions(sub_qs)
    print(f"输入: {sub_qs}")
    print(f"  子问: {parsed}")

    # 测试 build_all（不传 API key，跳过 LLM 标注）
    print("\n--- build_all 无 API 验证 ---")
    print("（仅执行解析流程，不调用 LLM 标注）")
