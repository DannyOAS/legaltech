"""Matters API routing."""
from rest_framework.routers import DefaultRouter

from .views import ClientViewSet, MatterViewSet

router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("matters", MatterViewSet, basename="matter")
