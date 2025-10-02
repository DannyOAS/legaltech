from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, Role, User
from matters.models import Client, Matter
from portal.models import Document, DocumentComment, DocumentVersion


class DocumentManagementTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Org", region="ON")
        self.owner_role = Role.objects.create(name="Owner", organization=self.organization)
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="Passw0rd!123",
            first_name="Owner",
            last_name="User",
            organization=self.organization,
        )
        self.user.user_roles.create(role=self.owner_role)
        self.client.force_authenticate(self.user)
        self.client_profile = Client.objects.create(
            organization=self.organization,
            display_name="Test Client",
            primary_email="client@example.com",
        )
        self.matter = Matter.objects.create(
            organization=self.organization,
            client=self.client_profile,
            title="Sample Matter",
            practice_area="Civil",
            status="open",
            reference_code="MAT-001",
            opened_at="2025-01-01",
        )

    def test_upload_document_creates_version_and_scan_status(self):
        payload = {
            "matter": str(self.matter.id),
            "filename": "agreement.pdf",
            "mime": "application/pdf",
            "size": 1024,
            "sha256": "a" * 64,
        }
        response = self.client.post(reverse("document-list"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        document_id = response.data["document"]["id"]
        document = Document.objects.get(id=document_id)
        self.assertEqual(document.version, 1)
        self.assertEqual(document.scan_status, "clean")
        self.assertEqual(DocumentVersion.objects.filter(document=document).count(), 1)

    def test_upload_new_version(self):
        # initial upload
        payload = {
            "matter": str(self.matter.id),
            "filename": "agreement.pdf",
            "mime": "application/pdf",
            "size": 1024,
            "sha256": "a" * 64,
        }
        create_response = self.client.post(reverse("document-list"), payload, format="json")
        document_id = create_response.data["document"]["id"]
        version_payload = {
            "filename": "agreement-v2.pdf",
            "mime": "application/pdf",
            "size": 2048,
            "sha256": "b" * 64,
        }
        response = self.client.post(
            reverse("document-upload-version", args=[document_id]),
            version_payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        document = Document.objects.get(id=document_id)
        self.assertEqual(document.version, 2)
        self.assertEqual(DocumentVersion.objects.filter(document=document).count(), 2)

    def test_document_comments(self):
        payload = {
            "matter": str(self.matter.id),
            "filename": "agreement.pdf",
            "mime": "application/pdf",
            "size": 1024,
            "sha256": "a" * 64,
        }
        create_response = self.client.post(reverse("document-list"), payload, format="json")
        document_id = create_response.data["document"]["id"]
        comment_payload = {"document": document_id, "body": "Needs review"}
        response = self.client.post(
            reverse("document-comment-list"), comment_payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DocumentComment.objects.filter(document_id=document_id).count(), 1)
