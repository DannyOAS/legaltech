"""Ontario case deadline calculator stub."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List


@dataclass
class Deadline:
    name: str
    due_date: date
    rule_reference: str


def calculate_deadlines(event_type: str, filing_date: date, court: str = "ONSC") -> List[Deadline]:
    base = filing_date + timedelta(days=30)
    return [Deadline(name=f"{event_type} response", due_date=base, rule_reference=f"{court}-R1")] 
