"""API endpoint for calculating case deadlines."""

from __future__ import annotations

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .engine import calculate_deadlines


class DeadlineRequestSerializer(serializers.Serializer):
    event_type = serializers.CharField()
    filing_date = serializers.DateField()
    court = serializers.CharField(required=False, default="ONSC")


class DeadlineSerializer(serializers.Serializer):
    name = serializers.CharField()
    due_date = serializers.DateField()
    rule_reference = serializers.CharField()


class CalculateDeadlinesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeadlineRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        deadlines = calculate_deadlines(
            payload["event_type"],
            payload["filing_date"],
            court=payload.get("court", "ONSC"),
        )
        data = DeadlineSerializer(deadlines, many=True).data
        return Response({"deadlines": data}, status=status.HTTP_200_OK)
