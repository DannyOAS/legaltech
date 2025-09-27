"""Create demo data for local usage."""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django

django.setup()

from accounts.models import Invitation, Organization, Role, User, UserRole
from billing.models import Expense, Invoice, Payment, TimeEntry
from matters.models import Client, Matter
from portal.models import Document, Message, MessageThread


def run() -> None:
    org, _ = Organization.objects.get_or_create(name="Demo Law", region="ON")
    roles = {name: Role.objects.get_or_create(name=name, organization=org)[0] for name in ["Owner", "Lawyer", "Assistant"]}

    users = {
        "owner": User.objects.get_or_create(
            email="owner@demo.law",
            defaults={"first_name": "Olivia", "last_name": "Owner", "organization": org, "is_staff": True},
        )[0],
        "lawyer": User.objects.get_or_create(
            email="lawyer@demo.law",
            defaults={"first_name": "Liam", "last_name": "Lawyer", "organization": org},
        )[0],
        "assistant": User.objects.get_or_create(
            email="assistant@demo.law",
            defaults={"first_name": "Ava", "last_name": "Assistant", "organization": org},
        )[0],
    }

    for key, user in users.items():
        user.set_password("Passw0rd!123")
        user.save()
        if role := roles.get("Owner" if key == "owner" else key.capitalize()):
            UserRole.objects.get_or_create(user=user, role=role)

    client, _ = Client.objects.get_or_create(
        organization=org,
        display_name="Maple Syrup Co.",
        defaults={"primary_email": "contact@maplesyrup.ca", "phone": "416-555-0100"},
    )

    matter, _ = Matter.objects.get_or_create(
        organization=org,
        client=client,
        reference_code="DEM-001",
        defaults={
            "title": "Shareholder Agreement",
            "practice_area": "Corporate",
            "status": "open",
            "opened_at": date.today() - timedelta(days=10),
            "lead_lawyer": users["lawyer"],
        },
    )

    TimeEntry.objects.get_or_create(
        organization=org,
        matter=matter,
        user=users["lawyer"],
        description="Drafted initial agreement",
        minutes=120,
        rate=350,
        date=date.today() - timedelta(days=5),
    )

    Expense.objects.get_or_create(
        organization=org,
        matter=matter,
        description="Title search",
        amount=150,
        date=date.today() - timedelta(days=4),
    )

    invoice, _ = Invoice.objects.get_or_create(
        organization=org,
        matter=matter,
        number="INV-1001",
        defaults={
            "issue_date": date.today() - timedelta(days=2),
            "due_date": date.today() + timedelta(days=28),
            "subtotal": 700,
            "tax_total": 91,
            "total": 791,
            "status": "draft",
        },
    )

    Payment.objects.get_or_create(
        organization=org,
        invoice=invoice,
        amount=200,
        date=date.today() - timedelta(days=1),
        method="manual",
    )

    thread, _ = MessageThread.objects.get_or_create(
        organization=org,
        matter=matter,
    )

    Message.objects.get_or_create(
        thread=thread,
        organization=org,
        sender_user=users["lawyer"],
        body="Welcome to the client portal!",
    )

    Document.objects.get_or_create(
        organization=org,
        matter=matter,
        owner=users["lawyer"],
        filename="engagement-letter.pdf",
        defaults={
            "mime": "application/pdf",
            "size": 1024,
            "s3_key": f"{org.id}/documents/demo-engagement.pdf",
            "sha256": "demo",
        },
    )

    print("Demo environment ready")
    print("Login with email: owner@demo.law password: Passw0rd!123")


if __name__ == "__main__":
    run()
