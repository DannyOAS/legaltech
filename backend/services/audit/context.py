"""Thread-local tenant context utilities."""
from __future__ import annotations

import contextvars

_current_org: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_org", default=None)


def set_current_org(org_id: str | None) -> None:
    _current_org.set(org_id)


def get_current_org() -> str | None:
    return _current_org.get()


def clear_current_org() -> None:
    _current_org.set(None)
