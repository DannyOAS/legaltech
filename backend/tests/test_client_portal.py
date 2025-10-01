from datetime import date

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Invitation, Organization, Role, User, UserRole
from billing.models import Invoice
from matters.models import Client, Matter
from portal.models import Document


class ClientPortalTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Org", region="ON")
        self.staff_user = User.objects.create_user(
            email="lawyer@example.com",
            password="Passw0rd!123",
            first_name="Law",
            last_name="Yer",
            organization=self.organization,
        )
        self.client_role = Role.objects.create(name="Client", organization=self.organization)
        self.client_profile = Client.objects.create(
            organization=self.organization,
            display_name="Jane Client",
            primary_email="jane@example.com",
        )
        self.client_user = User.objects.create_user(
            email="jane@example.com",
            password="Passw0rd!123",
            first_name="Jane",
            last_name="Client",
            organization=self.organization,
        )
        UserRole.objects.create(user=self.client_user, role=self.client_role)
        self.client_profile.portal_user = self.client_user
        self.client_profile.save(update_fields=["portal_user"])
        self.matter = Matter.objects.create(
            organization=self.organization,
            client=self.client_profile,
            title="Maple vs. Ontario",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-001",
            lead_lawyer=self.staff_user,
        )
        self.other_matter = Matter.objects.create(
            organization=self.organization,
            client=Client.objects.create(
                organization=self.organization,
                display_name="Other Client",
                primary_email="other@example.com",
            ),
            title="Other Matter",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-002",
            lead_lawyer=self.staff_user,
        )
        self.visible_document = Document.objects.create(
            organization=self.organization,
            matter=self.matter,
            owner=self.staff_user,
            filename="engagement.pdf",
            mime="application/pdf",
            size=1024,
            s3_key="foo",
            sha256="a" * 64,
            client_visible=True,
        )
        self.hidden_document = Document.objects.create(
            organization=self.organization,
            matter=self.other_matter,
            owner=self.staff_user,
            filename="other.pdf",
            mime="application/pdf",
            size=1024,
            s3_key="bar",
            sha256="b" * 64,
            client_visible=True,
        )
        self.invoice = Invoice.objects.create(
            organization=self.organization,
            matter=self.matter,
            number="INV-123",
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=200,
            tax_total=26,
            total=226,
            status="sent",
        )

    def test_client_sees_only_their_documents(self):
        self.client.force_authenticate(self.client_user)
        url = reverse("client-portal:client-documents-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {doc["id"] for doc in response.data["results"]}
        self.assertIn(str(self.visible_document.id), ids)
        self.assertNotIn(str(self.hidden_document.id), ids)

    def test_client_dashboard(self):
        self.client.force_authenticate(self.client_user)
        url = reverse("client-portal:client-dashboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["documents_count"], 1)
        self.assertEqual(response.data["outstanding_balance"], str(self.invoice.total))

    def test_client_invoices(self):
        self.client.force_authenticate(self.client_user)
        url = reverse("client-portal:client-invoices-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        invoice = response.data["results"][0]
        self.assertEqual(invoice["id"], str(self.invoice.id))
        self.assertEqual(invoice["matter_title"], self.matter.title)

    def test_invitation_accept_links_client_profile(self):
        pending_client = Client.objects.create(
            organization=self.organization,
            display_name="Pending Client",
            primary_email="newclient@example.com",
        )
        invitation = Invitation.issue(
            email="newclient@example.com",
            role=self.client_role,
            organization=self.organization,
            invited_by=self.staff_user,
            client=pending_client,
            ttl_hours=1,
        )
        payload = {
            "token": invitation.token,
            "first_name": "New",
            "last_name": "Client",
            "password": "Passw0rd!123",
        }
        url = reverse("auth:invite-accept")
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.STATUS_ACCEPTED)
        pending_client.refresh_from_db()
        self.assertEqual(invitation.client_id, pending_client.id)
        self.assertEqual(pending_client.portal_user.email, "newclient@example.com")
