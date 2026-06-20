# ADR-0006: Runtime Data Sources Execute Through Connectors

Status: Accepted
Date: 2026-06-20

## Context

Forms need dynamic options and runtime data from databases and REST APIs.
These integrations need app scoping, secret handling, runtime validation, and a
single execution boundary.

## Decision

Form data sources reference configured connectors and execute through Nest
connector runtime services.

Supported data-source types:

- `database`
- `rest_api`

Database data sources must use read-only `SELECT` or `WITH` queries. REST data
sources render path, header, and body templates from resolved expression params.

## Consequences

- Data-source execution stays server-side and app-scoped.
- Mobile receives normalized rows without direct access to connector secrets.
- Expression-driven params can use current form data and variables.
- Runtime option lists can be generated from dataset rows.
- Server-side submission validation can fetch current datasets before validating
  expression-driven controls.

## Alternatives Considered

### Let mobile call external systems directly

Rejected. It would expose secrets and duplicate connector behavior in the
client.

### Hardcode data-source logic per control

Rejected. Data sources are reusable schema-level concepts and should not be
embedded in individual control implementations.

