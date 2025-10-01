"""Minimal TOTP helpers without external dependencies."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from urllib.parse import quote


def _normalise_secret(secret: str) -> bytes:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    return base64.b32decode((secret + padding).upper())


def generate_secret(length: int = 20) -> str:
    raw = os.urandom(length)
    return base64.b32encode(raw).decode("utf-8").strip("=")


def generate_totp(secret: str, interval: int = 30, for_time: int | None = None) -> str:
    if for_time is None:
        for_time = int(time.time())
    counter = int(for_time // interval)
    key = _normalise_secret(secret)
    msg = counter.to_bytes(8, "big")
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (int.from_bytes(digest[offset : offset + 4], "big") & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def verify_totp(secret: str, token: str, *, interval: int = 30, window: int = 1) -> bool:
    if len(token) != 6 or not token.isdigit():
        return False
    current_time = int(time.time())
    for offset in range(-window, window + 1):
        code = generate_totp(secret, interval=interval, for_time=current_time + offset * interval)
        if hmac.compare_digest(code, token):
            return True
    return False


def provisioning_uri(secret: str, *, name: str, issuer: str, interval: int = 30) -> str:
    label = quote(f"{issuer}:{name}")
    issuer_escaped = quote(issuer)
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={issuer_escaped}&period={interval}"
    )
