"""Serializers for portal functionality."""
from __future__ import annotations

from rest_framework import serializers

from config.tenancy import OrganizationScopedPrimaryKeyRelatedField
from services.storage.presign import generate_get_url, generate_put_url

from matters.models import Matter

from .models import Document, DocumentComment, DocumentVersion, Message, MessageThread, ShareLink


class DocumentSerializer(serializers.ModelSerializer):
    presigned_upload = serializers.SerializerMethodField()
    scan_status = serializers.CharField(read_only=True)
    scan_message = serializers.CharField(read_only=True)

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
            "scan_status",
            "scan_message",
        ]
        read_only_fields = ["id", "owner", "uploaded_at", "version", "presigned_upload", "s3_key"]

    def get_presigned_upload(self, obj):
        return generate_put_url(obj.organization_id, obj.s3_key)


class DocumentVersionSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentVersion
        fields = [
            "id",
            "version_number",
            "filename",
            "mime",
            "size",
            "sha256",
            "uploaded_at",
            "uploaded_by",
            "download_url",
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        return generate_get_url(obj.organization_id, obj.s3_key)


class DocumentCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    document = serializers.UUIDField(write_only=True)

    class Meta:
        model = DocumentComment
        fields = ["id", "document", "body", "created_at", "author", "author_name"]
        read_only_fields = ["id", "created_at", "author", "author_name"]

    def get_author_name(self, obj):
        author = obj.author
        if not author:
            return "System"
        full_name = f"{author.first_name} {author.last_name}".strip()
        return full_name or author.email


class DocumentUploadSerializer(serializers.Serializer):
    matter = OrganizationScopedPrimaryKeyRelatedField(queryset=Matter.objects.all())
    filename = serializers.CharField(max_length=255)
    mime = serializers.CharField(max_length=120)
    size = serializers.IntegerField(min_value=1)
    sha256 = serializers.CharField(max_length=64)


class DocumentVersionUploadSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    mime = serializers.CharField(max_length=120)
    size = serializers.IntegerField(min_value=1)
    sha256 = serializers.CharField(max_length=64)


class MessageThreadSerializer(serializers.ModelSerializer):
    matter = OrganizationScopedPrimaryKeyRelatedField(queryset=Matter.objects.all())

    class Meta:
        model = MessageThread
        fields = ["id", "matter", "created_at"]
        read_only_fields = ["id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    thread = OrganizationScopedPrimaryKeyRelatedField(queryset=MessageThread.objects.all())
    attachments = OrganizationScopedPrimaryKeyRelatedField(queryset=Document.objects.all(), many=True, required=False)

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
    document = OrganizationScopedPrimaryKeyRelatedField(queryset=Document.objects.all())

    class Meta:
        model = ShareLink
        fields = ["id", "organization", "document", "token", "expires_at", "one_time", "created_at"]
        read_only_fields = ["id", "organization", "token", "created_at"]
