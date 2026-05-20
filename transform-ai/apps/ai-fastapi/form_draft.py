import re
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session
from pgvector.sqlalchemy import Vector
from db import AI_DB_SCHEMA


FIELD_LINE_RE = re.compile(
    r"""
    ^\s*
    (?P<label>
        (?:[A-Z][A-Za-z0-9 /()&\-]{2,}?)
    )
    \s*
    (?:
        :|\-|\u2014|\u2013|\.\.\.|_{2,}
    )
    \s*
    (?P<tail>.*)
    $
    """,
    re.VERBOSE
)

YESNO_HINT_RE = re.compile(r"\b(yes\s*/\s*no|yes\s+no|yes|no)\b", re.IGNORECASE)
DATE_HINT_RE = re.compile(r"\b(date|dob)\b", re.IGNORECASE)
EMAIL_HINT_RE = re.compile(r"\b(email|e-mail)\b", re.IGNORECASE)
PHONE_HINT_RE = re.compile(r"\b(phone|mobile|cell)\b", re.IGNORECASE)
SIGN_HINT_RE = re.compile(r"\b(signature|sign)\b", re.IGNORECASE)
IMAGE_HINT_RE = re.compile(r"\b(image|photo|picture|selfie|avatar)\b", re.IGNORECASE)
NUMBER_HINT_RE = re.compile(r"\b(number|qty|quantity|count|age)\b", re.IGNORECASE)
SECTION_HEADER_RE = re.compile(
    r"^\s*(?:No\.\s*)?(?P<section>.+?)\s+Satisfactory\s+Unsatisfactory\s+Not\s*applicable\s*$",
    re.IGNORECASE,
)
NUMBERED_ITEM_RE = re.compile(r"^\s*(?P<num>\d{1,3})[.)-]\s+(?P<text>.+?)\s*$")

DEFAULT_FIELDS: List[Dict[str, Any]] = [
    {"label": "Name", "key": "name", "controlType": "text", "raw": ""},
    {"label": "Date", "key": "date", "controlType": "date", "raw": ""},
    {"label": "Notes", "key": "notes", "controlType": "text", "raw": ""},
]

PDF_TYPE_MAP = {
    "/Tx": "text",
    "/Btn": "checkbox",
    "/Ch": "dropdown",
    "/Sig": "signature",
}


def vector_search(db: Session, app_code: str, qvec: List[float], top_k: int) -> List[Dict[str, Any]]:
    sql = text("""
      SELECT
        c.document_id::text as document_id,
        d.source_path as source_path,
        d.title as title,
        c.chunk_index as chunk_index,
        c.content as content,
        (1 - (c.embedding <=> :qvec)) as score
      FROM "{AI_DB_SCHEMA}".ai_chunks c
      JOIN "{AI_DB_SCHEMA}".ai_documents d ON d.id = c.document_id
      WHERE d.app_code = :app_code
      ORDER BY c.embedding <=> :qvec
      LIMIT :top_k
    """).bindparams(
        bindparam("qvec", type_=Vector(384)),
    )

    rows = db.execute(sql, {"qvec": qvec, "app_code": app_code, "top_k": top_k}).mappings().all()
    return [dict(r) for r in rows]


def guess_control_type(label: str, tail: str) -> str:
    s = f"{label} {tail}".lower()

    if SIGN_HINT_RE.search(s):
        return "signature"
    if DATE_HINT_RE.search(s):
        return "date"
    if EMAIL_HINT_RE.search(s):
        return "email"
    if PHONE_HINT_RE.search(s):
        return "phone"
    if IMAGE_HINT_RE.search(s):
        return "image"
    if YESNO_HINT_RE.search(s):
        return "checkbox"
    if NUMBER_HINT_RE.search(s):
        return "number"
    return "text"


def normalize_key(label: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", label.strip().lower()).strip("_")
    if not key:
        key = "field"
    return key


def fields_from_pdf_meta(metas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    fields: List[Dict[str, Any]] = []
    seen = set()

    for meta in metas:
        for pdf_field in meta.get("pdf_form_fields", []) or []:
            label = str(pdf_field.get("name") or "").strip()
            if not label:
                continue

            key = normalize_key(label)
            if key in seen:
                suffix = 2
                while f"{key}_{suffix}" in seen:
                    suffix += 1
                key = f"{key}_{suffix}"
            seen.add(key)

            pdf_type = pdf_field.get("type")
            control_type = PDF_TYPE_MAP.get(pdf_type, "text")
            if control_type == "text":
                inferred_control_type = guess_control_type(label, "")
                if inferred_control_type in ("text", "number", "date", "image"):
                    control_type = inferred_control_type
            if control_type in ("signature", "email", "phone"):
                control_type = "text"

            props: Dict[str, Any] = {}
            options = pdf_field.get("options") or []
            if options and control_type in ("dropdown", "multiselect"):
                props["options"] = [
                    {"label": str(opt), "value": normalize_key(str(opt))}
                    for opt in options
                ]

            fields.append({
                "label": label,
                "key": key,
                "controlType": control_type,
                "raw": "",
                "props": props,
            })

    return fields


def extract_fields_from_text(text_blob: str, max_fields: int = 30) -> List[Dict[str, Any]]:
    fields: List[Dict[str, Any]] = []
    seen = set()

    for raw in text_blob.splitlines():
        line = raw.strip()
        if not line or len(line) < 4:
            continue

        m = FIELD_LINE_RE.match(line)
        if not m:
            continue

        label = m.group("label").strip()
        tail = (m.group("tail") or "").strip()

        if len(label) > 60:
            continue

        key = normalize_key(label)
        if key in seen:
            continue
        seen.add(key)

        ctype = guess_control_type(label, tail)
        fields.append({"label": label, "key": key, "controlType": ctype, "raw": line})

        if len(fields) >= max_fields:
            break

    return fields


def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def build_form_definition(title: str, fields: List[Dict[str, Any]]) -> Dict[str, Any]:
    root = {
        "id": uid("layout"),
        "type": "layout",
        "layoutType": "form",
        "label": title,
        "children": []
    }

    section = {
        "id": uid("layout"),
        "type": "layout",
        "layoutType": "section",
        "label": "Section 1",
        "children": []
    }

    for f in fields:
        control_type = f["controlType"]
        if control_type in ("signature", "email", "phone"):
            control_type = "text"

        node = {
            "id": uid("ctrl"),
            "type": "control",
            "controlType": control_type,
            "key": f["key"],
            "label": f["label"],
            "props": f.get("props", {}) or {},
        }
        section["children"].append(node)

    root["children"].append(section)

    return {"root": root}


def extract_checklist_sections(text_blob: str, max_items_total: int = 200) -> List[Dict[str, Any]]:
    fields: List[Dict[str, Any]] = []
    current_section: Optional[str] = None
    seen_keys = set()

    total_items = 0
    for raw in text_blob.splitlines():
        line = raw.strip()
        if not line:
            continue

        # Match the inspection form header row to start a checklist section.
        m = SECTION_HEADER_RE.match(line)
        if m:
            current_section = m.group("section").strip().title()
            continue

        m2 = NUMBERED_ITEM_RE.match(line)
        if m2:
            if not current_section:
                # Fallback when the header row is missing in extracted text.
                current_section = "Checklist"

            num = m2.group("num")
            item_text = m2.group("text").strip()

            base_key = normalize_key(current_section)
            key = f"{base_key}__{num}"
            if key in seen_keys:
                continue
            seen_keys.add(key)

            label = f"{current_section} - {num}. {item_text}"

            fields.append({
                "label": label,
                "key": key,
                "controlType": "multiselect",
                "raw": line,
                "props": {
                    "options": [
                        {"label": "Satisfactory", "value": "satisfactory"},
                        {"label": "Unsatisfactory", "value": "unsatisfactory"},
                        {"label": "Not applicable", "value": "not_applicable"},
                    ]
                },
            })

            total_items += 1
            if total_items >= max_items_total:
                break

    return fields


def extract_draft_fields(text_blob: str, max_fields: int = 30, max_items_total: int = 200) -> List[Dict[str, Any]]:
    header_fields = extract_fields_from_text(text_blob, max_fields=max_fields)
    checklist_fields = extract_checklist_sections(text_blob, max_items_total=max_items_total)
    return header_fields + checklist_fields
