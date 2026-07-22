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
from pipeline.builder import parse_source_from_filename
from pipeline.config import DOCX_DIR


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
