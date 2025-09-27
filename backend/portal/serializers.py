"""Serializers for portal functionality."""
from __future__ import annotations

from rest_framework import serializers

from services.storage.presign import generate_put_url

from .models import Document, Message, MessageThread, ShareLink


class DocumentSerializer(serializers.ModelSerializer):
    presigned_upload = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "matter",
            "owner",
            "filename",
            "mime",
            "size",
            "s3_key",
            "sha256",
            "uploaded_at",
            "client_visible",
            "version",
            "presigned_upload",
        ]
        read_only_fields = ["id", "owner", "uploaded_at", "version", "presigned_upload", "s3_key"]

    def get_presigned_upload(self, obj):
        return generate_put_url(obj.organization_id, obj.s3_key)


class DocumentUploadSerializer(serializers.Serializer):
    matter = serializers.UUIDField()
    filename = serializers.CharField(max_length=255)
    mime = serializers.CharField(max_length=120)
    size = serializers.IntegerField(min_value=1)
    sha256 = serializers.CharField(max_length=64)


class MessageThreadSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageThread
        fields = ["id", "matter", "created_at"]
        read_only_fields = ["id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    attachments = serializers.PrimaryKeyRelatedField(queryset=Document.objects.all(), many=True, required=False)

    class Meta:
        model = Message
        fields = ["id", "thread", "sender_user", "sender_client", "body", "attachments", "created_at"]
        read_only_fields = ["id", "created_at", "sender_user", "sender_client"]

    def validate_attachments(self, value):
        request = self.context.get("request")
        if not request:
            return value
        org_id = request.user.organization_id
        for doc in value:
            if doc.organization_id != org_id:
                raise serializers.ValidationError("Attachment outside organization scope")
        return value


class ShareLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShareLink
        fields = ["id", "organization", "document", "token", "expires_at", "one_time", "created_at"]
        read_only_fields = ["id", "organization", "token", "created_at"]
