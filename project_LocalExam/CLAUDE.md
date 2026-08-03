# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**初中数学题库构建工具** — 将 DOCX 试卷按题目拆分，为每题标注知识点，输出可迁移的结构化 JSON 文件。

核心目标：项目内所有 DOCX 试卷拆分为题目，合并输出一份总 JSON，每条题目包含来源信息、题型、题干、知识点标签，实现试卷数据的结构化存储和跨系统迁移。

## Repository Structure

```
d:/claude/project_LocalExam/         # ← 当前仓库
├── 解析版/                           # 解析版 DOCX
├── 规范/                             # 知识结构和 JSON 规范
│   ├── 知识点层级结构.md              # 4 级知识点树（299条，含综合题标签）
│   └── 题库JSON字段定义.md            # 题库 JSON schema 完整定义
├── pipeline/                          # 题库构建 Pipeline
│   ├── config.py                      # 配置（路径、API、299条4级知识点树）
│   ├── docx_parser.py                 # DOCX 解析、OMML→LaTeX、图片提取
│   ├── llm_tagger.py                  # LLM 知识点标注（通义千问 API）
│   ├── builder.py                     # 主流程编排 + JSON 组装
│   ├── main.py                        # 入口
│   └── test_pipeline.py               # 端到端测试
├── output/                            # 输出（git ignored）
│   ├── exam_questions.json            # 总 JSON（418题，含知识点标注）
│   ├── images/                        # 按 question_id 命名的图片
│   ├── index.html                     # 题库 HTML 浏览器（双击打开）
│   └── label_tool.html                # 标注校对工具（双击打开）
├── skills-lock.json                   # Matt Pocock 技能锁文件
└── CLAUDE.md                          # 本文件
```

## 核心目标

项目内所有 DOCX 试卷经过拆分处理，最终合并输出为**一份总 JSON 文件**，结构自包含，可在不同系统间迁移使用。

### 题型覆盖
| 题型 | 字段特征 |
|:--|:--|
| 选择题 | 有 `content.options[]`（label + latex）|
| 填空题 | 仅有 `content.stem`，无 options 和 sub_questions |
| 解答题 | 有 `content.sub_questions[]`（number + latex）|

### 题库 JSON 字段（详见 `规范/题库JSON字段定义.md`）

每条题目是一个 JSON 对象，包含：
- `question_id` — UUID v4
- `source` — 来源信息（区/年/学期/考试类型/文件名）
- `number` — 题号（数字）
- `question_type` — `"选择题"` / `"填空题"` / `"解答题"`
- `knowledge` — 知识点标注（level1/level2/level3/level4，支持多条，4级可选）
- `status` — `"success"` / `"failed"`
- `content` — 题干（`stem`）+ 选项/子问（含 LaTeX 公式，用 `$...$` 包裹）

### 知识点层级

4 级结构，**299 条**标签，覆盖 6 个一级分类 + 综合题标签：

| 一级分类 | 标签数 |
|:--------|:------:|
| 数与式 | 78 |
| 方程与不等式 | 32 |
| 函数 | 34 |
| 图形的性质 | 89 |
| 图形的变化 | 30 |
| 统计与概率 | 20 |
| 综合题（标签） | 15 |

## DOCX 命名规则

```
精品解析：天津市{区名}{学年}学年{学期}{年级}数学{考试类型}试卷（{版本}）.docx
```

- 区名：南开 / 河西 / 河东 / 河北 / 红桥 / 滨海 / 和平 / 部分区
- 版本：解析版（带答案和解析）/ 原卷版（仅试题）
- 示例：`精品解析：天津市南开区2025-2026学年上学期八年级数学期末试卷（解析版）.docx`

## 输出 JSON 要求

- 符合 `规范/题库JSON字段定义.md` 的 schema
- `question_id` 使用 UUID v4
- 图片路径使用相对路径
- 文本统一用含 LaTeX 格式存储（`$...$` 包裹公式）
- 不存 `answer` 和 `solution` 字段
- 一份项目总 JSON 文件，包含所有试卷的全部题目，可独立迁移使用

## Pipeline 使用

### 运行全量（需配置 API Key）

```bash
cd d:/claude/project_LocalExam
python pipeline/main.py
```

### 运行测试（不调 LLM）

```bash
python pipeline/test_pipeline.py
```

### 更新知识树

`KNOWLEDGE_TREE` 硬编码在 `pipeline/config.py`（299 条 4 级标签）。改动知识树时，
以 `规范/知识点层级结构.md` 为准**手工同步** config.py 中的列表
（`规范/` 下 `new_tree_from_md.py` 等脚本为历史快照，不自动生效）。

### 浏览题库 HTML

直接双击 `output/index.html` 即可打开（数据已嵌入 HTML，无需 HTTP 服务器）。

### 标注校对工具

双击 `output/label_tool.html` 打开，可逐题校对知识点标签，修改后自动下载修正后的 JSON。

### API 配置

编辑 `pipeline/config.py`：
- `API_KEY` — 通义千问 API Key（设为空则跳过 LLM 标注）
- `API_URL` — 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- `API_MODEL` — 默认 `qwen-plus`

### Pipeline 流程

```
DOCX → 正则切题 → OMML→LaTeX → 图片提取
                              ↓
                     捕获解析文本（【解析】中的知识点说明）
                              ↓
                     分层 prompt（5步推理）
                       第1步：选一级分类
                       第2步：选二级分类
                       第3步：选三级标签
                       第4步：选四级标签（可选）
                       第5步：判断是否需要综合标签
                              ↓
                     LLM 标注 → 输出 JSON
                              ↓
                     _normalize_knowledge（校验组合合法性）
                              ↓
                     _fix_known_errors（修正已知错误模式）
                              ↓
                     _add_comprehensive_tag（自动添加综合标签，两组关键字各命中至少一个）
                              ↓
                     _dedup_knowledge（跨章去重，保留综合标签+基础标签）
                              ↓
                     JSON 组装
```

### 核心模块说明

| 模块 | 功能 |
|------|------|
| `config.py` | 路径、API 配置、299 条 4 级知识点树（硬编码，与 `规范/知识点层级结构.md` 对应）|
| `docx_parser.py` | `parse_docx()` 解析切割 + `omml_to_latex()` 公式转换 + `extract_images()` 图片提取 + `_capture_analysis()` 捕获解析文本 + `_capture_answer()` 捕获答案 |
| `llm_tagger.py` | `tag_knowledge()` 分层 prompt 推理。含 `_normalize_knowledge()` 组合校验、`_fix_known_errors()` 后处理修正、`_add_comprehensive_tag()` 综合标签后处理（两组关键字各命中一个才加）、`_dedup_knowledge()` 跨章去重（保留综合标签） |
| `builder.py` | `build_all()` 遍历所有 DOCX，`process_one_docx()` 处理单份，输出带顶层包装的 JSON |
| `main.py` | 入口，调用 `build_all()` |
| `test_pipeline.py` | 3 项测试：解析验证、图片提取、文件名解析 |

### 当前输出（2026-07-29）

- 18 份 DOCX → **418 题**
- 覆盖七、八、九年级，含和平、南开、河东、河北、河西、红桥 6 区
- 知识点标注覆盖率：**98%**（408/418）
- 知识树：299 条 4 级标签（含 15 条综合题标签）
- 综合标签已自动应用，有基础标签+综合标签双标
- JSON 大小：~400KB
- 浏览器：`output/index.html`（双击打开）+ KaTeX 渲染 + 按领域/题型筛选
- 公式支持：分数、上下标、根式、**行列式（2×2矩阵）**、**①②③ 圈码**、**循环小数**
