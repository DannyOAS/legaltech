"""Ontario case deadline calculator."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List


@dataclass
class Deadline:
    name: str
    due_date: date
    rule_reference: str
    description: str
    priority: str = "medium"


# Ontario Rules of Civil Procedure deadline mappings
ONTARIO_DEADLINES = {
    "statement_of_claim": [
        (20, "Statement of Defence", "Rule 18.01", "Defendant must serve statement of defence", "high"),
        (30, "Default Judgment Available", "Rule 19.02", "Plaintiff may move for default judgment", "medium"),
    ],
    "statement_of_defence": [
        (10, "Reply to Defence", "Rule 25.01", "Plaintiff may serve reply if desired", "low"),
        (30, "Case Management Conference", "Rule 77.03", "Court may schedule case management", "medium"),
    ],
    "motion": [
        (4, "Responding Motion Record", "Rule 39.01(4)", "Responding party must serve motion record", "high"),
        (2, "Factum Filing", "Rule 38.09", "Factums must be filed with court", "medium"),
    ],
    "examination_for_discovery": [
        (30, "Undertakings Compliance", "Rule 31.07", "Complete undertakings given on discovery", "high"),
        (60, "Refusals Motion Deadline", "Rule 34.15", "Move to compel answers to refused questions", "medium"),
    ],
    "trial_scheduling": [
        (-30, "Trial Record Filing", "Rule 48.03", "Trial record must be filed 30 days before trial", "high"),
        (-10, "Witness List Exchange", "Rule 53.03", "Exchange witness lists", "medium"),
        (-5, "Document Brief Filing", "Rule 53.02", "File document brief", "medium"),
    ],
}

COURT_VARIATIONS = {
    "ONSC": {"multiplier": 1.0, "additional_days": 0},
    "ONCA": {"multiplier": 0.8, "additional_days": -5},  # Court of Appeal is faster
    "ONSCJ": {"multiplier": 1.2, "additional_days": 5},  # Small Claims is more relaxed
    "FAMILY": {"multiplier": 0.9, "additional_days": 0},  # Family court
}


def calculate_deadlines(event_type: str, filing_date: date, court: str = "ONSC") -> List[Deadline]:
    """Calculate legal deadlines based on Ontario Rules of Civil Procedure."""
    deadlines = []
    base_rules = ONTARIO_DEADLINES.get(event_type.lower(), [])
    
    if not base_rules:
        # Default fallback for unknown event types
        base_date = filing_date + timedelta(days=30)
        return [Deadline(
            name=f"{event_type} response deadline",
            due_date=base_date,
            rule_reference=f"{court}-General",
            description="General response deadline",
            priority="medium"
        )]
    
    court_config = COURT_VARIATIONS.get(court.upper(), COURT_VARIATIONS["ONSC"])
    
    for base_days, name, rule_ref, description, priority in base_rules:
        # Apply court-specific adjustments
        adjusted_days = int(base_days * court_config["multiplier"]) + court_config["additional_days"]
        
        # Handle negative days (deadlines before the event)
        if adjusted_days < 0:
            due_date = filing_date - timedelta(days=abs(adjusted_days))
        else:
            due_date = filing_date + timedelta(days=adjusted_days)
        
        # Skip weekends (simple weekend adjustment)
        while due_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
            due_date += timedelta(days=1)
        
        deadlines.append(Deadline(
            name=name,
            due_date=due_date,
            rule_reference=rule_ref,
            description=description,
            priority=priority
        ))
    
    return sorted(deadlines, key=lambda d: d.due_date)
