"""Contract analysis interface for future AI module."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

CHECKLIST = {
    "confidentiality": "confidentiality",
    "termination": "termination",
    "governing law": "governing law",
    "limitation of liability": "limitation of liability",
}

RISK_TERMS = {
    "indemnify": "Indemnification clause detected",
    "perpetual": "Perpetual obligation detected",
    "exclusive": "Exclusive rights language detected",
}


def analyze_contract(text: str, jurisdiction: str = "ON") -> Dict[str, List[str]]:
    normalized = text.lower()
    missing = [label for label, needle in CHECKLIST.items() if needle not in normalized]
    risky = [message for needle, message in RISK_TERMS.items() if needle in normalized]
    return {
        "jurisdiction": jurisdiction,
        "missing_clauses": missing,
        "risky_terms": risky,
    }
