"""Portal models for secure collaboration."""
from __future__ import annotations

import secrets
import uuid

from django.db import models
from django.utils import timezone

from accounts.models import Organization, User
from matters.models import Client, Matter


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="documents", on_delete=models.CASCADE)
    matter = models.ForeignKey(Matter, related_name="documents", on_delete=models.CASCADE)
    owner = models.ForeignKey(User, related_name="uploaded_documents", on_delete=models.CASCADE)
    filename = models.CharField(max_length=255)
    mime = models.CharField(max_length=120)
    size = models.BigIntegerField()
    s3_key = models.CharField(max_length=512)
    sha256 = models.CharField(max_length=64)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    client_visible = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    scan_status = models.CharField(
        max_length=16,
        choices=[("pending", "Pending"), ("clean", "Clean"), ("infected", "Infected"), ("failed", "Failed")],
        default="pending",
    )
    scan_message = models.CharField(max_length=255, blank=True)
    scan_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return self.filename


class DocumentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, related_name="versions", on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, related_name="document_versions", on_delete=models.CASCADE)
    version_number = models.PositiveIntegerField()
    filename = models.CharField(max_length=255)
    mime = models.CharField(max_length=120)
    size = models.BigIntegerField()
    s3_key = models.CharField(max_length=512)
    sha256 = models.CharField(max_length=64)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, related_name="document_versions", on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ["-uploaded_at"]


class DocumentComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, related_name="comments", on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, related_name="document_comments", on_delete=models.CASCADE)
    author = models.ForeignKey(User, related_name="document_comments", on_delete=models.SET_NULL, null=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class MessageThread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="message_threads", on_delete=models.CASCADE)
    matter = models.ForeignKey(Matter, related_name="threads", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="messages", on_delete=models.CASCADE)
    thread = models.ForeignKey(MessageThread, related_name="messages", on_delete=models.CASCADE)
    sender_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="messages_sent")
    sender_client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL, related_name="messages_sent")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    attachments = models.ManyToManyField(Document, blank=True, related_name="attached_to")

    class Meta:
        ordering = ["created_at"]

    def clean(self):
        if not self.sender_user and not self.sender_client:
            raise ValueError("Message requires a sender")


class ShareLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, related_name="share_links", on_delete=models.CASCADE)
    document = models.ForeignKey(Document, related_name="share_links", on_delete=models.CASCADE)
    token = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    one_time = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def regenerate(self):
        self.token = secrets.token_urlsafe(24)
        self.save(update_fields=["token"])

    @property
    def is_valid(self) -> bool:
        return timezone.now() < self.expires_at
