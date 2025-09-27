from datetime import date

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from accounts.models import Organization, User
from billing.models import Expense, Invoice, TimeEntry
from billing.views import BillingSummaryView
from matters.models import Client, Matter


class BillingSummaryTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.org = Organization.objects.create(name="Billing Org", region="ON")
        self.user = User.objects.create_user(
            email="bill@example.com",
            password="Passw0rd!123",
            first_name="Bill",
            last_name="Able",
            organization=self.org,
        )
        client = Client.objects.create(
            organization=self.org,
            display_name="Client",
            primary_email="client@example.com",
        )
        matter = Matter.objects.create(
            organization=self.org,
            client=client,
            title="Matter",
            practice_area="Civil",
            status="open",
            opened_at=date.today(),
            reference_code="MAT-1",
        )
        TimeEntry.objects.create(
            organization=self.org,
            matter=matter,
            user=self.user,
            description="Work",
            minutes=120,
            rate=300,
            date=date.today(),
        )
        Expense.objects.create(
            organization=self.org,
            matter=matter,
            description="Expense",
            amount=100,
            date=date.today(),
        )
        Invoice.objects.create(
            organization=self.org,
            matter=matter,
            number="INV-1",
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=600,
            tax_total=78,
            total=678,
            status="sent",
        )

    def test_summary_values(self):
        request = self.factory.get("/api/v1/reports/billing-summary/")
        request.organization_id = self.org.id
        response = BillingSummaryView.as_view()(request)
        self.assertEqual(response.data["total_hours"], "2.00")
        self.assertEqual(response.data["total_expenses"], "100.00")
