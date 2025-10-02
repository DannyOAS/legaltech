from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, Role, User, UserRole
from accounts.rbac import sync_organization_roles
from matters.models import Client, Matter, MatterAccess
from portal.models import Document
from billing.models import Invoice


class RBACEnforcementTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Atlas Law", region="ON")
        sync_organization_roles(self.organization)

        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="password123",
            first_name="Ada",
            last_name="Admin",
            organization=self.organization,
        )
        self.lawyer_user = User.objects.create_user(
            email="lawyer@example.com",
            password="password123",
            first_name="Liam",
            last_name="Law",
            organization=self.organization,
        )
        self.paralegal_user = User.objects.create_user(
            email="para@example.com",
            password="password123",
            first_name="Pia",
            last_name="Paralegal",
            organization=self.organization,
        )
        self.accounting_user = User.objects.create_user(
            email="acct@example.com",
            password="password123",
            first_name="Alex",
            last_name="Account",
            organization=self.organization,
        )
        self.client_user = User.objects.create_user(
            email="client@example.com",
            password="password123",
            first_name="Casey",
            last_name="Client",
            organization=self.organization,
        )

        for user, role_name in [
            (self.admin_user, "Admin"),
            (self.lawyer_user, "Lawyer"),
            (self.paralegal_user, "Paralegal"),
            (self.accounting_user, "Accounting / Finance"),
            (self.client_user, "Client"),
        ]:
            role = Role.objects.get(organization=self.organization, name=role_name)
            UserRole.objects.get_or_create(user=user, role=role)

        self.client_profile = Client.objects.create(
            organization=self.organization,
            display_name="Client One",
            primary_email="client@example.com",
            portal_user=self.client_user,
        )
        self.matter_one = Matter.objects.create(
            organization=self.organization,
            client=self.client_profile,
            title="Litigation A",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-A",
            lead_lawyer=self.lawyer_user,
        )
        self.matter_two = Matter.objects.create(
            organization=self.organization,
            client=self.client_profile,
            title="Litigation B",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-B",
            lead_lawyer=None,
        )
        MatterAccess.objects.create(
            organization=self.organization,
            matter=self.matter_one,
            user=self.paralegal_user,
            role="paralegal",
        )

        self.document_one = Document.objects.create(
            organization=self.organization,
            matter=self.matter_one,
            owner=self.lawyer_user,
            filename="brief.pdf",
            mime="application/pdf",
            size=1024,
            s3_key="test/brief.pdf",
            sha256="a" * 64,
        )

        self.invoice_one = Invoice.objects.create(
            organization=self.organization,
            matter=self.matter_one,
            number="INV-001",
            status="draft",
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=Decimal("1000.00"),
            tax_total=Decimal("130.00"),
            total=Decimal("1130.00"),
        )
        self.invoice_two = Invoice.objects.create(
            organization=self.organization,
            matter=self.matter_two,
            number="INV-002",
            status="draft",
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=Decimal("500.00"),
            tax_total=Decimal("65.00"),
            total=Decimal("565.00"),
        )

    def _get(self, user: User, path: str):
        client = self.client
        client.force_authenticate(user=user)
        return client.get(path)

    def test_admin_can_view_all_matters(self):
        response = self._get(self.admin_user, "/api/v1/matters/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_lawyer_is_limited_to_assigned_matters(self):
        response = self._get(self.lawyer_user, "/api/v1/matters/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        matter_ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(matter_ids, {str(self.matter_one.id)})

    def test_paralegal_sees_only_assigned_documents(self):
        response = self._get(self.paralegal_user, "/api/v1/documents/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        doc_ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(doc_ids, {str(self.document_one.id)})

    def test_client_cannot_access_staff_endpoints(self):
        response = self._get(self.client_user, "/api/v1/matters/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_accounting_cannot_view_documents(self):
        response = self._get(self.accounting_user, "/api/v1/documents/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_accounting_can_view_all_invoices(self):
        response = self._get(self.accounting_user, "/api/v1/invoices/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
