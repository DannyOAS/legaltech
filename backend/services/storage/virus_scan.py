"""Stubbed virus scanning hooks for document uploads."""
from __future__ import annotations

import logging
from dataclasses import dataclass

from django.utils import timezone

from portal.models import Document

logger = logging.getLogger(__name__)


@dataclass
class ScanRequest:
    organization_id: str
    document_id: str
    filename: str
    sha256: str


def schedule_scan(request: ScanRequest) -> None:
    """Placeholder for AV scanning pipeline."""
    logger.info(
        "virus scan scheduled",
        extra={
            "organization_id": request.organization_id,
            "document_id": request.document_id,
            "document_filename": request.filename,
        },
    )
    try:
        document = Document.objects.get(id=request.document_id)
    except Document.DoesNotExist:
        logger.warning("document missing for virus scan", extra={"document_id": request.document_id})
        return
    document.scan_status = "clean"
    document.scan_message = "Stub scan: clean"
    document.scan_checked_at = timezone.now()
    document.save(update_fields=["scan_status", "scan_message", "scan_checked_at"])
