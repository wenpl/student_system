"""步骤4：调用通义千问 API 标注知识点"""

import json
import requests

from pipeline.config import API_URL, API_MODEL, KNOWLEDGE_TREE


def build_knowledge_prompt(question):
    """构造层级分步知识点标注 prompt

    LLM 按 level1 → level2 → level3 → level4 逐步推理选择
    """
    # 构建层级树
    tree = {}
    for l1, l2, l3, l4 in KNOWLEDGE_TREE:
        tree.setdefault(l1, {})
        tree[l1].setdefault(l2, {})
        tree[l1][l2].setdefault(l3, set())
        if l4:
            tree[l1][l2][l3].add(l4)

    L1_ORDER = ['数与式', '方程与不等式', '函数', '图形的性质', '图形的变化', '统计与概率']

    # 第1步：一级分类列表
    step1 = "\n".join(f"  {i+1}. {l1}" for i, l1 in enumerate(L1_ORDER))

    # 第2步：每个一级分类下的二级分类
    step2_lines = []
    for l1 in L1_ORDER:
        if l1 in tree:
            l2s = list(tree[l1].keys())
            step2_lines.append(f"  {l1}：{'、'.join(l2s)}")
    step2 = "\n".join(step2_lines)

    # 第3步和第4步：完整的标签树
    step3_lines = []
    for l1 in L1_ORDER:
        if l1 not in tree:
            continue
        step3_lines.append(f"\n  【{l1}】")
        for l2 in tree[l1]:
            step3_lines.append(f"    {l2}")
            for l3 in tree[l1][l2]:
                l4s = tree[l1][l2][l3]
                if l4s:
                    step3_lines.append(f"       - {l3}（四级：{'、'.join(sorted(l4s))}）")
                else:
                    step3_lines.append(f"       - {l3}")
    step3_text = "\n".join(step3_lines)

    # 题目内容
    paras = question.get("paras_with_math", [])
    stem_text = "\n".join(paras)
    analysis = question.get("analysis", "")
    analysis_block = f"\n\n题目解析（供参考）：{analysis}\n" if analysis else ""
    answer = question.get("answer", "")
    answer_block = f"\n题目答案（供参考）：{answer}\n" if answer else ""

    prompt = f"""你是一名初中数学教师，请按以下步骤为题目匹配最合适的知识点标签。

【第1步】确定一级分类
从以下6个一级分类中选择最匹配的1个：

{step1}

【第2步】确定二级分类
基于你选的一级分类，从相应二级分类中选择最匹配的：

{step2}

【第3步】确定三级标签
基于你选的一级和二级分类，从以下三级标签中选择最匹配的（支持无四级标签的节点）：

{step3_text}

【第4步】确定四级标签（可选）
如果该三级标签下有四级标签，选择最匹配的；若不需要或无四级则留空数组 []。

【第5步】判断是否需要综合标签
回答以下 3 个问题来决定是否使用综合标签：

问题1：本题是否有 2 个来自不同二级模块的关键知识？
  → 如"全等三角形"和"平面直角坐标系"来自不同二级模块。是/否
问题2：单个已有标签能否完整覆盖本题的核心任务？
  → 如果只标"全等三角形"就能说清本题考什么。能/不能
问题3：两个关键知识之间有协同关系（不是简单并列）？
  → 两个知识在同一解题链中协作，不是独立的两问。是/否

如果 3 题都回答"是"，则在输出中添加综合标签（在 knowledge 中加第二条，level3填"XX综合"）。

题目内容：
{stem_text}{analysis_block}{answer_block}

请按以下 JSON 格式输出最终结果，**只输出 JSON 数组**：
[
  {{
    "level1": "一级分类",
    "level2": "二级分类",
    "level3": ["三级标签"],
    "level4": []
  }}
]

规则：
1. 按上述5步逐步推理
2. 只标注题目直接考察的知识点，解题过程中用到的计算不标
3. level4 可选，不需要时留空数组 []
4. 综合标签同一道题最多 1 条，且必须有第5步的 3 个"是"才添加"""

    return prompt


def call_llm(prompt, api_key):
    """调用通义千问 API"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": API_MODEL,
        "messages": [
            {"role": "system", "content": "你是一个初中数学知识点标注助手，只输出 JSON。"},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 2000
    }

    resp = requests.post(API_URL, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]

    # 尝试解析 JSON（LLM 可能额外包了 markdown 代码块）
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]

    # 如果 LLM 输出带前导文字，提取 JSON 数组部分
    content = content.strip()
    start = content.find("[")
    end = content.rfind("]")
    if start != -1 and end != -1 and end > start:
        content = content[start:end+1]

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # 截断兜底：如果数组被截断，尝试修复
        # 找到最后一个完整的 {...}，去掉后面的不完整内容
        last_close = content.rfind("}")
        if last_close > 0:
            fixed = content[:last_close + 1] + "]"
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass
        # 最后手段：尝试找到最后一个对括号之间的部分
        for sep in ["},", "}\n"]:
            parts = content.split(sep)
            if len(parts) > 1:
                fixed_cont = sep.join(parts[:-1]) + "}]" if content.strip().endswith("]") else sep.join(parts[:-1]) + "}"
                try:
                    return json.loads(fixed_cont)
                except json.JSONDecodeError:
                    continue
        raise


def _normalize_knowledge(knowledge):
    """将 LLM 输出统一为 level1/level2/level3/level4 格式"""
    # 建立 3级 和 4级 路径查找表
    path_map_3 = {}
    path_map_4 = {}
    for item in KNOWLEDGE_TREE:
        l1, l2, l3, l4 = item
        path_map_3[f'{l1} > {l2} > {l3}'] = item
        if l4:
            path_map_4[f'{l1} > {l2} > {l3} > {l4}'] = item

    result = []
    for item in knowledge:
        if isinstance(item, dict):
            l1 = item.get("level1", "")
            l2 = item.get("level2", "")
            l3_list = item.get("level3", [])
            l4_list = item.get("level4", [])
            if isinstance(l3_list, str): l3_list = [l3_list]
            if isinstance(l4_list, str): l4_list = [l4_list]

            l3 = l3_list[0] if l3_list else ""
            l4 = l4_list[0] if l4_list else ""

            # 优先匹配4级路径
            if l4:
                fp = f'{l1} > {l2} > {l3} > {l4}'
                if fp in path_map_4:
                    _, _, cl3, cl4 = path_map_4[fp]
                    result.append({"level1": l1, "level2": l2, "level3": [cl3], "level4": [cl4]})
                    continue

            # 匹配3级路径
            if l3:
                fp = f'{l1} > {l2} > {l3}'
                if fp in path_map_3:
                    _, _, _, cl4 = path_map_3[fp]
                    result.append({"level1": l1, "level2": l2, "level3": [l3], "level4": [cl4] if cl4 else []})
                    continue

                # LLM 可能把 level4 的内容当成了 level3 输出
                # 在 path_map_4 中查找 l3 是否是一个 level4
                for fp4, (p1, p2, p3, p4) in path_map_4.items():
                    if p4 == l3 and p2 == l2:
                        result.append({"level1": p1, "level2": p2, "level3": [p3], "level4": [p4]})
                        break
                else:
                    # 最后的匹配：检查 l3 是否是某个 level4 的子串
                    for fp4, (p1, p2, p3, p4) in path_map_4.items():
                        if (p4 in l3 or l3 in p4) and p2 == l2:
                            result.append({"level1": p1, "level2": p2, "level3": [p3], "level4": [p4]})
                            break

    return result


def tag_knowledge(question, api_key):
    """对一道题进行知识点标注"""
    prompt = build_knowledge_prompt(question)
    try:
        result = call_llm(prompt, api_key)
        if isinstance(result, list):
            stem_text = "\n".join(question.get("paras_with_math", []))
            normalized = _normalize_knowledge(result)
            fixed = _fix_known_errors(normalized, stem_text)
            with_comprehensive = _add_comprehensive_tag(fixed)
            return _dedup_knowledge(with_comprehensive)
        return []
    except Exception as e:
        print(f"  LLM 标注失败: {e}")
        return []


# 图形的性质 + 图形的变化的二级模块，用于「函数与几何综合」匹配
_GEOMETRY_L2S = sorted({
    l2 for l1, l2, _, _ in KNOWLEDGE_TREE if l1 in ('图形的性质', '图形的变化')
})

# 二级模块 → 综合标签映射
_COMPREHENSIVE_MAP = [
    ('坐标几何综合', '同领域综合', '坐标与变换综合', ['平面直角坐标系', '坐标表示位置'], ['三角形', '四边形']),
    ('三角形综合', '同领域综合', '三角形与四边形综合', ['三角形'], ['四边形']),
    ('全等与相似综合', '跨领域综合', '几何跨模块', ['全等'], ['相似']),
    ('圆与三角形综合', '同领域综合', '圆综合', ['圆'], ['三角形']),
    ('圆与四边形综合', '同领域综合', '圆综合', ['圆'], ['四边形']),
    ('多函数综合', '同领域综合', '代数与函数综合', ['一次函数', '二次函数', '反比例函数', '函数基础知识'], ['一次函数', '二次函数', '反比例函数', '函数基础知识']),
    ('函数与几何综合', '跨领域综合', '函数与其他领域', ['一次函数', '二次函数', '反比例函数'], _GEOMETRY_L2S),
    ('函数与方程不等式综合', '跨领域综合', '函数与其他领域', ['一次函数', '二次函数', '反比例函数'], ['方程']),
    ('统计与概率综合', '同领域综合', '统计概率综合', ['统计'], ['概率']),
]


def _add_comprehensive_tag(knowledge):
    """后处理：当题目有多个不同二级模块的知识点时，添加综合标签"""
    if len(knowledge) < 2:
        return knowledge

    # 提取所有 level2
    l2_set = set()
    for k in knowledge:
        l2 = k.get('level2', '')
        l2_set.add(l2)

    if len(l2_set) < 2:
        return knowledge

    # 已有综合标签则跳过
    if any(k.get('level1') == '综合题' for k in knowledge):
        return knowledge
    # 查找匹配的综合标签。要求两组各命中至少一个二级模块，且命中模块
    # 总数 >= 2 —— 否则「多函数综合」（两组同为函数列表）会被单个函数
    # 标签同时命中两组而误标（如 一次函数+三角形 → 误标为多函数综合）。
    for name, zt_l2, zt_l3, group_a, group_b in _COMPREHENSIVE_MAP:
        match_a = {l2 for l2 in l2_set if any(kw in l2 for kw in group_a)}
        match_b = {l2 for l2 in l2_set if any(kw in l2 for kw in group_b)}
        if match_a and match_b and len(match_a | match_b) >= 2:
            knowledge.append({"level1": "综合题", "level2": zt_l2, "level3": [zt_l3], "level4": [name]})
            return knowledge

    return knowledge


def _fix_known_errors(knowledge, stem_text):
    """修正已知的 LLM 错误模式"""
    for k in knowledge:
        l3 = (k.get('level3') or [''])[0]
        l4 = (k.get('level4') or [''])[0]
        if '公因式' in stem_text and '提公因式' not in str(k):
            k['level3'] = ['因式分解方法']; k['level4'] = ['提公因式法与综合分解']; break
        if '高' in stem_text and '画出' in stem_text and l4 != '三角形的高与垂心':
            k['level3'] = ['与三角形有关的线段']; k['level4'] = ['三角形的高与垂心']; break
    return knowledge



def _dedup_knowledge(knowledge):
    if len(knowledge) <= 1:
        return knowledge
    zt = [k for k in knowledge if k['level1'] == '综合题']
    base = [k for k in knowledge if k['level1'] != '综合题']
    if not base:
        return knowledge
    order = ['数与式', '方程与不等式', '函数', '图形的性质', '图形的变化', '统计与概率']
    def cr(l1): return order.index(l1) if l1 in order else -1
    l1s = set(k['level1'] for k in base)
    has_geo = any(l1 in {'图形的性质', '图形的变化'} for l1 in l1s)
    has_alg = any(l1 in {'数与式', '方程与不等式', '函数'} for l1 in l1s)
    result = []
    if has_geo and has_alg:
        gs = [k for k in base if k['level1'] in {'图形的性质', '图形的变化'}]
        if gs: result.append(max(gs, key=lambda k: cr(k['level1'])))
        al = [k for k in base if k['level1'] in {'数与式', '方程与不等式', '函数'}]
        if al: result.append(max(al, key=lambda k: cr(k['level1'])))
    else:
        result.append(max(base, key=lambda k: cr(k['level1'])))
    result.extend(zt)
    return result


if __name__ == "__main__":
    # 验证模块可正常导入
    from pipeline.llm_tagger import tag_knowledge
    print("llm_tagger 模块导入成功")
    print(f"build_knowledge_prompt 签名可调用 (不实际调用 API)")
