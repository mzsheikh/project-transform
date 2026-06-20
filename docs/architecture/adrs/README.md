# Architecture Decision Records

This folder records architecture decisions for Project Transform and Transform
AI. ADRs are append-only unless a decision is superseded by a newer ADR.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](./0001-api-nest-owns-form-lifecycle.md) | Accepted | NestJS owns form lifecycle and business persistence. |
| [0002](./0002-ai-service-uses-internal-http.md) | Accepted | FastAPI saves forms only through Nest internal HTTP APIs. |
| [0003](./0003-shared-contracts-for-rendering-and-validation.md) | Accepted | Shared contracts define schema, expressions, actions, and validation. |
| [0004](./0004-ai-vector-storage-in-ai-schema.md) | Accepted | AI document and vector data live in AI-owned PostgreSQL schema. |
| [0005](./0005-published-form-versioning.md) | Accepted | Published forms are versioned and drafts use version zero. |
| [0006](./0006-runtime-data-sources-through-connectors.md) | Accepted | Runtime data sources execute through Nest connector abstractions. |

## ADR Template

```markdown
# ADR-NNNN: Title

Status: Proposed | Accepted | Superseded
Date: YYYY-MM-DD

## Context

What forces, constraints, or problem led to this decision?

## Decision

What decision was made?

## Consequences

What becomes easier, harder, or explicitly constrained?

## Alternatives Considered

What other options were considered and why were they not chosen?
```

