# AGENTS.md — Project Transform + Transform AI

This document defines architecture, coding standards, workflows, and AI-agent rules
for the following projects:

- project-transform
  - apps/api-nest (NestJS backend)
  - apps/admin-nextjs (Next.js admin)
- transform-ai
  - apps/ai-fastapi (FastAPI + RAG + embeddings)

The goal of the platform is:

> Build a server-driven form platform where AI can ingest PDFs/documents,
> extract structured fields, generate draft schemas, and save them into the
> main NestJS form system.

--------------------------------------------------------------------
# 1. High-Level Architecture
--------------------------------------------------------------------

## Core Services

### A) api-nest (Primary Business Backend)
Stack:
- NestJS
- Prisma
- PostgreSQL
- JWT auth
- Role-based access

Responsibilities:
- Apps management
- Forms CRUD/versioning/publishing
- Authentication
- Authorization
- Main business logic
- Form persistence

Primary ownership:
- Source of truth for forms
- Published versions
- User/session management

---

### B) admin-nextjs (Admin UI)
Stack:
- Next.js App Router
- React Query
- Zustand
- Tailwind
- TypeScript

Responsibilities:
- Form designer
- Admin UI
- App management
- Publishing forms
- AI draft review/edit flow

---

### C) ai-fastapi (AI Service)
Stack:
- FastAPI
- pgvector
- sentence-transformers
- PostgreSQL
- PyPDF2

Responsibilities:
- PDF ingestion
- Embeddings generation
- Vector search
- RAG retrieval
- AI form draft generation
- Semantic document search

IMPORTANT:
This service does NOT own forms.
It only generates drafts and saves them through api-nest APIs.

--------------------------------------------------------------------
# 2. Architecture Rules
--------------------------------------------------------------------

## Source of Truth

### Forms
ONLY api-nest owns:
- forms table
- publishing
- versioning
- draft persistence

ai-fastapi MUST NEVER write directly to forms DB tables bypassing Nest APIs.

---

## AI Service Communication

ai-fastapi communicates with api-nest through internal HTTP APIs only.

Example:
- POST /internal/apps/:appCode/forms
- PUT /internal/apps/:appCode/forms/:formKey/draft

DO NOT directly import Prisma models into FastAPI.

---

## Database Ownership

### Shared PostgreSQL
Allowed:
- ai-fastapi owns:
  - ai_documents
  - ai_chunks

- api-nest owns:
  - apps
  - forms
  - users
  - auth-related tables

DO NOT mix ownership responsibilities.

--------------------------------------------------------------------
# 3. AI/RAG Architecture
--------------------------------------------------------------------

## Ingestion Pipeline

PDF
→ extract text
→ chunk text
→ generate embeddings
→ store vectors
→ semantic retrieval
→ schema inference
→ draft form generation

---

## Why embeddings exist

Embeddings are REQUIRED because:
- PDFs vary heavily
- semantic retrieval is needed
- future multi-document support is required
- grounding/citations are required
- scalable RAG architecture is intended

DO NOT replace vector search with keyword-only search.

---

## Hybrid Extraction Strategy

Use:
1. PDF AcroForm extraction (`reader.get_fields()`)
2. Text extraction heuristics
3. Checklist/table detection
4. Semantic retrieval

ALL FOUR approaches are valid and complementary.

Never rely on only one extraction method.

--------------------------------------------------------------------
# 4. Form Schema Rules
--------------------------------------------------------------------

## Canonical Schema Shape

All generated schemas MUST follow:

```ts
{
  root: {
    id: string;
    type: "layout";
    layoutType: "form";
    children: Node[];
  }
}```

Control Node Shape

{
  id: string;
  type: "control";
  controlType: string;
  key: string;
  label: string;
  props: Record<string, any>;
}

Layout Node Shape

{
  id: string;
  type: "layout";
  layoutType: string;
  children: Node[];
}

Supported Control Types

Current supported:

text
textarea
number
date
dropdown
checkbox
multiselect
signature

Preferred future:

radio
file
image
table
repeatable section
Control Mapping Rules
PDF text fields

→ text/date/number/etc.

Checklist rows

Example:

Satisfactory
Unsatisfactory
Not applicable

Should become:

radio group
OR
dropdown

NOT free text.

5. NestJS Rules
Controller Rules

Controllers:

thin only
no business logic
delegate to services
Service Rules

Services:

contain business logic
validate ownership
enforce app boundaries
Authorization

Public endpoints:

explicit only

Internal AI endpoints:

use AiServiceGuard
use internal service token
DO NOT use user JWT auth

Example:
@UseGuards(AiServiceGuard)
@Post("internal/apps/:appCode/forms")

Draft Rules

Draft:

version = 0
status = draft

Published:

version >= 1
status = published

Older published:

archived
6. React / Frontend Rules
State Management
React Query

Use for:

server state
API data
caching
mutations
Zustand

Use for:

local designer state
drag/drop state
undo/redo
transient UI state

DO NOT duplicate React Query data into Zustand unnecessarily.

Query Key Rules

Always centralize query keys.

Example:
qk.forms(appCode)

Never inline random query keys across the app.

Form Designer Rules

Designer state MUST:

support undo/redo
support immutable updates
support nested layouts

Never mutate schema directly.

7. FastAPI Rules
FastAPI Ownership

FastAPI is:

retrieval layer
AI orchestration layer

It is NOT:

auth authority
forms authority
publishing authority
Embedding Rules

Current embedding model:

BAAI/bge-small-en-v1.5

Vector dimension:

384

If changing embedding model:

migration strategy MUST be defined
vector dimension changes MUST be coordinated
Chunking Rules

Chunks should:

preserve semantic meaning
avoid splitting checklist rows
avoid splitting sections mid-table

Preferred chunk size:

500–1200 chars semantic chunks

Avoid:

extremely tiny chunks
giant full-document chunks
8. Code Quality Rules
TypeScript

STRICT typing preferred.

Avoid:
any

Use:

DTOs
interfaces
zod/class-validator where appropriate
Python

Prefer:

typed functions
Pydantic models
small pure helper functions

Avoid giant monolithic functions.

Logging

Important operations MUST log:

ingest start/end
chunks inserted
vector search hit counts
schema generation events
internal API failures

Never log secrets/tokens.

9. Error Handling Rules
NestJS

Use:

BadRequestException
NotFoundException
UnauthorizedException

Avoid generic throw Error().

FastAPI

Use:
HTTPException(status_code=...)

Internal API Errors

FastAPI should gracefully handle:

Nest unavailable
invalid appCode
auth failures
malformed schemas

Return structured errors.

10. AI Agent Rules
IMPORTANT

AI agents MUST:

preserve architecture boundaries
avoid direct DB shortcuts
avoid rewriting unrelated files
avoid large unrequested refactors
Before modifying code

Agent MUST:

inspect existing architecture
reuse existing patterns
preserve DTOs/contracts
preserve appCode boundaries
AI-generated schema rules

Generated forms MUST:

include citations
include extracted fields metadata
preserve source traceability
Do NOT

Do NOT:

introduce new frameworks without request
convert to monorepo
bypass Prisma
bypass internal APIs
add unnecessary abstractions
create hidden magic behavior
11. Preferred Future Enhancements

Planned:

OCR support
scanned PDF support
layout-aware parsing
table extraction
radio group controls
AI confidence scores
human review workflow
embeddings for published forms
semantic form search
multilingual extraction
12. Development Workflow
Backend

Run Nest:
pnpm start:dev

Run FastAPI:
uvicorn main:app --reload --port 8000

Typical Flow
ingest/pdf
search
generate/form-draft
generate/form-draft-and-save
review in admin UI
publish
13. Golden Rule

The platform is NOT a simple CRUD form builder.

It is:

An AI-assisted server-driven form platform with semantic document understanding.

Architectural decisions should support:

scalability
semantic retrieval
enterprise workflows
explainability
maintainability
future AI capabilities
