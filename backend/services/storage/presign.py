"""Helper functions to generate presigned URLs for document flows."""

from __future__ import annotations

import boto3
from botocore.config import Config
from django.conf import settings

_internal_client = None
_signing_client = None


def _client():
    global _internal_client
    if _internal_client is None:
        _internal_client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            region_name=settings.CA_REGION,
            config=Config(
                s3={"addressing_style": "path" if settings.S3_USE_PATH_STYLE else "virtual"}
            ),
        )
    return _internal_client


def _signer():
    global _signing_client
    if _signing_client is None:
        endpoint = getattr(settings, "S3_EXTERNAL_ENDPOINT_URL", "") or settings.S3_ENDPOINT_URL
        _signing_client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=settings.CA_REGION,
            config=Config(
                s3={"addressing_style": "path" if settings.S3_USE_PATH_STYLE else "virtual"}
            ),
        )
    return _signing_client


def generate_put_url(
    org_id: str,
    key: str,
    content_type: str = "application/octet-stream",
    content_length: int | None = None,
) -> dict:
    params = {"Bucket": settings.S3_BUCKET_NAME, "Key": key, "ContentType": content_type}
    url = _signer().generate_presigned_url("put_object", Params=params, ExpiresIn=300)
    headers = {"Content-Type": content_type}
    return {"url": url, "headers": headers}


def generate_get_url(org_id: str, key: str) -> dict:
    url = _signer().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=300,
    )
    return {"url": url}
