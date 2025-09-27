"""Portal API views."""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from config.tenancy import OrganizationModelViewSet
from services.audit.logging import audit_action
from services.storage.presign import generate_get_url, generate_put_url

from .models import Document, Message, MessageThread, ShareLink
from .serializers import DocumentSerializer, DocumentUploadSerializer, MessageSerializer, MessageThreadSerializer, ShareLinkSerializer


class DocumentViewSet(OrganizationModelViewSet):
    serializer_class = DocumentSerializer
    queryset = Document.objects.select_related("matter", "owner")

    def create(self, request, *args, **kwargs):
        upload_serializer = DocumentUploadSerializer(data=request.data)
        upload_serializer.is_valid(raise_exception=True)
        payload = upload_serializer.validated_data
        doc = Document.objects.create(
            organization=request.user.organization,
            matter_id=payload["matter"],
            owner=request.user,
            filename=payload["filename"],
            mime=payload["mime"],
            size=payload["size"],
            sha256=payload["sha256"],
            s3_key=f"{request.organization_id}/documents/{secrets.token_hex(8)}-{payload['filename']}",
        )
        upload_url = generate_put_url(doc.organization_id, doc.s3_key, payload["mime"], payload["size"])
        audit_action(request.organization_id, request.user.id, "portal.document.created", "document", str(doc.id), request)
        return Response({"document": DocumentSerializer(doc).data, "upload_url": upload_url}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()
        url = generate_get_url(document.organization_id, document.s3_key)
        audit_action(request.organization_id, request.user.id, "portal.document.downloaded", "document", str(document.id), request)
        return Response({"url": url})


class MessageThreadViewSet(OrganizationModelViewSet):
    serializer_class = MessageThreadSerializer
    queryset = MessageThread.objects.select_related("matter")

    def perform_create(self, serializer):
        thread = serializer.save(organization=self.request.user.organization)
        audit_action(self.request.organization_id, self.request.user.id, "portal.thread.created", "thread", str(thread.id), self.request)


class MessageViewSet(OrganizationModelViewSet):
    serializer_class = MessageSerializer
    queryset = Message.objects.select_related("thread")

    def perform_create(self, serializer):
        message = serializer.save(organization=self.request.user.organization, sender_user=self.request.user)
        if attachments := serializer.validated_data.get("attachments"):
            message.attachments.set(attachments)
        audit_action(self.request.organization_id, self.request.user.id, "portal.message.sent", "message", str(message.id), self.request)


class ShareLinkViewSet(OrganizationModelViewSet):
    serializer_class = ShareLinkSerializer
    queryset = ShareLink.objects.select_related("document")

    def perform_create(self, serializer):
        link = serializer.save(
            organization=self.request.user.organization,
            token=secrets.token_urlsafe(24),
        )
        audit_action(self.request.organization_id, self.request.user.id, "portal.sharelink.created", "share_link", str(link.id), self.request)


class ShareLinkResolveView(APIView):
    permission_classes = []

    def get(self, request, token: str):
        try:
            link = ShareLink.objects.select_related("document").get(token=token)
        except ShareLink.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not link.is_valid:
            return Response({"detail": "Expired"}, status=status.HTTP_410_GONE)
        url = generate_get_url(link.document.organization_id, link.document.s3_key)
        if link.one_time:
            link.delete()
        audit_action(link.document.organization_id, None, "portal.sharelink.accessed", "share_link", str(link.id), request)
        return Response({"url": url})
