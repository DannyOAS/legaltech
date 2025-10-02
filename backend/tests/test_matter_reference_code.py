from datetime import date

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, User
from matters.models import Client


class MatterReferenceCodeGenerationTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Demo Law", region="ON")
        self.user = User.objects.create_user(
            email="lawyer@example.com",
            password="Passw0rd!123",
            first_name="Law",
            last_name="Yer",
            organization=self.organization,
        )
        self.client_profile = Client.objects.create(
            organization=self.organization,
            display_name="Jane Client",
            primary_email="jane@example.com",
        )
        self.client.force_authenticate(self.user)
        self.url = reverse("matter-list")
        self.payload = {
            "client_id": str(self.client_profile.id),
            "title": "New Matter",
            "practice_area": "Civil",
            "status": "open",
            "opened_at": date.today().isoformat(),
        }

    def test_reference_code_auto_generated_when_omitted(self):
        # Refresh client_profile to get current ID in test database
        self.client_profile.refresh_from_db()
        payload = {**self.payload, "client_id": str(self.client_profile.id)}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        code = response.data["reference_code"]
        prefix = self.organization.get_matter_code_prefix()
        self.assertTrue(code.startswith(f"{prefix}-"))
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.next_matter_number, 2)

    def test_reference_code_sequence_increments(self):
        self.client_profile.refresh_from_db()
        payload = {**self.payload, "client_id": str(self.client_profile.id)}
        self.client.post(self.url, payload, format="json")
        second_payload = {**payload, "title": "Second Matter"}
        response = self.client.post(self.url, second_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        prefix = self.organization.get_matter_code_prefix()
        self.assertIn(f"{prefix}-", response.data["reference_code"])
        self.assertTrue(response.data["reference_code"].endswith("0002"))

    def test_manual_reference_code_respected(self):
        self.client_profile.refresh_from_db()
        payload = {
            **self.payload,
            "client_id": str(self.client_profile.id),
            "reference_code": "CUSTOM-001",
        }
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["reference_code"], "CUSTOM-001")
