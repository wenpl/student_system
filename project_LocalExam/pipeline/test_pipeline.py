"""端到端测试：pipeline 各组件

测试范围（不调用 LLM API）：
  1. test_parsing         — 解析 DOCX，验证题数、题型分布、公式转换
  2. test_image_extraction — 验证图片提取的媒体关系加载
  3. test_source_parsing   — 验证文件名解析各字段

用法：
    python pipeline/test_pipeline.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.docx_parser import parse_docx, reconstruct_paragraph_text, _load_rels
from pipeline.builder import _clean_stem, _parse_options, _parse_sub_questions, parse_source_from_filename
from pipeline.config import DOCX_DIR
from pipeline.llm_tagger import _add_comprehensive_tag, _dedup_knowledge, _fix_known_errors, _normalize_knowledge


# ==================== 测试数据 ====================

TEST_FILE = os.path.join(
    DOCX_DIR,
    "精品解析：天津市南开区2025-2026学年上学期八年级数学期末试卷（解析版）.docx",
)

# 期望值（源自试卷结构）
EXPECTED_TOTAL = 24
EXPECTED_DISTRIBUTION = {"选择题": 12, "填空题": 6, "解答题": 6}


# ==================== 测试 1：解析正确性 ====================


def test_parsing():
    """解析 DOCX，验证题数、题型分布、字段完整性、公式转换"""
    print("=" * 60)
    print("测试 1：DOCX 解析")
    print("=" * 60)

    # ---- 1a. 解析 ----
    questions = parse_docx(TEST_FILE)
    total = len(questions)
    print(f"  解析到 {total} 题")

    assert total > 0, (
        f"FAIL: 解析到 0 题，应大于 0\n"
        f"      文件路径: {TEST_FILE}"
    )
    assert total == EXPECTED_TOTAL, (
        f"FAIL: 解析到 {total} 题，期望 {EXPECTED_TOTAL} 题\n"
        f"      请检查 DOCX 段落结构是否与 parser 的正则匹配"
    )
    print(f"  ✓ 题数 = {EXPECTED_TOTAL}")

    # ---- 1b. 题型分布 ----
    type_counts = {}
    for q in questions:
        t = q["question_type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    print(f"  题型分布: {type_counts}")

    for qt, expected in EXPECTED_DISTRIBUTION.items():
        actual = type_counts.get(qt, 0)
        assert actual == expected, (
            f"FAIL: {qt} 数量为 {actual}，期望 {expected}\n"
            f"      全部题型分布: {type_counts}"
        )
        print(f"  ✓ {qt}: {expected} 题")

    # 检查没有未知题型
    for qt in type_counts:
        assert qt in EXPECTED_DISTRIBUTION, (
            f"FAIL: 出现未知题型 '{qt}'，仅期望 {list(EXPECTED_DISTRIBUTION.keys())}"
        )

    # ---- 1c. 字段完整性 ----
    print("\n  --- 字段完整性 ---")
    for q in questions:
        qid = q["number"]
        assert isinstance(q.get("number"), int), (
            f"FAIL: 题号 {qid} 的 number 字段不是 int 类型"
        )
        assert isinstance(q.get("question_type"), str), (
            f"FAIL: 题号 {qid} 的 question_type 字段不是 str 类型"
        )
        assert isinstance(q.get("paras_with_math"), list), (
            f"FAIL: 题号 {qid} 的 paras_with_math 字段不是 list 类型"
        )
        assert len(q["paras_with_math"]) > 0, (
            f"FAIL: 题号 {qid} 的 paras_with_math 为空"
        )
    print(f"  ✓ 全部 {EXPECTED_TOTAL} 题均包含 number(int)、question_type(str)、paras_with_math(list)")

    # ---- 1d. 公式转换（检查 $...$ 标记） ----
    print("\n  --- 公式转换验证 ---")
    questions_with_math = 0
    total_math_paras = 0

    for q in questions:
        qid = q["number"]
        math_paras = [i for i, p in enumerate(q["paras_with_math"]) if "$" in p]
        if math_paras:
            questions_with_math += 1
            total_math_paras += len(math_paras)
            # 检查 $...$ 格式正确（至少成对出现）
            for idx in math_paras:
                text = q["paras_with_math"][idx]
                dollar_count = text.count("$")
                assert dollar_count % 2 == 0, (
                    f"FAIL: 题号 {qid} 段落 {idx} 的 $ 数量为奇数 ({dollar_count})\n"
                    f"       内容: {text[:200]}"
                )

    print(f"  ✓ 含公式的题目: {questions_with_math}/{EXPECTED_TOTAL}")
    print(f"  ✓ 含公式的段落总数: {total_math_paras}")
    assert questions_with_math > 0, (
        "FAIL: 没有任何题目包含 $...$ 公式标记，公式转换可能未生效\n"
        "      请检查 reconstruct_paragraph_text 是否检测到 OMML 元素"
    )

    # 输出部分含公式题目的第一段公式作验证
    print("\n  --- 公式转换示例 ---")
    shown = 0
    for q in questions:
        if shown >= 3:
            break
        math_paras = [i for i, p in enumerate(q["paras_with_math"]) if "$" in p]
        if math_paras:
            idx = math_paras[0]
            sample = q["paras_with_math"][idx]
            print(f"  题号 {q['number']} ({q['question_type']}):")
            print(f"    {sample[:150]}")
            shown += 1

    print("\n  ✓ 解析测试通过")


# ==================== 测试 2：图片提取 ====================


def test_image_extraction():
    """验证 _load_rels 能正确读取 DOCX 内的媒体关系"""
    print("\n" + "=" * 60)
    print("测试 2：图片提取（媒体关系加载）")
    print("=" * 60)

    rels = _load_rels(TEST_FILE)
    count = len(rels)
    print(f"  该 DOCX 有 {count} 个媒体文件引用")

    assert count > 0, (
        f"FAIL: _load_rels 返回 {count} 个媒体关系，期望 > 0\n"
        f"      可能原因：DOCX 中无嵌入图片，或 ZIP 路径 'word/_rels/document.xml.rels' 不存在"
    )

    # 验证每个关系的格式：rId → media/xxx
    for rid, target in list(rels.items())[:3]:
        print(f"    {rid} → {target}")
        assert target.startswith("media/"), (
            f"FAIL: 媒体引用路径应以 'media/' 开头，实际为 '{target}'"
        )

    print(f"  ✓ 图片提取功能正常（{count} 个媒体关系）")


# ==================== 测试 3：文件名解析 ====================


def test_source_parsing():
    """验证从 DOCX 文件名解析 source 字段的准确性"""
    print("\n" + "=" * 60)
    print("测试 3：文件名 source 解析")
    print("=" * 60)

    filename = "精品解析：天津市南开区2025-2026学年上学期八年级数学期末试卷（解析版）.docx"
    source = parse_source_from_filename(filename)

    print(f"  文件名: {filename}")
    print(f"  解析结果: {source}")

    # ---- 区名 ----
    expected_district = "南开区"
    actual_district = source.get("district", "")
    assert actual_district == expected_district, (
        f"FAIL: district = '{actual_district}'，期望 '{expected_district}'"
    )
    print(f"  ✓ district = '{expected_district}'")

    # ---- 学年 ----
    expected_year = "2025-2026"
    actual_year = source.get("year", "")
    assert actual_year == expected_year, (
        f"FAIL: year = '{actual_year}'，期望 '{expected_year}'"
    )
    print(f"  ✓ year = '{expected_year}'")

    # ---- 学期 ----
    expected_semester = "上学期"
    actual_semester = source.get("semester", "")
    assert actual_semester == expected_semester, (
        f"FAIL: semester = '{actual_semester}'，期望 '{expected_semester}'"
    )
    print(f"  ✓ semester = '{expected_semester}'")

    # ---- 年级 ----
    expected_grade = "八年级"
    actual_grade = source.get("grade", "")
    assert actual_grade == expected_grade, (
        f"FAIL: grade = '{actual_grade}'，期望 '{expected_grade}'"
    )
    print(f"  ✓ grade = '{expected_grade}'")

    # ---- 考试类型 ----
    expected_exam_type = "期末"
    actual_exam_type = source.get("exam_type", "")
    assert actual_exam_type == expected_exam_type, (
        f"FAIL: exam_type = '{actual_exam_type}'，期望 '{expected_exam_type}'"
    )
    print(f"  ✓ exam_type = '{expected_exam_type}'")

    # ---- 基础字段 ----
    assert source.get("province") == "天津市", (
        f"FAIL: province = '{source.get('province')}'，期望 '天津市'"
    )
    assert source.get("file_name") == filename, (
        f"FAIL: file_name 与输入文件名不一致"
    )

    print(f"  ✓ source 解析全部正确")


# ==================== 测试 4：选项解析 ====================


def test_parse_options():
    """验证选择题选项解析不被题干中的字母干扰（△ABC、点D、GDP 等）"""
    print("\n" + "=" * 60)
    print("测试 4：选项解析")
    print("=" * 60)

    # 内联中文选项（A．健B．康C．和D．平）
    opts = _parse_options("A．健B．康C．和D．平")
    assert [o["label"] for o in opts] == ["A", "B", "C", "D"], (
        f"FAIL: 内联中文选项标签异常 {[o['label'] for o in opts]}"
    )
    assert [o["latex"] for o in opts] == ["健", "康", "和", "平"], (
        f"FAIL: 内联中文选项内容异常 {[o['latex'] for o in opts]}"
    )
    print("  ✓ 内联中文选项 A．健B．康C．和D．平")

    # 首个选项无点号（A 7B. 10C. 11D. 14）
    opts = _parse_options("A 7B. 10C. 11D. 14")
    assert [o["label"] for o in opts] == ["A", "B", "C", "D"]
    assert [o["latex"] for o in opts] == ["7", "10", "11", "14"], (
        f"FAIL: 无点号首选项解析异常 {[o['latex'] for o in opts]}"
    )
    print("  ✓ 首个选项无点号 A 7B. 10C. 11D. 14")

    # 几何题干内嵌字母（回归：曾被切成 15 个碎片）
    stem = "A．如图，在△ABC中，点D是AB的中点，若DE=3，则BC的长为（　）\tB．4\tC．5\tD．6"
    opts = _parse_options(stem)
    assert len(opts) == 4, (
        f"FAIL: 几何题干选项被切成 {len(opts)} 个，应为 4 个"
    )
    assert [o["label"] for o in opts] == ["A", "B", "C", "D"]
    assert "点D是AB的中点" in opts[0]["latex"], (
        f"FAIL: 题干中的字母 D 被误当作选项边界"
    )
    assert [o["latex"] for o in opts[1:]] == ["4", "5", "6"], (
        f"FAIL: 几何题干 B/C/D 选项内容异常 {[o['latex'] for o in opts[1:]]}"
    )
    print("  ✓ 几何题干内嵌字母不产生误切分")

    # 选项内容含 GDP（字母 D 不能成为边界）
    opts = _parse_options("A．$2013-2025$年，我国$GDP$整体呈上升趋势\tB．2022年，我国$GDP$数值约为$1200000$亿元")
    assert len(opts) == 2 and opts[0]["label"] == "A" and opts[1]["label"] == "B"
    assert "GDP" in opts[0]["latex"] and "$GDP$" in opts[1]["latex"], (
        f"FAIL: 选项内容中的 GDP 被误切分"
    )
    print("  ✓ 选项内容中的 GDP 不被切分")

    print("\n  ✓ 选项解析测试通过")


# ==================== 测试 5：综合标签 ====================


def test_comprehensive_tag():
    """验证综合标签：函数+几何 → 函数与几何综合；两个函数 → 多函数综合"""
    print("\n" + "=" * 60)
    print("测试 5：综合标签后处理")
    print("=" * 60)

    def zt_level4(knowledge):
        return [k["level4"][0] for k in knowledge if k.get("level1") == "综合题"]

    # 一次函数 + 三角形 → 函数与几何综合（回归：曾被误标为多函数综合）
    k = [
        {"level1": "函数", "level2": "一次函数", "level3": ["一次函数的图象与性质"], "level4": []},
        {"level1": "图形的性质", "level2": "三角形", "level3": ["三角形全等的判定"], "level4": []},
    ]
    tags = zt_level4(_add_comprehensive_tag(k))
    assert "函数与几何综合" in tags, (
        f"FAIL: 一次函数+三角形应标「函数与几何综合」，实际 {tags}"
    )
    assert "多函数综合" not in tags, (
        f"FAIL: 一次函数+三角形被误标为「多函数综合」"
    )
    print("  ✓ 一次函数 + 三角形 → 函数与几何综合")

    # 两个不同函数 → 多函数综合
    k = [
        {"level1": "函数", "level2": "一次函数", "level3": [], "level4": []},
        {"level1": "函数", "level2": "二次函数", "level3": [], "level4": []},
    ]
    tags = zt_level4(_add_comprehensive_tag(k))
    assert "多函数综合" in tags, (
        f"FAIL: 一次函数+二次函数应标「多函数综合」，实际 {tags}"
    )
    print("  ✓ 一次函数 + 二次函数 → 多函数综合")

    # 单项知识点不加综合标签
    k = [{"level1": "函数", "level2": "一次函数", "level3": [], "level4": []}]
    assert _add_comprehensive_tag(k) == k, "FAIL: 单知识点不应加综合标签"
    print("  ✓ 单知识点不加综合标签")

    print("\n  ✓ 综合标签测试通过")


# ==================== 测试 6：子问解析 ====================


def test_sub_questions():
    """验证解答题子问解析：编号统一为 (n) 格式"""
    print("\n" + "=" * 60)
    print("测试 6：子问解析")
    print("=" * 60)

    # 数字编号
    subs = _parse_sub_questions(["（1）求$x$的值；", "（2）求$y$的值；"])
    assert [s["number"] for s in subs] == ["(1)", "(2)"], (
        f"FAIL: 数字子问编号异常 {[s['number'] for s in subs]}"
    )
    print("  ✓ （1）（2）编号")

    # 圆圈编号 ①②③ → 统一为 (n)
    subs = _parse_sub_questions(["①求$x$的值；", "②求$y$的值；", "③求$z$的值；"])
    assert [s["number"] for s in subs] == ["(1)", "(2)", "(3)"], (
        f"FAIL: 圆圈子问编号应统一为 (n)，实际 {[s['number'] for s in subs]}"
    )
    print("  ✓ ①②③ → (1)(2)(3)")

    print("\n  ✓ 子问解析测试通过")


# ==================== 测试 7：题干清洗 ====================


def test_clean_stem():
    """验证题干清洗：不误删无法解析为子问的合法题干行（提示、（Ⅰ）等）"""
    print("\n" + "=" * 60)
    print("测试 7：题干清洗")
    print("=" * 60)

    # 解答题：子问行被移除
    text = "已知$x+y=5$。\n（1）求$x$的值；\n（2）求$y$的值；"
    cleaned = _clean_stem(text, "解答题")
    assert "（1）求$x$" not in cleaned and "（2）求$y$" not in cleaned, (
        f"FAIL: 子问行应从题干移除\n{cleaned}"
    )
    assert "已知$x+y=5$" in cleaned
    print("  ✓ 子问行从题干移除")

    # 解答题：提示行不能被误删
    text = "设计一种方案，使总费用最少。\n（提示：每张卡纸最多可折 6 个盒子）"
    cleaned = _clean_stem(text, "解答题")
    assert "（提示" in cleaned, (
        f"FAIL: 提示行被误删\n{cleaned}"
    )
    print("  ✓ （提示… 行保留")

    # 解答题：罗马数字子问（无法解析为 (n)）保留在题干，不丢失
    text = "求代数式的值。\n（Ⅰ）若$x=1$，求值；\n（Ⅱ）若$y=2$，求值；"
    cleaned = _clean_stem(text, "解答题")
    assert "（Ⅰ）" in cleaned and "（Ⅱ）" in cleaned, (
        f"FAIL: 罗马数字子问行被误删\n{cleaned}"
    )
    print("  ✓ 罗马数字子问行保留")

    # 选择题：选项行移除、题干保留
    text = "下列是轴对称图形的是（　）\nA．健\nB．康\nC．和\nD．平"
    cleaned = _clean_stem(text, "选择题")
    assert "下列是轴对称图形" in cleaned and "健" not in cleaned, (
        f"FAIL: 选择题清洗异常\n{cleaned}"
    )
    print("  ✓ 选择题选项行移除")

    print("\n  ✓ 题干清洗测试通过")


# ==================== 测试 8：已知错误修正 ====================


def test_fix_known_errors():
    """验证 _fix_known_errors 修正已知 LLM 错误模式"""
    print("\n" + "=" * 60)
    print("测试 8：已知错误修正")
    print("=" * 60)

    # 含「公因式」但未标提公因式 → 强制为 因式分解方法/提公因式法与综合分解
    k = [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": ["公式法分解因式"]}]
    fixed = _fix_known_errors(k, "用提公因式法对下式进行因式分解")
    assert fixed[0]["level4"] == ["提公因式法与综合分解"], (
        f"FAIL: 公因式题未修正为提公因式\n{fixed}"
    )
    assert fixed[0]["level3"] == ["因式分解方法"]
    print("  ✓ 公因式 → 提公因式法与综合分解")

    # 已标提公因式 → 不重复修正
    k = [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": ["提公因式法与综合分解"]}]
    fixed = _fix_known_errors(k, "用提公因式法对下式进行因式分解")
    assert fixed[0]["level4"] == ["提公因式法与综合分解"]
    print("  ✓ 已标提公因式不重复修正")

    # 含「画出」「高」→ 强制为 与三角形有关的线段/三角形的高与垂心
    k = [{"level1": "图形的性质", "level2": "三角形", "level3": ["与三角形有关的线段"], "level4": ["三角形的中线与重心"]}]
    fixed = _fix_known_errors(k, "画出△ABC中BC边上的高")
    assert fixed[0]["level4"] == ["三角形的高与垂心"], (
        f"FAIL: 高/画出题未修正为三角形的高与垂心\n{fixed}"
    )
    assert fixed[0]["level3"] == ["与三角形有关的线段"]
    print("  ✓ 画出/高 → 三角形的高与垂心")

    print("\n  ✓ 已知错误修正测试通过")


# ==================== 测试 9：跨章去重 ====================


def test_dedup_knowledge():
    """验证 _dedup_knowledge：保留综合标签 + 每个领域一个基础标签"""
    print("\n" + "=" * 60)
    print("测试 9：跨章去重")
    print("=" * 60)

    k = [
        {"level1": "函数", "level2": "一次函数", "level3": [], "level4": []},
        {"level1": "函数", "level2": "二次函数", "level3": [], "level4": []},
        {"level1": "图形的性质", "level2": "三角形", "level3": [], "level4": []},
        {"level1": "综合题", "level2": "跨领域综合", "level3": ["函数与其他领域"], "level4": ["函数与几何综合"]},
    ]
    dedup = _dedup_knowledge(k)
    base = [x for x in dedup if x["level1"] != "综合题"]
    zt = [x for x in dedup if x["level1"] == "综合题"]
    assert len(zt) == 1 and zt[0]["level4"] == ["函数与几何综合"], (
        f"FAIL: 综合标签丢失 {dedup}"
    )
    assert len(base) == 2, (
        f"FAIL: 基础标签应按领域去重为 2 个，实际 {len(base)}"
    )
    l1s = {x["level1"] for x in base}
    assert l1s == {"函数", "图形的性质"}, (
        f"FAIL: 基础标签领域异常 {l1s}"
    )
    print("  ✓ 保留综合标签 + 每领域一个基础标签")

    # 单一领域多个标签 → 只保留 1 个
    k = [
        {"level1": "函数", "level2": "一次函数", "level3": [], "level4": []},
        {"level1": "函数", "level2": "二次函数", "level3": [], "level4": []},
    ]
    dedup = _dedup_knowledge(k)
    base = [x for x in dedup if x["level1"] != "综合题"]
    assert len(base) == 1, f"FAIL: 同领域多标签应去重为 1，实际 {len(base)}"
    print("  ✓ 同领域多标签去重为 1")

    print("\n  ✓ 跨章去重测试通过")


# ==================== 测试 10：知识标准化 ====================


def test_normalize_knowledge():
    """验证 _normalize_knowledge：精确/近似/子串匹配，不匹配则丢弃"""
    print("\n" + "=" * 60)
    print("测试 10：知识标准化")
    print("=" * 60)

    # 精确 4 级路径
    k = [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": ["提公因式法与综合分解"]}]
    out = _normalize_knowledge(k)
    assert out == [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": ["提公因式法与综合分解"]}], (
        f"FAIL: 4级路径匹配异常 {out}"
    )
    print("  ✓ 精确 4 级路径")

    # 3 级路径（无 level4 输入）→ 补全为最后一个 level4（分组分解法）
    k = [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": []}]
    out = _normalize_knowledge(k)
    assert out[0]["level3"] == ["因式分解方法"] and out[0]["level4"] == ["分组分解法"], (
        f"FAIL: 3级路径匹配异常 {out}"
    )
    print("  ✓ 3 级路径补全 level4")

    # LLM 把 level4 当 level3 输出 → 精确等于 level4 时解析回 level3
    k = [{"level1": "数与式", "level2": "因式分解", "level3": ["提公因式法与综合分解"], "level4": []}]
    out = _normalize_knowledge(k)
    assert out == [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": ["提公因式法与综合分解"]}], (
        f"FAIL: level4当level3精确匹配异常 {out}"
    )
    print("  ✓ level4 当作 level3 输出（精确匹配）")

    # level4 子串匹配
    k = [{"level1": "数与式", "level2": "因式分解", "level3": ["提公因式法与综合分解因式"], "level4": []}]
    out = _normalize_knowledge(k)
    assert out and out[0]["level4"] == ["提公因式法与综合分解"], (
        f"FAIL: level4子串匹配异常 {out}"
    )
    print("  ✓ level4 子串匹配")

    # 完全无法匹配 → 丢弃
    k = [{"level1": "不存在的分类", "level2": "xx", "level3": ["yy"], "level4": []}]
    out = _normalize_knowledge(k)
    assert out == [], f"FAIL: 不匹配项应被丢弃 {out}"
    print("  ✓ 不匹配项丢弃")

    print("\n  ✓ 知识标准化测试通过")


# ==================== 测试 11：试卷说明不解析为题目 ====================


def test_no_instruction_junk():
    """验证不把试卷说明/注意事项（答题卡、本卷共N题等）解析成题目"""
    print("\n" + "=" * 60)
    print("测试 11：试卷说明不解析为题目")
    print("=" * 60)

    f = os.path.join(
        DOCX_DIR,
        "精品解析：天津市和平区2025-2026学年七年级下学期期末考试数学试题（解析版）.docx",
    )
    qs = parse_docx(f)

    # 没有任何题的题干首段是指令（答题卡/本卷共/用黑色字迹）
    for q in qs:
        first = q["paras_with_math"][0]
        assert not any(w in first for w in ("答题卡", "本卷共", "用黑色字迹", "签字笔")), (
            f"FAIL: 指令行被解析为题目: {first[:40]}"
        )
    print("  ✓ 无指令行被解析为题目")

    # 题数应为 12 选择 + 6 填空 + 7 解答 = 25（不含 2 条 第Ⅱ卷 指令）
    assert len(qs) == 25, (
        f"FAIL: 期望 25 题（不含指令），实际 {len(qs)}"
    )
    print("  ✓ 题数 = 25（12+6+7）")

    # 题号连续 1..25
    nums = sorted(q["number"] for q in qs)
    assert nums == list(range(1, 26)), f"FAIL: 题号不连续 {nums}"
    print("  ✓ 题号连续 1..25")

    # 第二南开用「一．选择题」标题（全角句点），也应正常解析（回归：整卷曾被丢弃）
    f2 = [x for x in os.listdir(DOCX_DIR) if "第二南开" in x]
    assert f2, "FAIL: 找不到第二南开试卷"
    qs2 = parse_docx(os.path.join(DOCX_DIR, f2[0]))
    assert len(qs2) == 25, f"FAIL: 第二南开应解析 25 题，实际 {len(qs2)}"
    assert not any("答题卡" in q["paras_with_math"][0] for q in qs2), "FAIL: 第二南开含指令垃圾题"
    print("  ✓ 第二南开（一．标题）解析 25 题且无指令垃圾")

    # 河东2024-2025 用「本卷共 13 题」（带空格），也应过滤（回归：曾被漏过）
    f3 = [x for x in os.listdir(DOCX_DIR) if "河东区2024" in x]
    assert f3, "FAIL: 找不到河东2024-2025试卷"
    qs3 = parse_docx(os.path.join(DOCX_DIR, f3[0]))
    assert len(qs3) == 25, f"FAIL: 河东2024-2025 应解析 25 题，实际 {len(qs3)}"
    assert not any("本卷共" in q["paras_with_math"][0] for q in qs3), "FAIL: 河东2024-2025 含「本卷共」指令题"
    print("  ✓ 河东2024-2025（带空格的本卷共）解析 25 题且无指令垃圾")

    print("\n  ✓ 试卷说明过滤测试通过")


# ==================== 测试 12：空标注自动重试 ====================


def test_tag_retry_on_empty():
    """验证 LLM 返回无法匹配知识树的标签时，tag_knowledge 自动重试"""
    print("\n" + "=" * 60)
    print("测试 12：空标注自动重试")
    print("=" * 60)

    import pipeline.llm_tagger as lt
    real_call = lt.call_llm
    calls = {"n": 0}

    def fake_call(prompt, api_key):
        calls["n"] += 1
        if calls["n"] == 1:
            # 第一次：标签无法匹配知识树 → 归一化为空
            return [{"level1": "不存在的分类", "level2": "xx", "level3": ["yy"], "level4": []}]
        # 第二次：正常标签
        return [{"level1": "数与式", "level2": "因式分解", "level3": ["因式分解方法"], "level4": ["提公因式法与综合分解"]}]

    lt.call_llm = fake_call
    try:
        q = {"paras_with_math": ["用提公因式法因式分解"]}
        out = lt.tag_knowledge(q, "fake_key")
        assert calls["n"] == 2, f"FAIL: 空结果应重试 1 次，实际调用 {calls['n']} 次"
        assert out and out[0]["level4"] == ["提公因式法与综合分解"], (
            f"FAIL: 重试后应返回有效标签 {out}"
        )
    finally:
        lt.call_llm = real_call
    print("  ✓ 空结果自动重试并返回有效标签")

    print("\n  ✓ 空标注自动重试测试通过")


# ==================== 主入口 ====================


def main():
    """运行全部测试"""
    print("=" * 60)
    print("Pipeline 端到端测试")
    print(f"测试文件: {TEST_FILE}")
    print("=" * 60)

    all_passed = True

    tests = [
        ("test_parsing", test_parsing),
        ("test_image_extraction", test_image_extraction),
        ("test_source_parsing", test_source_parsing),
        ("test_parse_options", test_parse_options),
        ("test_comprehensive_tag", test_comprehensive_tag),
        ("test_sub_questions", test_sub_questions),
        ("test_clean_stem", test_clean_stem),
        ("test_fix_known_errors", test_fix_known_errors),
        ("test_dedup_knowledge", test_dedup_knowledge),
        ("test_normalize_knowledge", test_normalize_knowledge),
        ("test_no_instruction_junk", test_no_instruction_junk),
        ("test_tag_retry_on_empty", test_tag_retry_on_empty),
    ]

    for name, func in tests:
        try:
            func()
            print(f"\n  >>> {name}: 通过\n")
        except AssertionError as e:
            print(f"\n  >>> {name}: 失败")
            print(f"  {'─' * 58}")
            for line in str(e).split("\n"):
                print(f"  {line}")
            print(f"  {'─' * 58}")
            all_passed = False
        except Exception as e:
            print(f"\n  >>> {name}: 异常")
            print(f"  {'─' * 58}")
            print(f"  {type(e).__name__}: {e}")
            print(f"  {'─' * 58}")
            all_passed = False

    print("=" * 60)
    if all_passed:
        print("结果: 全部测试通过")
    else:
        print("结果: 存在失败的测试，请根据以上错误信息排查")
    print("=" * 60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
