from typing import Tuple, List, Optional
from pypdf import PdfReader

from chunker import chunk_text

def _coerce_pdf_options(options) -> Optional[List[str]]:
    if not options:
        return None
    normalized: List[str] = []
    for opt in options:
        if isinstance(opt, (list, tuple)) and opt:
            value = opt[-1]
        else:
            value = opt
        normalized.append(str(value))
    return normalized or None

def extract_pdf_text(path: str) -> Tuple[str, dict]:
    reader = PdfReader(path)
    fields = reader.get_fields() or {}
    pdf_fields = []
    for field_name, field_object in fields.items():
        field_type = field_object.get("/FT")
        field_flags = field_object.get("/Ff")
        pdf_fields.append({
            "name": str(field_name),
            "type": str(field_type) if field_type else None,
            "flags": int(field_flags) if field_flags is not None else None,
            "options": _coerce_pdf_options(field_object.get("/Opt")),
        })
    
    pages_text: List[str] = []
    for i, page in enumerate(reader.pages):
        t = page.extract_text() or ""
        pages_text.append(t)
    full = "\n\n".join(pages_text).strip()

    meta = {
        "pages": len(reader.pages),
    }
    if pdf_fields:
        # Preserve editable field metadata for draft generation.
        meta["pdf_form_fields"] = pdf_fields
    return full, meta

def pdf_to_chunks(path: str) -> Tuple[List[str], dict]:
    text, meta = extract_pdf_text(path)
    chunks = chunk_text(text)
    return chunks, meta
