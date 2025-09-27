"""Notification helpers for outbound email."""
from __future__ import annotations

from dataclasses import dataclass

from django.core.mail import EmailMessage


@dataclass
class EmailRequest:
    to: list[str]
    subject: str
    body: str


def send_email(request: EmailRequest) -> None:
    email = EmailMessage(request.subject, request.body, to=request.to)
    email.send(fail_silently=False)
