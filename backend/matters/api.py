"""Matters API routing."""

from rest_framework.routers import DefaultRouter

from .views import ClientViewSet, MatterViewSet, CaseDeadlineViewSet

router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("matters", MatterViewSet, basename="matter")
router.register("deadlines", CaseDeadlineViewSet, basename="deadline")
