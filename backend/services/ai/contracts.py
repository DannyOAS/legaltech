"""Contract analysis interface for Ontario legal review."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class ClauseCheck:
    name: str
    patterns: List[str]
    required: bool = True
    description: str = ""


@dataclass
class RiskPattern:
    name: str
    patterns: List[str]
    severity: str = "medium"
    description: str = ""


# Ontario-specific contract requirements
ONTARIO_ESSENTIAL_CLAUSES = [
    ClauseCheck(
        name="Governing Law",
        patterns=[r"governed?\s+by.*ontario", r"laws?\s+of.*ontario", r"ontario.*jurisdiction"],
        required=True,
        description="Contract should specify Ontario law governs"
    ),
    ClauseCheck(
        name="Dispute Resolution",
        patterns=[r"dispute.*resolution", r"arbitration", r"mediation", r"litigation"],
        required=True,
        description="Method for resolving disputes must be specified"
    ),
    ClauseCheck(
        name="Termination Clause",
        patterns=[r"terminat(e|ion)", r"end.*agreement", r"expire|expiry"],
        required=True,
        description="Clear termination conditions required"
    ),
    ClauseCheck(
        name="Limitation of Liability",
        patterns=[r"limitation.*liability", r"exclude.*liability", r"damages.*limited"],
        required=True,
        description="Liability limitations should be clearly defined"
    ),
    ClauseCheck(
        name="Confidentiality",
        patterns=[r"confidential", r"non.?disclosure", r"proprietary.*information"],
        required=True,
        description="Confidentiality obligations should be specified"
    ),
    ClauseCheck(
        name="Intellectual Property",
        patterns=[r"intellectual.*property", r"copyright", r"trademark", r"patent"],
        required=False,
        description="IP ownership and licensing terms"
    ),
    ClauseCheck(
        name="Force Majeure",
        patterns=[r"force.*majeure", r"act.*god", r"unforeseeable.*circumstances"],
        required=False,
        description="Protection against unforeseeable events"
    ),
]

# High-risk terms that require legal review
RISK_PATTERNS = [
    RiskPattern(
        name="Unlimited Personal Liability",
        patterns=[r"personal.*guarantee", r"unlimited.*liability", r"personally.*liable"],
        severity="high",
        description="Personal liability exposure detected"
    ),
    RiskPattern(
        name="Perpetual Obligations",
        patterns=[r"perpetual", r"indefinite.*term", r"no.*expiry"],
        severity="high",
        description="Obligations may continue indefinitely"
    ),
    RiskPattern(
        name="Broad Indemnification",
        patterns=[r"indemnif\w+", r"hold.*harmless", r"defend.*claims"],
        severity="medium",
        description="Indemnification obligations require review"
    ),
    RiskPattern(
        name="Exclusive Dealing",
        patterns=[r"exclusive.*dealing", r"sole.*provider", r"exclusivity"],
        severity="medium",
        description="Exclusive arrangements limit business flexibility"
    ),
    RiskPattern(
        name="Automatic Renewal",
        patterns=[r"automatic.*renew", r"auto.?renew", r"unless.*terminat"],
        severity="medium",
        description="Contract may renew automatically"
    ),
    RiskPattern(
        name="Assignment Restrictions",
        patterns=[r"not.*assign", r"prohibit.*assignment", r"consent.*assign"],
        severity="low",
        description="Assignment rights may be limited"
    ),
    RiskPattern(
        name="Penalty Clauses",
        patterns=[r"penalty", r"liquidated.*damages", r"punitive.*damages"],
        severity="high",
        description="Financial penalties may apply for breach"
    ),
]


def analyze_contract(text: str, jurisdiction: str = "ON") -> Dict[str, any]:
    """Analyze contract text for Ontario legal compliance."""
    normalized_text = text.lower()
    
    # Check for essential clauses
    missing_clauses = []
    found_clauses = []
    
    for clause in ONTARIO_ESSENTIAL_CLAUSES:
        found = any(re.search(pattern, normalized_text, re.IGNORECASE) for pattern in clause.patterns)
        if found:
            found_clauses.append({
                "name": clause.name,
                "description": clause.description,
                "required": clause.required
            })
        elif clause.required:
            missing_clauses.append({
                "name": clause.name,
                "description": clause.description,
                "importance": "high" if clause.required else "medium"
            })
    
    # Check for risky terms
    risky_terms = []
    for risk in RISK_PATTERNS:
        if any(re.search(pattern, normalized_text, re.IGNORECASE) for pattern in risk.patterns):
            risky_terms.append({
                "name": risk.name,
                "severity": risk.severity,
                "description": risk.description
            })
    
    # Calculate overall risk score
    risk_score = 0
    for risk in risky_terms:
        if risk["severity"] == "high":
            risk_score += 3
        elif risk["severity"] == "medium":
            risk_score += 2
        else:
            risk_score += 1
    
    # Add missing clause penalty
    risk_score += len(missing_clauses) * 2
    
    # Overall assessment
    if risk_score >= 10:
        overall_risk = "high"
        recommendation = "Requires comprehensive legal review before execution"
    elif risk_score >= 5:
        overall_risk = "medium"
        recommendation = "Legal review recommended for identified issues"
    else:
        overall_risk = "low"
        recommendation = "Standard commercial terms, minimal legal concerns"
    
    return {
        "jurisdiction": jurisdiction,
        "overall_risk": overall_risk,
        "risk_score": risk_score,
        "recommendation": recommendation,
        "missing_clauses": missing_clauses,
        "found_clauses": found_clauses,
        "risky_terms": risky_terms,
        "summary": {
            "total_clauses_checked": len(ONTARIO_ESSENTIAL_CLAUSES),
            "clauses_found": len(found_clauses),
            "required_clauses_missing": len(missing_clauses),
            "risk_factors_identified": len(risky_terms)
        }
    }
