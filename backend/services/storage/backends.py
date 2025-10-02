"""Custom storage backend for documents."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import boto3
from botocore.config import Config
from django.conf import settings
from django.core.files.storage import Storage


@dataclass
class S3Config:
    bucket_name: str
    endpoint_url: str | None
    region_name: str | None
    use_path_style: bool


class S3DocumentStorage(Storage):
    """Very small S3 wrapper leveraging boto3 presigned URLs."""

    def __init__(self, **options: Any) -> None:
        config = S3Config(
            bucket_name=options.get("bucket_name", settings.S3_BUCKET_NAME),
            endpoint_url=options.get("endpoint_url", settings.S3_ENDPOINT_URL),
            region_name=options.get("region_name", settings.CA_REGION),
            use_path_style=options.get("use_path_style", settings.S3_USE_PATH_STYLE),
        )
        self.config = config
        self.client = boto3.client(
            "s3",
            endpoint_url=config.endpoint_url,
            region_name=config.region_name,
            config=Config(s3={"addressing_style": "path" if config.use_path_style else "virtual"}),
        )

    def _open(self, name, mode="rb"):
        raise NotImplementedError("Direct file reads should use presigned URLs")

    def _save(self, name, content):
        self.client.upload_fileobj(content, self.config.bucket_name, name)
        return name

    def exists(self, name: str) -> bool:
        try:
            self.client.head_object(Bucket=self.config.bucket_name, Key=name)
            return True
        except self.client.exceptions.ClientError:  # pragma: no cover - network dependent
            return False

    def url(self, name: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.config.bucket_name, "Key": name},
            ExpiresIn=300,
        )
