import os
import tempfile
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam
from pgvector.sqlalchemy import Vector

from db import get_db
from models import AiDocument, AiChunk
from schemas import (
    IngestPdfRequest,
    IngestResponse,
    SearchRequest,
    SearchResponse,
    SearchHit,
    GenerateDraftReq,
    GenerateDraftResp,
    Citation,
)
from ingest_pdf import pdf_to_chunks
from embedder import embed_texts
from form_draft import (
    DEFAULT_FIELDS,
    build_form_definition,
    extract_draft_fields,
    fields_from_pdf_meta,
    normalize_key,
    vector_search,
)
from nest_client import nest_post, nest_put

app = FastAPI(title="Transform AI Service (Phase 1)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ingest/pdf", response_model=IngestResponse)
def ingest_pdf(req: IngestPdfRequest, db: Session = Depends(get_db)):
    path = req.path

    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail=f"File not found: {path}")

    chunks, pdf_meta = pdf_to_chunks(path)
    if not chunks:
        raise HTTPException(status_code=400, detail="No text extracted from PDF (is it scanned / image-only?)")

    # 1) create document row
    doc = AiDocument(
        app_code=req.appCode,
        source_type="pdf",
        source_path=path,
        title=req.title,
        meta={**pdf_meta, **(req.meta or {})},
    )
    db.add(doc)
    db.flush()  # get doc.id without commit

    # 2) embed chunks and insert
    vectors = embed_texts(chunks)

    to_insert = []
    for i, (content, vec) in enumerate(zip(chunks, vectors)):
        to_insert.append(
            AiChunk(
                document_id=doc.id,
                chunk_index=i,
                content=content,
                embedding=vec,
                meta={},
            )
        )

    db.add_all(to_insert)
    db.commit()

    return IngestResponse(documentId=str(doc.id), chunksInserted=len(to_insert))


@app.post("/ingest/pdf/upload", response_model=IngestResponse)
def ingest_pdf_upload(
    appCode: str = Form(...),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            temp_path = tmp.name
            tmp.write(file.file.read())

        chunks, pdf_meta = pdf_to_chunks(temp_path)
        if not chunks:
            raise HTTPException(status_code=400, detail="No text extracted from PDF (is it scanned / image-only?)")

        doc = AiDocument(
            app_code=appCode,
            source_type="pdf",
            source_path=file.filename,
            title=title,
            meta=pdf_meta,
        )
        db.add(doc)
        db.flush()

        vectors = embed_texts(chunks)
        to_insert = [
            AiChunk(
                document_id=doc.id,
                chunk_index=i,
                content=content,
                embedding=vec,
                meta={},
            )
            for i, (content, vec) in enumerate(zip(chunks, vectors))
        ]

        db.add_all(to_insert)
        db.commit()
        return IngestResponse(documentId=str(doc.id), chunksInserted=len(to_insert))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest, db: Session = Depends(get_db)):
    qvec = embed_texts([req.query])[0]

    # cosine distance: smaller is closer
    # score = 1 - distance (so higher is better)
    sql = text("""
      SELECT
        c.document_id::text as document_id,
        d.source_path as source_path,
        d.title as title,
        c.chunk_index as chunk_index,
        c.content as content,
        (1 - (c.embedding <=> :qvec)) as score,
        c.meta as meta
      FROM ai_chunks c
      JOIN ai_documents d ON d.id = c.document_id
      WHERE d.app_code = :app_code
      ORDER BY c.embedding <=> :qvec
      LIMIT :top_k
    """).bindparams(
        bindparam("qvec", type_=Vector(384)),
    )

    rows = db.execute(sql, {"qvec": qvec, "app_code": req.appCode, "top_k": req.topK}).mappings().all()

    hits = [
        SearchHit(
            documentId=r["document_id"],
            sourcePath=r["source_path"],
            title=r["title"],
            chunkIndex=r["chunk_index"],
            content=r["content"],
            score=float(r["score"]),
            meta=r["meta"] or {},
        )
        for r in rows
    ]

    return SearchResponse(hits=hits)


@app.post("/generate/form-draft", response_model=GenerateDraftResp)
def generate_form_draft(req: GenerateDraftReq, db: Session = Depends(get_db)):
    qvec = embed_texts([req.query])[0]
    if not isinstance(qvec, list) or not qvec:
        raise HTTPException(status_code=500, detail="Embedding failed or returned empty vector")

    hits = vector_search(db, req.appCode, qvec, req.topK)
    if not hits:
        raise HTTPException(status_code=404, detail="No chunks found for this appCode yet")

    doc_ids = list({h["document_id"] for h in hits})
    doc_metas = [
        doc.meta or {}
        for doc in db.query(AiDocument).filter(AiDocument.id.in_(doc_ids)).all()
    ]
    extracted_fields = fields_from_pdf_meta(doc_metas)
    if not extracted_fields:
        combined = "\n\n".join(h["content"] for h in hits if h.get("content"))
        extracted_fields = extract_draft_fields(combined, max_fields=30, max_items_total=200)

    if not extracted_fields:
        extracted_fields = list(DEFAULT_FIELDS)

    title = req.title or req.query.strip()[:60] or "Generated Draft"
    schema = build_form_definition(title, extracted_fields)

    citations: List[Citation] = []
    for h in hits:
        preview = (h.get("content") or "")[:220].replace("\n", " ").strip()
        citations.append(Citation(
            documentId=h["document_id"],
            title=h.get("title"),
            sourcePath=h.get("source_path"),
            chunkIndex=int(h["chunk_index"]),
            score=float(h["score"]),
            contentPreview=preview
        ))

    return GenerateDraftResp(
        schema=schema,
        citations=citations,
        extracted={
            "fields": extracted_fields,
            "chunksUsed": len(hits),
        }
    )

@app.post("/generate/form-draft-and-save")
def generate_and_save_form_draft(
    req: GenerateDraftReq,
    db: Session = Depends(get_db),
):
    # 1) Generate schema (reuse existing logic)
    qvec = embed_texts([req.query])[0]
    hits = vector_search(db, req.appCode, qvec, req.topK)

    if not hits:
        raise HTTPException(status_code=404, detail="No matching content found")

    combined = "\n\n".join(h["content"] for h in hits if h.get("content"))
    doc_ids = list({h["document_id"] for h in hits})
    doc_metas = [
        doc.meta or {}
        for doc in db.query(AiDocument).filter(AiDocument.id.in_(doc_ids)).all()
    ]
    fields = fields_from_pdf_meta(doc_metas)
    if not fields:
        fields = extract_draft_fields(combined, max_fields=30, max_items_total=200)
    if not fields:
        fields = list(DEFAULT_FIELDS)

    title = req.title or req.query.strip()[:60]
    schema = build_form_definition(title, fields)

    # 2) Save to Nest (draft)
    form_key = req.formKey or normalize_key(title)

    payload = {
        "title": title,
        "schemaJson": schema,
    }

    # Try update first
    update_res = nest_put(
        f"/internal/apps/{req.appCode.upper()}/forms/{form_key}/draft",
        payload,
    )

    if "_error" in update_res:
        # Draft doesn't exist → create
        create_res = nest_post(
            f"/internal/apps/{req.appCode.upper()}/forms",
            {
                "formKey": form_key,
                "title": title,
                "schemaJson": schema,
            },
        )
        if "_error" in create_res:
            raise HTTPException(status_code=create_res["_error"], detail=create_res.get("_body") or "Nest API error")
        saved_form = create_res
    else:
        saved_form = update_res

    # 3) Citations
    citations = [
        {
            "documentId": h["document_id"],
            "title": h.get("title"),
            "sourcePath": h.get("source_path"),
            "chunkIndex": int(h["chunk_index"]),
            "score": float(h["score"]),
            "contentPreview": (h.get("content") or "")[:200],
        }
        for h in hits
    ]

    return {
        "formKey": form_key,
        "schema": schema,
        "form": saved_form,
        "citations": citations,
        "extracted": {
            "fields": fields,
            "chunksUsed": len(hits),
        },
    }
