"""Email sending stub for notifications."""

from django.core.mail import send_mail


def send_invite(email: str, subject: str, message: str) -> None:
    send_mail(subject, message, None, [email])
