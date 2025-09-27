from django.test import RequestFactory, TestCase

from accounts.models import Organization
from services.audit.logging import audit_action
from services.audit.models import AuditEvent


class AuditTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Audit Org", region="ON")
        self.factory = RequestFactory()

    def test_audit_event_created(self):
        request = self.factory.get("/")
        audit_action(str(self.org.id), None, "test.action", "resource", "123", request)
        event = AuditEvent.objects.get(action="test.action")
        self.assertEqual(event.organization, self.org)
        self.assertEqual(event.resource_id, "123")
