from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

class IngestPdfRequest(BaseModel):
    appCode: str = Field(min_length=1)
    path: str = Field(min_length=1)   # local path for Phase 1
    title: Optional[str] = None
    meta: Dict[str, Any] = {}

class IngestResponse(BaseModel):
    documentId: str
    chunksInserted: int

class SearchRequest(BaseModel):
    appCode: str = Field(min_length=1)
    query: str = Field(min_length=1)
    topK: int = Field(default=8, ge=1, le=50)

class SearchHit(BaseModel):
    documentId: str
    sourcePath: str
    title: Optional[str]
    chunkIndex: int
    content: str
    score: float
    meta: Dict[str, Any]

class SearchResponse(BaseModel):
    hits: List[SearchHit]

class GenerateDraftReq(BaseModel):
    appCode: str
    query: str
    topK: int = 8
    formKey: Optional[str] = None
    title: Optional[str] = None

class Citation(BaseModel):
    documentId: str
    title: Optional[str] = None
    sourcePath: Optional[str] = None
    chunkIndex: int
    score: float
    contentPreview: str

class GenerateDraftResp(BaseModel):
    schema: Dict[str, Any]
    citations: List[Citation]
    extracted: Dict[str, Any]
