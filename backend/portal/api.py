"""Portal routing."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DocumentViewSet, MessageThreadViewSet, MessageViewSet, ShareLinkResolveView, ShareLinkViewSet

router = DefaultRouter()
router.register("documents", DocumentViewSet, basename="document")
router.register("threads", MessageThreadViewSet, basename="thread")
router.register("messages", MessageViewSet, basename="message")
router.register("share-links", ShareLinkViewSet, basename="share-link")

urlpatterns = [
    path("share-links/resolve/<str:token>/", ShareLinkResolveView.as_view(), name="sharelink-resolve"),
]
