"""Billing models for time tracking and invoices."""
from __future__ import annotations

import uuid

from django.db import models

from accounts.models import Organization, User
from matters.models import Matter


class TimeEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="time_entries")
    matter = models.ForeignKey(Matter, related_name="time_entries", on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name="time_entries", on_delete=models.SET_NULL, null=True)
    description = models.TextField()
    minutes = models.PositiveIntegerField()
    rate = models.DecimalField(max_digits=8, decimal_places=2)
    date = models.DateField()
    billable = models.BooleanField(default=True)
    source = models.CharField(
        max_length=12,
        choices=[("email", "Email"), ("doc", "Document"), ("call", "Phone Call"), ("manual", "Manual")],
        default="manual",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="expenses")
    matter = models.ForeignKey(Matter, related_name="expenses", on_delete=models.CASCADE)
    description = models.TextField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    tax_code = models.CharField(max_length=32, blank=True)
    receipt_file = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]


class Invoice(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("sent", "Sent"),
        ("paid", "Paid"),
        ("overdue", "Overdue"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invoices")
    matter = models.ForeignKey(Matter, related_name="invoices", on_delete=models.CASCADE)
    number = models.CharField(max_length=32)
    issue_date = models.DateField()
    due_date = models.DateField()
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax_total = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    pdf_file = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "number")
        ordering = ["-issue_date"]


class Payment(models.Model):
    METHOD_CHOICES = [
        ("stripe", "Stripe"),
        ("interac", "Interac e-Transfer"),
        ("manual", "Manual"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="payments")
    invoice = models.ForeignKey(Invoice, related_name="payments", on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    external_ref = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]


class TrustAccountBalance(models.Model):
    organization = models.OneToOneField(Organization, primary_key=True, on_delete=models.CASCADE)
    balance_cents = models.BigIntegerField(default=0)

    class Meta:
        verbose_name = "Trust Account Balance"
        verbose_name_plural = "Trust Account Balances"
