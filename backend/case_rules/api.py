"""API endpoint for calculating case deadlines."""
from __future__ import annotations

from datetime import date, datetime
from django.conf import settings
from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOrganizationMember

from config.tenancy import OrganizationScopedPrimaryKeyRelatedField
from matters.models import Matter, CaseDeadline
from services.audit.logging import audit_action

from .engine import Deadline, calculate_deadlines


class DeadlineRequestSerializer(serializers.Serializer):
    event_type = serializers.CharField()
    filing_date = serializers.DateField()
    court = serializers.CharField(required=False, default="ONSC")
    matter_id = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Matter.objects.all(), 
        required=False, 
        allow_null=True
    )
    save_deadlines = serializers.BooleanField(default=False)


class DeadlineSerializer(serializers.Serializer):
    name = serializers.CharField()
    due_date = serializers.DateField()
    rule_reference = serializers.CharField()


class CalculateDeadlinesView(APIView):
    permission_classes = [IsAuthenticated, IsOrganizationMember]

    def post(self, request):
        serializer = DeadlineRequestSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        payload = serializer.validated_data
        
        deadlines = calculate_deadlines(
            payload["event_type"],
            payload["filing_date"],
            court=payload.get("court", "ONSC"),
        )
        
        data = DeadlineSerializer(deadlines, many=True).data
        saved_deadlines = []
        
        # Save deadlines if requested and feature is enabled
        print(f"DEBUG: save_deadlines={payload.get('save_deadlines')}, matter_id={payload.get('matter_id')}, feature_enabled={getattr(settings, 'FEATURE_CASE_TRACKER', False)}")
        if (payload.get("save_deadlines") and 
            payload.get("matter_id") and 
            getattr(settings, 'FEATURE_CASE_TRACKER', False)):
            
            matter = payload["matter_id"]
            
            for deadline in deadlines:
                # Convert date to datetime for storage
                due_datetime = timezone.make_aware(
                    datetime.combine(deadline.due_date, datetime.min.time())
                )
                
                case_deadline = CaseDeadline.objects.create(
                    organization=request.user.organization,
                    matter=matter,
                    title=deadline.name,
                    deadline_type=payload["event_type"],
                    due_date=due_datetime,
                    rule_reference=deadline.rule_reference,
                    priority=deadline.priority,
                    created_by=request.user
                )
                saved_deadlines.append(case_deadline.id)
                
                audit_action(
                    request.organization_id,
                    request.user.id,
                    "deadline.created_from_calculation",
                    "deadline",
                    str(case_deadline.id),
                    request
                )
        
        response_data = {"deadlines": data}
        if saved_deadlines:
            response_data["saved_deadline_ids"] = saved_deadlines
            
        return Response(response_data, status=status.HTTP_200_OK)
