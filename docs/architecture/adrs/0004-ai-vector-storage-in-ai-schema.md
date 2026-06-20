# ADR-0004: AI Vector Storage Lives In AI-Owned Schema

Status: Accepted
Date: 2026-06-20

## Context

The AI service needs durable storage for documents, chunks, metadata, and
embeddings. The project already uses PostgreSQL for business data, and pgvector
supports semantic search inside PostgreSQL.

## Decision

FastAPI owns AI retrieval tables in an AI-specific PostgreSQL schema:

- `ai.ai_documents`
- `ai.ai_chunks`

Embeddings use `BAAI/bge-small-en-v1.5` with vector dimension `384`.

## Consequences

- AI retrieval data is colocated with the main database but logically separated
  by schema ownership.
- Nest-owned business tables are not polluted with AI chunk data.
- Vector search can filter by `appCode`.
- Changing the embedding model requires a migration plan for vector dimensions
  and re-embedding.
- PostgreSQL deployments must enable pgvector.

## Alternatives Considered

### External vector database

Deferred. It may be warranted later for scale or specialized retrieval, but
pgvector is simpler for the current product stage.

### Store chunks in Nest-owned Prisma tables

Rejected. AI chunks are not business records and are owned by the FastAPI
retrieval layer.

