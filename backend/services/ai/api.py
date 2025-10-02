"""API endpoint for contract analysis stub."""

from __future__ import annotations

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOrganizationMember
from services.audit.logging import audit_action

from .contracts import analyze_contract


class ContractAnalysisRequest(serializers.Serializer):
    text = serializers.CharField()
    jurisdiction = serializers.CharField(required=False, default="ON")
    document_id = serializers.UUIDField(required=False, allow_null=True)


class ContractAnalysisResponse(serializers.Serializer):
    jurisdiction = serializers.CharField()
    missing_clauses = serializers.ListField(child=serializers.CharField())
    risky_terms = serializers.ListField(child=serializers.CharField())


class ContractAnalysisView(APIView):
    """Ontario-compliant contract analysis for legal documents."""

    permission_classes = [IsAuthenticated, IsOrganizationMember]

    def post(self, request):
        serializer = ContractAnalysisRequest(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        # Analyze contract text using Ontario legal standards
        result = analyze_contract(payload["text"], jurisdiction=payload.get("jurisdiction", "ON"))

        # Audit the analysis request for compliance tracking
        audit_action(
            request.organization_id,
            request.user.id,
            "ai.contract_analyzed",
            "document" if payload.get("document_id") else "text",
            str(payload["document_id"]) if payload.get("document_id") else "standalone",
            request,
            metadata={
                "jurisdiction": result["jurisdiction"],
                "missing_clause_count": len(result["missing_clauses"]),
                "risk_term_count": len(result["risky_terms"]),
                "text_length": len(payload["text"]),
            },
        )

        return Response(result, status=status.HTTP_200_OK)
