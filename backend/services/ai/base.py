"""AI provider interface and loader."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from django.conf import settings


class AIProvider(Protocol):
    def summarize(self, text: str) -> str: ...

    def extract_entities(self, text: str) -> dict: ...


@dataclass
class MockProvider:
    def summarize(self, text: str) -> str:
        return text[:200] + ("..." if len(text) > 200 else "")

    def extract_entities(self, text: str) -> dict:
        return {"length": len(text)}


def get_provider() -> AIProvider:
    if settings.AI_PROVIDER == "mock":
        return MockProvider()
    raise NotImplementedError(f"Unknown AI provider {settings.AI_PROVIDER}")
