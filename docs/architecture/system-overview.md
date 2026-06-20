# System Overview

Project Transform is an AI-assisted server-driven form platform. Admin users
design and publish forms, mobile users render and submit published forms, and
the AI service can ingest documents, generate draft form schemas, and save those
drafts through the NestJS API.

## Primary Containers

### NestJS API

Path: `apps/api-nest`

The NestJS API owns business state and business rules.

Responsibilities:

- app CRUD and app scoping
- admin authentication and role checks
- form draft creation and updates
- form expression validation before publish
- form publishing, versioning, and archiving
- connector configuration and runtime connector execution
- published data-source fetches
- submission validation and persistence
- submit action run creation and processing

Important modules:

- `AppsModule`
- `FormsModule`
- `AuthModule`
- `AppGraphqlModule`
- `ConnectorsModule`
- `SubmitActionsModule`
- `SubmissionsModule`

### Admin UI

Path: `apps/admin-nextjs`

The admin UI is the operational interface for configuring apps, designing
forms, managing connectors, previewing data sources, and publishing forms.

State model:

- React Query owns server state and cache invalidation.
- Zustand owns local designer state, drag/drop state, undo/redo, and transient
  editor behavior.
- Shared contract functions validate expressions before saving and publishing.

### Mobile Renderer

Path: `apps/mobile-rn`

The mobile app renders published form schemas from the NestJS API. It caches
drafts and datasets locally, evaluates expressions through shared contracts, and
submits data back to Nest.

Responsibilities:

- app bootstrap by `appCode`
- latest published form load
- data-source fetch and offline cache use
- form rendering from schema JSON
- expression-driven control state and values
- local draft persistence
- submission payload creation

### Shared Contracts

Path: `packages/contracts`

The contracts package is the cross-runtime compatibility layer.

Responsibilities:

- canonical form schema types
- submission payload types
- submit action types
- expression parsing and evaluation
- expression validation
- calculated value evaluation
- form-data validation
- option normalization and resolved-option validation

This package is intentionally imported by both mobile rendering and Nest
submission validation so client and server behavior remain aligned.

### FastAPI AI Service

Path: `transform-ai/apps/ai-fastapi`

The AI service owns the AI retrieval and draft generation pipeline. It does not
own forms.

Responsibilities:

- PDF upload and path-based ingestion
- AcroForm/text extraction and chunking
- embedding generation with `BAAI/bge-small-en-v1.5`
- vector search over `ai.ai_chunks`
- draft field extraction and schema generation
- citation and extraction metadata generation
- draft save through Nest internal HTTP endpoints

## Database Ownership

The project uses PostgreSQL with strict logical ownership.

| Owner | Tables / schema | Notes |
| --- | --- | --- |
| NestJS API | `public.apps`, `public.forms`, `public.users`, `public.admin_users`, `public.submissions`, `public.connectors`, `public.form_submit_actions`, related mapping/run tables | Prisma-owned business data. |
| FastAPI AI service | `ai.ai_documents`, `ai.ai_chunks` | SQLAlchemy-owned AI retrieval data with pgvector embeddings. |

AI may read and write only AI-owned tables directly. It must save forms through
Nest internal APIs protected by `AiServiceGuard`.

## Integration Points

| Caller | Callee | Purpose | Boundary |
| --- | --- | --- | --- |
| Admin UI | NestJS API | Admin CRUD, drafts, publishing, connectors, data-source preview | Cookie JWT plus role guards where required. |
| Mobile app | NestJS API | App bootstrap, latest published form, datasets, submissions | Public app/form endpoints in current implementation. |
| FastAPI AI | NestJS API | Create or update AI-generated draft forms | Internal HTTP plus `X-AI-Service-Token`. |
| NestJS API | External databases / REST APIs | Runtime form data sources and submit actions | Connector runtime config and secret vault boundary. |
| FastAPI AI | PostgreSQL `ai` schema | AI document and vector chunk storage | AI service ownership only. |

## Form Lifecycle

1. A draft form is created with `version = 0` and `status = draft`.
2. The designer updates `schemaJson` and submit action configuration.
3. Publishing validates expressions, data-source connector references, and
   submit action triggers.
4. Current published versions are archived.
5. A new published form is inserted with the next positive version.
6. Mobile renders only published versions.
7. Submissions store the submitted `formVersion`.

## Validation Model

Validation is contract-first.

- Mobile calls contract validators for inline and submit-time feedback.
- Nest calls contract validators before accepting a submission.
- Expression-calculated values are recomputed on the server.
- Submitted calculated values are rejected when they do not match the server
  expression result.
- Option membership for dropdown, segmented, and multiselect controls is checked
  against resolved options.

## Key Quality Attributes

| Attribute | Design response |
| --- | --- |
| Maintainability | Business ownership is concentrated in Nest; shared behavior lives in `packages/contracts`. |
| Explainability | AI draft responses include citations and extracted field metadata. |
| Scalability | AI retrieval uses chunked embeddings and pgvector instead of whole-document scans. |
| Safety | AI cannot write directly to forms; internal APIs use service-token guard. |
| Offline tolerance | Mobile stores local drafts and caches fetched datasets. |
| Extensibility | Server-driven schemas, data sources, and submit actions allow new form behavior without app releases where possible. |

## Known Architectural Gaps

These are current-state observations, not blockers.

- Mobile submission endpoints are public in the current controller surface.
  App-user authentication and authorization should be added before production
  multi-tenant use.
- The AI service currently handles text PDFs. OCR and layout-aware parsing are
  future extensions.
- Data-source cache invalidation is mobile-side and TTL-based. Server-side
  cache coordination may be needed for larger deployments.
- The AI embedding model has fixed dimension `384`; changing models requires a
  storage migration plan.

