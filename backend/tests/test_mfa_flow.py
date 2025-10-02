from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.mfa import generate_secret, generate_totp
from accounts.models import Organization, User


class MFALoginTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Org", region="ON")
        self.user = User.objects.create_user(
            email="mfa@example.com",
            password="Passw0rd!123",
            first_name="Mfa",
            last_name="User",
            organization=self.organization,
        )
        self.user.mfa_secret = generate_secret()
        self.user.mfa_enabled = True
        self.user.save(update_fields=["mfa_secret", "mfa_enabled"])

    def test_login_requires_otp(self):
        url = reverse("auth:login")
        response = self.client.post(
            url, {"email": self.user.email, "password": "Passw0rd!123"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("mfa", response.data.get("detail", "").lower())

    def test_login_with_otp(self):
        url = reverse("auth:login")
        response = self.client.post(
            url,
            {
                "email": self.user.email,
                "password": "Passw0rd!123",
                "otp": generate_totp(self.user.mfa_secret),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
