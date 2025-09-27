from django.http import HttpResponse
from django.test import RequestFactory, TestCase

from accounts.models import Organization, User
from core.middleware import TenantContextMiddleware


class TenantContextMiddlewareTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Tenant Org", region="ON")
        self.user = User.objects.create_user(
            email="user@tenant.ca",
            password="Passw0rd!123",
            first_name="Test",
            last_name="User",
            organization=self.org,
        )
        self.factory = RequestFactory()

    def test_sets_request_organization(self):
        request = self.factory.get("/")
        request.user = self.user
        middleware = TenantContextMiddleware(lambda req: HttpResponse("ok"))
        middleware(request)
        self.assertEqual(request.organization_id, self.org.id)
