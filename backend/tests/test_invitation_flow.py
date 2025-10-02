from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Invitation, Organization, Role, User, UserRole


class InvitationAcceptTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Org", region="ON")
        self.role = Role.objects.create(name="Client", organization=self.organization)
        self.admin_role = Role.objects.create(name="Admin", organization=self.organization)
        self.inviter = User.objects.create_user(
            email="owner@example.com",
            password="Passw0rd!123",
            first_name="Owner",
            last_name="One",
            organization=self.organization,
        )
        UserRole.objects.create(user=self.inviter, role=self.admin_role)

    def test_accepts_invitation_and_creates_user(self):
        invitation = Invitation.issue(
            email="client@example.com",
            role=self.role,
            organization=self.organization,
            invited_by=self.inviter,
            ttl_hours=24,
        )
        payload = {
            "token": invitation.token,
            "first_name": "Client",
            "last_name": "Test",
            "password": "Passw0rd!123",
        }
        url = reverse("auth:invite-accept")
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email="client@example.com").exists())
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, Invitation.STATUS_ACCEPTED)

    def test_rejects_expired_invitation(self):
        invitation = Invitation.issue(
            email="client2@example.com",
            role=self.role,
            organization=self.organization,
            invited_by=self.inviter,
            ttl_hours=-1,
        )
        payload = {
            "token": invitation.token,
            "first_name": "Client",
            "last_name": "Expired",
            "password": "Passw0rd!123",
        }
        url = reverse("auth:invite-accept")
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_invitation_creation_stores_metadata(self):
        self.client.force_authenticate(self.inviter)
        url = reverse("invitation-list")
        payload = {
            "email": "paralegal@example.com",
            "role": str(self.admin_role.id),
            "metadata": {"source": "org_settings"},
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        invitation = Invitation.objects.get(email="paralegal@example.com")
        self.assertEqual(invitation.metadata, {"source": "org_settings"})

    def test_invitation_resend_updates_last_sent(self):
        invitation = Invitation.issue(
            email="resend@example.com",
            role=self.role,
            organization=self.organization,
            invited_by=self.inviter,
            ttl_hours=24,
        )
        previous_sent = invitation.last_sent_at
        self.client.force_authenticate(self.inviter)
        url = reverse("invitation-resend", args=[invitation.id])
        response = self.client.post(url, format="json")
        self.assertEqual(response.status_code, 200)
        invitation.refresh_from_db()
        self.assertIsNotNone(invitation.last_sent_at)
        self.assertGreater(invitation.last_sent_at, previous_sent)

    def test_invitation_list_can_filter_by_status(self):
        pending = Invitation.issue(
            email="pending@example.com",
            role=self.admin_role,
            organization=self.organization,
            invited_by=self.inviter,
            ttl_hours=24,
        )
        accepted = Invitation.issue(
            email="accepted@example.com",
            role=self.admin_role,
            organization=self.organization,
            invited_by=self.inviter,
            ttl_hours=24,
        )
        accepted.mark_accepted()
        self.client.force_authenticate(self.inviter)
        url = reverse("invitation-list") + "?status=pending"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        emails = {item["email"] for item in response.data["results"]}
        self.assertIn(pending.email, emails)
        self.assertNotIn(accepted.email, emails)
