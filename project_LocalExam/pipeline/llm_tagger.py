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
2. 可以标多个 level3，也可以只标一个
3. 如果题目涉及多个章节，可以标多条 knowledge
4. level3 是数组，可以放多个子知识点
5. 只从给定的树里选，不要发明不在树上的知识点
6. level3 中的子知识点必须在树上属于对应的 level2"""

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
        "max_tokens": 500
    }

    resp = requests.post(API_URL, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()

    content = resp.json()["choices"][0]["message"]["content"]

    # 尝试解析 JSON（LLM 可能额外包了 markdown 代码块）
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        content = content.rsplit("```", 1)[0]

    return json.loads(content.strip())


def tag_knowledge(question, api_key):
    """对一道题进行知识点标注"""
    prompt = build_knowledge_prompt(question)
    try:
        result = call_llm(prompt, api_key)
        if isinstance(result, list):
            return result
        return []
    except Exception as e:
        print(f"  LLM 标注失败: {e}")
        return []


if __name__ == "__main__":
    # 验证模块可正常导入
    from pipeline.llm_tagger import tag_knowledge
    print("llm_tagger 模块导入成功")
    print(f"build_knowledge_prompt 签名可调用 (不实际调用 API)")
