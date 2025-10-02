"""DocuSign integration stub."""

from __future__ import annotations

from typing import Dict


def send_envelope(document_id: str, recipients: list[Dict[str, str]]) -> Dict[str, str]:
    return {"status": "sent", "envelope_id": f"env_{document_id}"}


def handle_webhook(payload: Dict[str, str]) -> None:
    # Placeholder for DocuSign webhook processing.
    return None
