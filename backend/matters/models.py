"""Client and matter models."""

from __future__ import annotations

import uuid

from django.db import models

from accounts.models import Organization, User


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Client(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="clients", on_delete=models.CASCADE)
    display_name = models.CharField(max_length=255)
    primary_email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_deleted = models.BooleanField(default=False)
    portal_user = models.OneToOneField(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="client_profile"
    )

    class Meta:
        ordering = ["display_name"]

    def __str__(self) -> str:
        return self.display_name


class Matter(TimeStampedModel):
    STATUS_CHOICES = [("open", "Open"), ("closed", "Closed")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="matters", on_delete=models.CASCADE)
    client = models.ForeignKey(Client, related_name="matters", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    practice_area = models.CharField(max_length=120)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="open")
    opened_at = models.DateField()
    closed_at = models.DateField(null=True, blank=True)
    reference_code = models.CharField(max_length=64, unique=True)
        User, related_name="lead_matters", on_delete=models.SET_NULL, null=True
    )
        return self.title

    def save(self, *args, **kwargs):
        if not self.reference_code and self.organization_id:
            self.reference_code = self.organization.generate_matter_reference()
        super().save(*args, **kwargs)


class CaseDeadline(TimeStampedModel):
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("overdue", "Overdue"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="case_deadlines", on_delete=models.CASCADE)
    matter = models.ForeignKey(Matter, related_name="deadlines", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    deadline_type = models.CharField(max_length=120)
    due_date = models.DateTimeField()
    rule_reference = models.CharField(max_length=120, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_by = models.ForeignKey(User, related_name="created_deadlines", on_delete=models.SET_NULL, null=True)
    notifications_sent = models.JSONField(default=list, blank=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["due_date"]
        indexes = [
            models.Index(fields=["organization", "due_date"]),
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["matter", "due_date"]),
            models.Index(fields=["due_date", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} - {self.due_date.strftime('%Y-%m-%d')}"
