from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, Role, User, UserRole
from notifications.models import Notification


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Org", region="ON")
        self.user = User.objects.create_user(
            email="owner@example.com",
            password="Passw0rd!123",
            first_name="Owner",
            last_name="User",
            organization=self.organization,
        )
        role = Role.objects.create(name="Owner", organization=self.organization)
        UserRole.objects.create(user=self.user, role=role)
        self.client.force_authenticate(self.user)

    def test_list_notifications_scoped_to_user(self):
        Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type="test",
            title="Hello",
        )
        url = reverse("notification-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_mark_notification_read(self):
        notification = Notification.objects.create(
            organization=self.organization,
            recipient=self.user,
            notification_type="test",
            title="Hello",
        )
        url = reverse("notification-mark-read", args=[notification.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at)

    def test_only_recipient_can_mark_read(self):
        other_user = User.objects.create_user(
            email="other@example.com",
            password="Passw0rd!123",
            first_name="Other",
            last_name="User",
            organization=self.organization,
        )
        notification = Notification.objects.create(
            organization=self.organization,
            recipient=other_user,
            notification_type="test",
            title="Hi",
        )
        url = reverse("notification-mark-read", args=[notification.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
