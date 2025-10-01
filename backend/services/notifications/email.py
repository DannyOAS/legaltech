"""Notification helpers for outbound email."""
from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from django.core.mail import EmailMessage


def _default_from_email() -> str:
    return getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@maplelegal.local")


@dataclass
class EmailRequest:
    to: list[str]
    subject: str
    body: str


def send_email(request: EmailRequest) -> None:
    email = EmailMessage(request.subject, request.body, _default_from_email(), to=request.to)
    email.send(fail_silently=False)


def send_invitation_email(*, to: str, organization_name: str, role_name: str, invite_link: str, expires_at) -> None:
    subject = f"You're invited to {organization_name} on Maple Legal"
    body = (
        f"Hello,\n\n"
        f"You've been invited to join {organization_name} as a {role_name}.\n"
        f"Please create your account using the link below before {expires_at:%Y-%m-%d %H:%M %Z}.\n\n"
        f"{invite_link}\n\n"
        "If you were not expecting this invitation you can ignore this message."
    )
    send_email(EmailRequest(to=[to], subject=subject, body=body))


def send_document_uploaded_email(*, to: str, matter_title: str, filename: str, download_link: str | None = None) -> None:
    subject = f"New document available for {matter_title}"
    body = (
        f"Hello,\n\nA new document '{filename}' has been uploaded for matter {matter_title}."
    )
    if download_link:
        body += f"\nYou can access it here: {download_link}"
    body += "\n\nRegards,\nMaple Legal"
    send_email(EmailRequest(to=[to], subject=subject, body=body))


def send_invoice_created_email(*, to: str, matter_title: str, invoice_number: str, amount: str) -> None:
    subject = f"Invoice {invoice_number} for {matter_title}"
    body = (
        f"Hello,\n\nA new invoice {invoice_number} totalling {amount} is ready for matter {matter_title}."
        "\nPlease log in to your portal to review and pay.\n\nRegards,\nMaple Legal"
    )
    send_email(EmailRequest(to=[to], subject=subject, body=body))


def send_portal_message_email(*, to: str, matter_title: str) -> None:
    subject = f"New message on {matter_title}"
    body = (
        f"Hello,\n\nThere's a new secure message waiting for you in the Maple Legal portal for matter {matter_title}."
        "\nLog in to review and reply.\n\nRegards,\nMaple Legal"
    )
    send_email(EmailRequest(to=[to], subject=subject, body=body))
