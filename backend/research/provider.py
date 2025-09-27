"""AI legal research interfaces."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class Result:
    id: str
    title: str
    citation: str


def search_cases(query: str) -> List[Result]:
    return [Result(id="case-1", title=f"Stub result for {query}", citation="2024 ONSC 1")]


def summarize(case_id: str) -> str:
    return f"Summary for {case_id} is not yet implemented."
