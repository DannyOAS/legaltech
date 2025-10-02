"""Portal API views."""

from __future__ import annotations

import secrets

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOrganizationMember
from config.tenancy import OrganizationModelViewSet
from notifications.service import send_notification
from services.audit.logging import audit_action
from services.notifications.email import send_document_uploaded_email, send_portal_message_email
from services.storage.presign import generate_get_url, generate_put_url
from services.storage.virus_scan import ScanRequest, schedule_scan

from .models import Document, DocumentComment, DocumentVersion, Message, MessageThread, ShareLink
from .serializers import (
    DocumentCommentSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
    DocumentVersionSerializer,
    DocumentVersionUploadSerializer,
    MessageSerializer,
    MessageThreadSerializer,
    ShareLinkSerializer,
)


class DocumentViewSet(OrganizationModelViewSet):
    serializer_class = DocumentSerializer
    queryset = Document.objects.select_related("matter", "owner")

    def create(self, request, *args, **kwargs):
        if "Client" in request.user.roles.values_list("name", flat=True):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Clients cannot upload documents")
        upload_serializer = DocumentUploadSerializer(
            data=request.data, context={"request": request}
        )
        upload_serializer.is_valid(raise_exception=True)
        payload = upload_serializer.validated_data
        matter = payload["matter"]
        doc = Document.objects.create(
            organization=request.user.organization,
            matter=matter,
            owner=request.user,
            filename=payload["filename"],
            mime=payload["mime"],
            size=payload["size"],
            sha256=payload["sha256"],
            s3_key=f"{request.organization_id}/documents/{secrets.token_hex(8)}-{payload['filename']}",
            scan_status="pending",
        )
        DocumentVersion.objects.create(
            document=doc,
            organization=doc.organization,
            version_number=1,
            filename=doc.filename,
            mime=doc.mime,
            size=doc.size,
            s3_key=doc.s3_key,
            sha256=doc.sha256,
            uploaded_by=request.user,
        )
        upload_url = generate_put_url(
            doc.organization_id, doc.s3_key, payload["mime"], payload["size"]
        )
        audit_action(
            request.organization_id,
            request.user.id,
            "portal.document.created",
            "document",
            str(doc.id),
            request,
        )
        schedule_scan(
            ScanRequest(
                organization_id=str(request.organization_id),
                document_id=str(doc.id),
                filename=doc.filename,
                sha256=doc.sha256,
            )
        )
        client_user = matter.client.portal_user if matter and matter.client else None
        if client_user and doc.client_visible:
            send_notification(
                organization_id=str(request.organization_id),
                recipient_id=str(client_user.id),
                notification_type="portal.document.created",
                title=f"New document for {matter.title}",
                body=f"{payload['filename']} is now available.",
                metadata={"document_id": str(doc.id)},
                related_object_type="document",
                related_object_id=str(doc.id),
            )
            send_document_uploaded_email(
                to=client_user.email,
                matter_title=matter.title,
                filename=payload["filename"],
            )
        return Response(
            {"document": DocumentSerializer(doc).data, "upload_url": upload_url},
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        document = serializer.instance
        was_visible = document.client_visible
        updated = serializer.save()
        if not was_visible and updated.client_visible:
            matter = updated.matter
            client_user = matter.client.portal_user if matter and matter.client else None
            if client_user:
                send_notification(
                    organization_id=str(self.request.organization_id),
                    recipient_id=str(client_user.id),
                    notification_type="portal.document.shared",
                    title=f"Document shared on {matter.title}",
                    body=f"{updated.filename} is now visible.",
                    metadata={"document_id": str(updated.id)},
                    related_object_type="document",
                    related_object_id=str(updated.id),
                )
                send_document_uploaded_email(
                    to=client_user.email,
                    matter_title=matter.title,
                    filename=updated.filename,
                )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()
        if document.scan_status == "infected":
            return Response(
                {"detail": "Document blocked by virus scan."}, status=status.HTTP_403_FORBIDDEN
            )
        url = generate_get_url(document.organization_id, document.s3_key)
        audit_action(
            request.organization_id,
            request.user.id,
            "portal.document.downloaded",
            "document",
            str(document.id),
            request,
        )
        return Response({"url": url})

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentVersionSerializer(document.versions.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="upload-version")
    def upload_version(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentVersionUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        next_version = document.version + 1
        new_key = (
            f"{request.organization_id}/documents/{secrets.token_hex(8)}-{payload['filename']}"
        )
        upload_url = generate_put_url(
            document.organization_id, new_key, payload["mime"], payload["size"]
        )
        document.filename = payload["filename"]
        document.mime = payload["mime"]
        document.size = payload["size"]
        document.sha256 = payload["sha256"]
        document.s3_key = new_key
        document.version = next_version
        document.scan_status = "pending"
        document.scan_message = ""
        document.scan_checked_at = None
        document.save(
            update_fields=[
                "filename",
                "mime",
                "size",
                "sha256",
                "s3_key",
                "version",
                "scan_status",
                "scan_message",
                "scan_checked_at",
            ]
        )
        DocumentVersion.objects.create(
            document=document,
            organization=document.organization,
            version_number=next_version,
            filename=document.filename,
            mime=document.mime,
            size=document.size,
            s3_key=document.s3_key,
            sha256=document.sha256,
            uploaded_by=request.user,
        )
        schedule_scan(
            ScanRequest(
                organization_id=str(request.organization_id),
                document_id=str(document.id),
                filename=document.filename,
                sha256=document.sha256,
            )
        )
        audit_action(
            request.organization_id,
            request.user.id,
            "portal.document.versioned",
            "document",
            str(document.id),
            request,
        )
        return Response({"upload_url": upload_url})


class MessageThreadViewSet(OrganizationModelViewSet):
    serializer_class = MessageThreadSerializer
    queryset = MessageThread.objects.select_related("matter")
    permission_classes = [IsOrganizationMember]

    def get_queryset(self):
        queryset = super().get_queryset().select_related("matter")
        client_profile = getattr(self.request.user, "client_profile", None)
        matter_id = self.request.query_params.get("matter")
        if matter_id:
            queryset = queryset.filter(matter_id=matter_id)
        if client_profile:
            queryset = queryset.filter(matter__client=client_profile)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):  # type: ignore[override]
        matter = serializer.validated_data["matter"]
        client_profile = getattr(self.request.user, "client_profile", None)
        if client_profile and matter.client_id != client_profile.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Matter not accessible")
        thread = serializer.save(organization=self.request.user.organization)
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "portal.thread.created",
            "thread",
            str(thread.id),
            self.request,
        )


class DocumentCommentViewSet(OrganizationModelViewSet):
    serializer_class = DocumentCommentSerializer
    queryset = DocumentComment.objects.select_related("document", "author")

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset().select_related("document", "author")
        document_id = self.request.query_params.get("document")
        if document_id:
            queryset = queryset.filter(document_id=document_id)
        return queryset.order_by("created_at")

    def perform_create(self, serializer):
        document_id = self.request.data.get("document")
        try:
            document = Document.objects.get(
                id=document_id, organization=self.request.user.organization
            )
        except Document.DoesNotExist as exc:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"document": "Invalid document"}) from exc
        serializer.save(
            document=document,
            organization=self.request.user.organization,
            author=self.request.user,
        )
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "portal.document.comment",
            "document",
            str(document.id),
            self.request,
        )


class MessageViewSet(OrganizationModelViewSet):
    serializer_class = MessageSerializer
    queryset = Message.objects.select_related("thread")
    permission_classes = [IsOrganizationMember]

    def perform_create(self, serializer):
        client_profile = getattr(self.request.user, "client_profile", None)
        thread = serializer.validated_data["thread"]
        if client_profile and thread.matter.client_id != client_profile.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Thread not accessible")
        if client_profile:
            message = serializer.save(
                organization=self.request.user.organization,
                sender_client=client_profile,
                sender_user=None,
            )
        else:
            message = serializer.save(
                organization=self.request.user.organization, sender_user=self.request.user
            )
        if attachments := serializer.validated_data.get("attachments"):
            message.attachments.set(attachments)
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "portal.message.sent",
            "message",
            str(message.id),
            self.request,
        )
        thread = message.thread
        recipient = None
        if thread and thread.matter:
            matter = thread.matter
            if client_profile:
                recipient = matter.lead_lawyer
            else:
                recipient = matter.client.portal_user if matter.client else None
        if recipient and recipient != self.request.user:
            send_notification(
                organization_id=str(self.request.organization_id),
                recipient_id=str(recipient.id),
                notification_type="portal.message.sent",
                title=f"New message on {thread.matter.title}",
                body=message.body[:140],
                metadata={"thread_id": str(thread.id)},
                related_object_type="message",
                related_object_id=str(message.id),
            )
            send_portal_message_email(to=recipient.email, matter_title=thread.matter.title)

    def get_queryset(self):
        queryset = super().get_queryset().select_related("thread", "thread__matter")
        client_profile = getattr(self.request.user, "client_profile", None)
        thread_id = self.request.query_params.get("thread")
        if thread_id:
            queryset = queryset.filter(thread_id=thread_id)
        if client_profile:
            queryset = queryset.filter(thread__matter__client=client_profile)
        return queryset.order_by("created_at")


class ShareLinkViewSet(OrganizationModelViewSet):
    serializer_class = ShareLinkSerializer
    queryset = ShareLink.objects.select_related("document")

    def perform_create(self, serializer):
        link = serializer.save(
            organization=self.request.user.organization,
            token=secrets.token_urlsafe(24),
        )
        audit_action(
            self.request.organization_id,
            self.request.user.id,
            "portal.sharelink.created",
            "share_link",
            str(link.id),
            self.request,
        )


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
        audit_action(
            link.document.organization_id,
            None,
            "portal.sharelink.accessed",
            "share_link",
            str(link.id),
            request,
        )
        return Response({"url": url})
