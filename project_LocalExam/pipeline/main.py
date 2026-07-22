"""题库构建 Pipeline 入口

用法：
    python pipeline/main.py
"""

import sys
import os

# 确保项目根目录在模块搜索路径中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.builder import build_all


def main():
    """主入口：遍历 解析版/ 下所有 DOCX，汇总输出 exam_questions.json"""
    build_all()


if __name__ == "__main__":
    main()
