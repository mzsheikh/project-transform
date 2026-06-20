# Project Transform Architecture

Last reviewed: 2026-06-20

This folder captures the architecture for Project Transform and Transform AI.
It documents the current system boundaries, runtime flows, diagrams, and
Architecture Decision Records (ADRs).

## Document Map

| Document | Purpose |
| --- | --- |
| [System Overview](./system-overview.md) | Service responsibilities, boundaries, integration points, and quality attributes. |
| [Runtime Flows](./runtime-flows.md) | End-to-end workflows for publishing, rendering, submission, AI ingestion, and draft generation. |
| [Diagrams](./diagrams.md) | Mermaid diagrams for system context, containers, data ownership, and key flows. |
| [ADRs](./adrs/README.md) | Architecture decision log and ADR template. |

## Core Architecture Principles

1. `apps/api-nest` is the source of truth for apps, forms, versions,
   publishing, users, connectors, submissions, and submit action runs.
2. `transform-ai/apps/ai-fastapi` owns AI documents, chunks, embeddings, and
   draft generation only. It saves forms through Nest internal HTTP APIs.
3. `packages/contracts` is the shared schema, expression, action, and
   validation contract used by mobile rendering and Nest submission validation.
4. Published form versions are immutable from the perspective of submissions.
   Drafts use `version = 0`; published forms use `version >= 1`.
5. Runtime data sources are resolved through configured connectors and are
   scoped by `appCode`.
6. AI-generated schemas must preserve source traceability through citations and
   extracted field metadata.

## Current Services

| Path | Runtime | Responsibility |
| --- | --- | --- |
| `apps/api-nest` | NestJS | Business API, auth, form lifecycle, connectors, submissions, submit actions. |
| `apps/admin-nextjs` | Next.js App Router | App admin, designer, draft editing, publishing, connector configuration. |
| `apps/mobile-rn` | Expo / React Native | Published form rendering, drafts, cached datasets, form submissions. |
| `packages/contracts` | TypeScript package | Form schema, expressions, validation, action, and submission contracts. |
| `transform-ai/apps/ai-fastapi` | FastAPI | PDF ingestion, embeddings, vector search, form draft generation. |

## When To Update These Docs

Update this folder when changing:

- service ownership or database ownership
- form schema shape, expression behavior, or validation semantics
- publishing/versioning behavior
- AI ingestion, retrieval, or draft-save flows
- connector or data-source execution behavior
- submit action execution semantics
- authentication or internal service authorization boundaries

