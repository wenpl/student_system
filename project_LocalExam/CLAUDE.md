# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**初中数学题库构建工具** — 将 DOCX 试卷按题目拆分，为每题标注知识点，输出可迁移的结构化 JSON 文件。

核心目标：项目内所有 DOCX 试卷拆分为题目，合并输出一份总 JSON，每条题目包含来源信息、题型、题干、知识点标签，实现试卷数据的结构化存储和跨系统迁移。

## Repository Structure

```
d:/claude/project_LocalExam/         # ← 当前仓库
├── 解析版/                           # 解析版 DOCX（14份，含13份解析版+1份模拟卷）
├── 规范/                             # 知识结构和 JSON 规范
│   ├── 知识点层级结构.md              # 章节→知识点→子知识点树（第13-18章）
│   └── 题库JSON字段定义.md            # 题库 JSON schema 完整定义
├── skills-lock.json                  # Matt Pocock 技能锁文件
├── pipeline/                          # 题库构建 Pipeline
│   ├── config.py                      # 配置（路径、API、知识点树）
│   ├── docx_parser.py                 # DOCX 解析、OMML→LaTeX、图片提取
│   ├── llm_tagger.py                  # LLM 知识点标注（通义千问 API）
│   ├── builder.py                     # 主流程编排 + JSON 组装
│   ├── main.py                        # 入口
│   └── test_pipeline.py               # 端到端测试
├── output/                            # 输出（git ignored）
│   ├── exam_questions.json            # 总 JSON（332题，含知识点标注）
│   └── images/                        # 按 question_id 命名的图片
└── CLAUDE.md                         # 本文件
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
- `source` — 来源信息（区/年/学期/考试类型/文件名/paper_id）
- `number` — 题号（数字）
- `question_type` — `"选择题"` / `"填空题"` / `"解答题"`
- `knowledge` — 知识点标注（level1/level2/level3，支持多条）
- `status` — `"success"` / `"failed"`
- `content` — 题干（`stem`）+ 选项/子问（含 LaTeX 公式，用 `$...$` 包裹）

### 知识点层级（详见 `规范/知识点层级结构.md`）

覆盖人教版八年级数学第 13-18 章：
| 章 | 内容 |
|---|------|
| 第13章 | 三角形（概念、三边关系、重要线段、内角和外角） |
| 第14章 | 全等三角形（判定SSS/SAS/ASA/AAS/HL、角平分线） |
| 第15章 | 轴对称（图形、垂直平分线、等腰/等边三角形） |
| 第16章 | 整式的乘法（幂运算、平方差/完全平方公式） |
| 第17章 | 因式分解（提公因式、公式法） |
| 第18章 | 分式（运算、分式方程） |

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

### API 配置

编辑 `pipeline/config.py`：
- `API_KEY` — 通义千问 API Key（设为空则跳过 LLM 标注）
- `API_URL` — 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- `API_MODEL` — 默认 `qwen-vl-plus`

### Pipeline 步骤

1. **正则切题** — 按题号 `\d+[．\.]` 切割，识别大题标题（一/二/三）
2. **OMML→LaTeX** — DOCX 中的数学公式自动转换，`$...$` 包裹
3. **图片提取** — 按 `question_id` 命名存入 `images/` 目录
4. **LLM 知识点标注** — 通义千问 API 标注 level1/level2/level3
5. **JSON 组装** — 输出 `output/exam_questions.json`

### 当前输出（2026-07-22）

- 14 份 DOCX → **332 题**
- 题型：138 选择题 + 83 填空题 + 99 解答题 + 12 无类型（模拟卷）
- 知识点标注覆盖率：100%（332/332）
- JSON 大小：~380KB
