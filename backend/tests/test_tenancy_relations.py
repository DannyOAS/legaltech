from datetime import date

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import Organization, Role, User, UserRole
from billing.models import Invoice
from matters.models import Client, Matter
from matters.views import MatterViewSet
from portal.views import DocumentViewSet


class RelationshipIsolationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.org_one = Organization.objects.create(name="Org One", region="ON")
        self.org_two = Organization.objects.create(name="Org Two", region="ON")
        self.user_one = User.objects.create_user(
            email="user1@example.com",
            password="Passw0rd!123",
            first_name="User",
            last_name="One",
            organization=self.org_one,
        )
        self.client_one = Client.objects.create(
            organization=self.org_one,
            display_name="Client One",
            primary_email="client1@example.com",
        )
        self.client_two = Client.objects.create(
            organization=self.org_two,
            display_name="Client Two",
            primary_email="client2@example.com",
        )
        self.matter_two = Matter.objects.create(
            organization=self.org_two,
            client=self.client_two,
            title="Matter Two",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-XYZ",
            lead_lawyer=None,
        )
        self.matter_one = Matter.objects.create(
            organization=self.org_one,
            client=self.client_one,
            title="Matter One",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-ABC",
            lead_lawyer=self.user_one,
        )
        self.invoice_two = Invoice.objects.create(
            organization=self.org_two,
            matter=self.matter_two,
            number="INV-XYZ",
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=100,
            tax_total=13,
            total=113,
            status="sent",
        )
        self.client_role = Role.objects.create(name="Client", organization=self.org_one)
        self.client_portal_user = User.objects.create_user(
            email="client.portal@example.com",
            password="Passw0rd!123",
            first_name="Client",
            last_name="Portal",
            organization=self.org_one,
        )
        UserRole.objects.create(user=self.client_portal_user, role=self.client_role)
        self.client_one.portal_user = self.client_portal_user
        self.client_one.save(update_fields=["portal_user"])

    def _authenticate(self, request):
        force_authenticate(request, user=self.user_one)
        request.organization_id = self.org_one.id

    def test_matter_creation_rejects_foreign_client(self):
        view = MatterViewSet.as_view({"post": "create"})
        payload = {
            "title": "Cross Tenant Matter",
            "practice_area": "Civil",
            "status": "open",
            "opened_at": date.today().isoformat(),
            "reference_code": "MAT-FOREIGN",
            "client_id": str(self.client_two.id),
            "lead_lawyer": str(self.user_one.id),
        }
        request = self.factory.post("/api/v1/matters/", payload, format="json")
        self._authenticate(request)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("client_id", response.data)

    def test_document_creation_rejects_foreign_matter(self):
        view = DocumentViewSet.as_view({"post": "create"})
        payload = {
            "matter": str(self.matter_two.id),
            "filename": "file.pdf",
            "mime": "application/pdf",
            "size": 512,
            "sha256": "a" * 64,
        }
        request = self.factory.post("/api/v1/documents/", payload, format="json")
        self._authenticate(request)
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("matter", response.data)

    def test_client_user_cannot_access_internal_viewsets(self):
        view = MatterViewSet.as_view({"get": "list"})
        request = self.factory.get("/api/v1/matters/")
        force_authenticate(request, user=self.client_portal_user)
        request.organization_id = self.org_one.id
        response = view(request)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
