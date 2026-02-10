#!/usr/bin/env python3
"""Textree MVP: 输入词语，展示其在概念树中的来龙去脉。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

KB_PATH = Path(__file__).with_name("knowledge_base.json")


def load_nodes(path: Path = KB_PATH) -> dict[str, dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["nodes"]


def ancestry(nodes: dict[str, dict[str, Any]], word: str) -> list[str]:
    path = []
    current = word

    while current is not None:
        path.append(current)
        current = nodes[current].get("parent")

    return list(reversed(path))


def children(nodes: dict[str, dict[str, Any]], word: str) -> list[str]:
    return nodes[word].get("children", [])


def related(nodes: dict[str, dict[str, Any]], word: str) -> list[str]:
    return nodes[word].get("related", [])


def format_report(nodes: dict[str, dict[str, Any]], word: str) -> str:
    if word not in nodes:
        options = "、".join(sorted(nodes.keys()))
        return (
            f"❌ 未找到词语：{word}\n"
            f"你可以尝试这些词：{options}"
        )

    node = nodes[word]
    chain = " > ".join(ancestry(nodes, word))
    direct_children = children(nodes, word)
    rel_words = related(nodes, word)

    lines = [
        f"⚡ 词语：{word}",
        f"类型：{node.get('type', 'unknown')}",
        f"定义：{node.get('description', '暂无说明')}",
        f"全局路径：{chain}",
    ]

    if direct_children:
        lines.append(f"下位概念：{'、'.join(direct_children)}")
    else:
        lines.append("下位概念：无")

    if rel_words:
        lines.append(f"相关词：{'、'.join(rel_words)}")
    else:
        lines.append("相关词：无")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="输入一个词语，闪电般展示它在整体概念树中的上下文。"
    )
    parser.add_argument("word", help="要查询的词语，如：妈妈、看")
    args = parser.parse_args()

    nodes = load_nodes()
    print(format_report(nodes, args.word))


if __name__ == "__main__":
    main()
