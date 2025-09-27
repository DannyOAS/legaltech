from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from accounts.models import Invitation, Organization, Role


class InvitationTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Test Org", region="ON")
        self.role = Role.objects.create(name="Owner", organization=self.org)

    def test_issue_creates_unique_token(self):
        invitation = Invitation.issue("user@example.com", self.role, self.org, ttl_hours=1)
        self.assertTrue(invitation.token)
        self.assertTrue(invitation.is_valid())

    def test_expired_invitation_invalid(self):
        invitation = Invitation.issue("user2@example.com", self.role, self.org, ttl_hours=1)
        invitation.expires_at = timezone.now() - timedelta(hours=2)
        invitation.save(update_fields=["expires_at"])
        self.assertFalse(invitation.is_valid())
