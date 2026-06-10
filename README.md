# Project Transform

Project Transform is an AI-assisted, server-driven form platform. Administrators
can design and publish forms, mobile users can render and submit them, and the AI
service can ingest PDFs, retrieve relevant content with vector search, generate
form drafts, and save those drafts through the NestJS API.

The NestJS API is the source of truth for apps, forms, versions, users, and
submissions. The FastAPI service owns only AI documents and vector chunks; it
never writes directly to the forms tables.

## Architecture

```mermaid
flowchart LR
    Admin["Next.js Admin<br/>localhost:3010"] --> API["NestJS API<br/>localhost:3000"]
    Mobile["Expo / React Native"] --> API
    Admin --> AI["FastAPI AI Service<br/>localhost:8000"]
    AI -->|"Internal HTTP + service token"| API
    API -->|"Business tables"| DB[("PostgreSQL")]
    AI -->|"ai schema + pgvector"| DB
```

| Path | Service | Purpose |
| --- | --- | --- |
| `apps/api-nest` | NestJS API | Authentication, apps, forms, publishing, connectors, and submissions |
| `apps/admin-nextjs` | Next.js admin | App management, form designer, publishing, and AI draft review |
| `apps/mobile-rn` | Expo / React Native | Published form rendering, drafts, datasets, and submissions |
| `packages/contracts` | Shared TypeScript package | Form, submission, action, validation, and expression contracts |
| `transform-ai/apps/ai-fastapi` | FastAPI AI service | PDF ingestion, embeddings, semantic search, and draft generation |

## Prerequisites

- Node.js 20.9 or newer
- npm
- Python 3.11 or newer
- PostgreSQL with the
  [pgvector extension](https://github.com/pgvector/pgvector) installed
- Xcode, Android Studio, or Expo Go when running the mobile app

The first AI service startup or embedding request downloads
`BAAI/bge-small-en-v1.5`, so internet access and several hundred MB of local disk
space may be required.

## Quick Start

### 1. Install Node.js dependencies

From the repository root:

```bash
npm install
```

This installs all npm workspaces, including the API, admin UI, mobile app, and
shared contracts.

### 2. Create the PostgreSQL database

Create a database, enable pgvector, and create the schema owned by the AI
service:

```bash
createdb project_transform
psql project_transform -c 'CREATE EXTENSION IF NOT EXISTS vector;'
psql project_transform -c 'CREATE SCHEMA IF NOT EXISTS ai;'
```

Use a PostgreSQL role with permission to create tables in both `public` and
`ai`.

### 3. Configure environment variables

Create `apps/api-nest/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/project_transform
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
AI_SERVICE_TOKEN=replace-with-a-shared-internal-service-token
```

Create `apps/admin-nextjs/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_TRANSFORM_AI_BASE_URL=http://localhost:8000
```

Create `transform-ai/apps/ai-fastapi/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/project_transform
AI_DB_SCHEMA=ai
EMBED_MODEL=BAAI/bge-small-en-v1.5
NEST_API_BASE_URL=http://localhost:3000
AI_SERVICE_TOKEN=replace-with-the-same-token-used-by-api-nest
```

`AI_SERVICE_TOKEN` must match in the NestJS and FastAPI environment files.
Never commit real secrets.

### 4. Apply NestJS database migrations

```bash
cd apps/api-nest
npm run prisma:generate
npm run prisma:migrate
cd ../..
```

The Prisma migrations create the NestJS-owned tables in `public`.

> **Current seed caveat:** `apps/api-nest/prisma/seed.ts` contains a default
> admin seed (`admin@local` / `Admin123!`), but it currently constructs
> `PrismaClient` without the Prisma 7 PostgreSQL adapter and cannot be run until
> that seed is updated.

### 5. Install and initialize the AI service

```bash
cd transform-ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pypdf python-dotenv
cd apps/ai-fastapi
python -c "from db import engine, Base; import models; Base.metadata.create_all(bind=engine)"
cd ../../..
```

The final command creates the AI-owned `ai.ai_documents` and `ai.ai_chunks`
tables. `pypdf` is installed explicitly because it is used by the current code
but is not yet listed in `transform-ai/requirements.txt`.

### 6. Start the services

Open separate terminals from the repository root.

NestJS API:

```bash
cd apps/api-nest
npm run start:dev
```

Next.js admin:

```bash
cd apps/admin-nextjs
npm run dev
```

FastAPI AI service:

```bash
cd transform-ai
source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000 --app-dir apps/ai-fastapi
```

Optional Expo mobile app:

```bash
cd apps/mobile-rn
npm run start
```

## Local URLs

| Service | URL |
| --- | --- |
| Admin UI | [http://localhost:3010](http://localhost:3010) |
| NestJS API | [http://localhost:3000](http://localhost:3000) |
| GraphQL playground | [http://localhost:3000/graphql](http://localhost:3000/graphql) |
| FastAPI health check | [http://localhost:8000/health](http://localhost:8000/health) |
| FastAPI docs | [http://localhost:8000/docs](http://localhost:8000/docs) |

## AI PDF Workflow

Create an app in the admin UI or directly through the API:

```bash
curl -X POST http://localhost:3000/apps \
  -H "Content-Type: application/json" \
  -d '{"appCode":"DEMO01","name":"Demo App"}'
```

Then ingest a PDF for that app code:

```bash
curl -X POST http://localhost:8000/ingest/pdf/upload \
  -F "appCode=DEMO01" \
  -F "title=Inspection Form" \
  -F "file=@/absolute/path/to/inspection-form.pdf"
```

Search the ingested content:

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{
    "appCode": "DEMO01",
    "query": "inspection checklist",
    "topK": 8
  }'
```

Generate a draft and save it into the NestJS form system:

```bash
curl -X POST http://localhost:8000/generate/form-draft-and-save \
  -H "Content-Type: application/json" \
  -d '{
    "appCode": "DEMO01",
    "query": "Inspection Form",
    "topK": 8,
    "title": "Inspection Form (AI Draft)",
    "formKey": "inspection_form"
  }'
```

The AI service retrieves relevant chunks, generates a schema with citations and
extracted-field metadata, then uses the protected NestJS internal API to create
or update the draft.

## Mobile Networking

The mobile API URL is currently defined in `apps/mobile-rn/src/config.ts`.

- iOS simulator: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`
- Physical device: use the development machine's LAN IP, for example
  `http://192.168.1.20:3000`

The device and development machine must be on the same network when using a LAN
IP.

## Common Commands

```bash
# Run from the repository root
npm run build --workspace=apps/api-nest
npm run start:dev --workspace=apps/api-nest
npm run prisma:generate --workspace=apps/api-nest
npm run prisma:migrate --workspace=apps/api-nest

npm run dev --workspace=apps/admin-nextjs
npm run build --workspace=apps/admin-nextjs
npm run lint --workspace=apps/admin-nextjs

npm run start --workspace=apps/mobile-rn
npm run ios --workspace=apps/mobile-rn
npm run android --workspace=apps/mobile-rn
npm run web --workspace=apps/mobile-rn

source transform-ai/.venv/bin/activate
python -m uvicorn main:app --reload --port 8000 --app-dir transform-ai/apps/ai-fastapi
```

## Current Development Notes

- The NestJS API always listens on port `3000`.
- The Next.js admin listens on port `3010`.
- The FastAPI service should run on port `8000` to match the environment example
  above.
- FastAPI currently allows browser CORS requests from `http://localhost:3001`,
  while the admin runs on `http://localhost:3010`. Update the allowed origin in
  `transform-ai/apps/ai-fastapi/main.py` before using the admin's PDF upload
  action.
- The FastAPI service and NestJS API can share one PostgreSQL database, but they
  own separate tables and schemas.
- The current PDF pipeline extracts text and AcroForm fields. Image-only scanned
  PDFs require future OCR support.
- The current admin lint command reports two pre-existing
  `react/no-unescaped-entities` errors in
  `apps/admin-nextjs/src/app/designer/DataSourcesPanel.tsx`.

For expression syntax supported by generated and designed forms, see
[ExpressionEngine.md](./ExpressionEngine.md).
