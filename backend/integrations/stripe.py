"""Stripe integration stubs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class StripeConnection:
    account_id: str
    livemode: bool


def connect_account(auth_code: str) -> StripeConnection:
    """Stub connection logic - replace with actual Stripe Connect flow."""
    return StripeConnection(account_id=f"acct_{auth_code[-8:]}", livemode=False)


def create_payment_intent(amount_cents: int, currency: str = "cad") -> Dict[str, Any]:
    return {
        "id": "pi_stub",
        "client_secret": "pi_client_secret_stub",
        "amount": amount_cents,
        "currency": currency,
    }
