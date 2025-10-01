"""Helpers for rendering invoice PDFs."""
from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Sequence

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from .models import Invoice


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf_stream(lines: Sequence[str]) -> bytes:
    stream_lines = ["BT", "/F1 16 Tf", "72 720 Td", f"({_escape_pdf_text(lines[0])}) Tj"]
    for line in lines[1:]:
        stream_lines.append("T*")
        stream_lines.append(f"({_escape_pdf_text(line)}) Tj")
    stream_lines.append("ET")
    stream = "\n".join(stream_lines).encode("latin-1")
    return stream


def render_invoice_pdf(invoice: Invoice) -> bytes:
    matter = invoice.matter
    client_name = getattr(matter.client, "display_name", "Client") if matter else "Client"
    lines = [
        f"Invoice {invoice.number}",
        f"Matter: {matter.title if matter else 'Unknown Matter'}",
        f"Client: {client_name}",
        f"Issued: {invoice.issue_date.isoformat()}",
        f"Due: {invoice.due_date.isoformat()}",
        "",
        f"Subtotal: ${invoice.subtotal}",
        f"Tax: ${invoice.tax_total}",
        f"Total: ${invoice.total}",
    ]
    stream = _build_pdf_stream(lines)
    buffer = BytesIO()
    buffer.write(b"%PDF-1.4\n")
    offsets = [0]

    def write_obj(obj: bytes) -> None:
        offsets.append(buffer.tell())
        buffer.write(obj)
        if not obj.endswith(b"\n"):
            buffer.write(b"\n")

    write_obj(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj")
    write_obj(b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj")
    write_obj(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>endobj"
    )
    write_obj(f"4 0 obj<< /Length {len(stream)} >>stream\n".encode("latin-1") + stream + b"\nendstream")
    write_obj(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj")

    xref_offset = buffer.tell()
    buffer.write(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    buffer.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.write(f"{offset:010} 00000 n \n".encode("latin-1"))
    buffer.write(b"trailer<< /Size 6 /Root 1 0 R >>\n")
    buffer.write(f"startxref\n{xref_offset}\n%%EOF".encode("latin-1"))
    return buffer.getvalue()


def save_invoice_pdf(invoice: Invoice, *, storage_path: str | None = None) -> str:
    pdf_bytes = render_invoice_pdf(invoice)
    if storage_path is None:
        storage_path = f"{invoice.organization_id}/invoices/{invoice.number}.pdf"
    content = ContentFile(pdf_bytes)
    if default_storage.exists(storage_path):
        default_storage.delete(storage_path)
    default_storage.save(storage_path, content)
    return storage_path


def ensure_invoice_pdf(invoice: Invoice) -> None:
    if invoice.pdf_file:
        return
    path = save_invoice_pdf(invoice)
    invoice.pdf_file = path
    invoice.save(update_fields=["pdf_file"])


def regenerate_invoice_pdf(invoice: Invoice) -> None:
    path = save_invoice_pdf(invoice)
    invoice.pdf_file = path
    invoice.save(update_fields=["pdf_file"])
