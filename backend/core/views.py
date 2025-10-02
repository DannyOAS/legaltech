"""Miscellaneous API views."""

from __future__ import annotations

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView


class SettingsView(APIView):
    """Expose feature flags and compliance metadata."""

    def get(self, request):
        return Response(
            {
                "organization_id": request.organization_id,
                "features": {
                    "contract_analysis": settings.FEATURE_CONTRACT_ANALYSIS,
                    "case_tracker": settings.FEATURE_CASE_TRACKER,
                    "ai_research": settings.FEATURE_AI_RESEARCH,
                },
                "ca_region": settings.CA_REGION,
                "storage_bucket": settings.S3_BUCKET_NAME,
            }
        )
