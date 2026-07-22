"""步骤4：调用通义千问 API 标注知识点"""

import json
import requests

from pipeline.config import API_URL, API_MODEL, KNOWLEDGE_TREE


def build_knowledge_prompt(question):
    """构造知识点标注 prompt"""
    # 展开知识树为文本
    tree_lines = []
    for l1, l2, l3 in KNOWLEDGE_TREE:
        tree_lines.append(f"  {l1} > {l2} > {l3}")
    tree_text = "\n".join(tree_lines)

    # 题目内容
    paras = question.get("paras_with_math", [])
    stem_text = "\n".join(paras)

    prompt = f"""你是一名初中数学教师，请为以下题目匹配最合适的知识点标签。

知识树（从以下节点中选择，不要发明不在树上的节点）：
{tree_text}

题目内容：
{stem_text}

请输出 JSON 格式的知识点标注，**只输出 JSON 数组**，不要多余文字：
[
  {{
    "level1": "第XX章 XXX",
    "level2": "XXX",
    "level3": ["子知识点1", "子知识点2"]
  }}
]

规则：
1. 从以上知识树中选择最匹配的节点
2. level3 只选 1-2 个最相关的子知识点，不要全列
3. 如果题目涉及多个章节，可以标多条 knowledge
4. level3 是字符串数组
5. 只从给定的树里选，不要发明不在树上的知识点"""

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
    """将 LLM 输出统一为 level1/level2/level3 格式

    LLM 可能返回三种格式：
    1. [{"level1":"第13章...","level2":"...","level3":["..."]}]  ← 标准格式
    2. ["第13章 > ... > ...", ...]  ← 路径字符串数组（来自"知识点标签"格式）
    3. [{"level1":"第X章 因式分解",...}]  ← 章名可能简称
    """
    # 建立路径查找表
    path_map = {}
    for l1, l2, l3 in KNOWLEDGE_TREE:
        path_map[f'{l1} > {l2} > {l3}'] = (l1, l2, l3)

    result = []
    for item in knowledge:
        if isinstance(item, dict):
            # 标准格式：直接使用
            l1 = item.get("level1", "")
            l2 = item.get("level2", "")
            l3 = item.get("level3", [])
            if isinstance(l3, str):
                l3 = [l3]
            if l1 and l2 and l3:
                result.append({"level1": l1, "level2": l2, "level3": l3})

        elif isinstance(item, str):
            # 路径字符串格式：查找映射
            if item in path_map:
                l1, l2, l3 = path_map[item]
                result.append({"level1": l1, "level2": l2, "level3": [l3]})
            else:
                # 尝试模糊匹配
                for key, (l1, l2, l3_v) in path_map.items():
                    if l3_v in item or item.endswith(l3_v):
                        result.append({"level1": l1, "level2": l2, "level3": [l3_v]})
                        break

    return result


def tag_knowledge(question, api_key):
    """对一道题进行知识点标注"""
    prompt = build_knowledge_prompt(question)
    try:
        result = call_llm(prompt, api_key)
        if isinstance(result, list):
            return _normalize_knowledge(result)
        return []
    except Exception as e:
        print(f"  LLM 标注失败: {e}")
        return []


if __name__ == "__main__":
    # 验证模块可正常导入
    from pipeline.llm_tagger import tag_knowledge
    print("llm_tagger 模块导入成功")
    print(f"build_knowledge_prompt 签名可调用 (不实际调用 API)")
