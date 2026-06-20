# ADR-0003: Shared Contracts For Rendering And Validation

Status: Accepted
Date: 2026-06-20

## Context

The same schema must be interpreted by the admin designer, mobile renderer, and
Nest submission validator. Divergent implementations would create defects where
the client accepts data that the server rejects, or the server accepts data that
the renderer could never produce.

## Decision

`packages/contracts` is the shared TypeScript contract layer for:

- form schema types
- submission types
- submit action types
- expression parsing and evaluation
- expression validation
- calculated form data evaluation
- form submission validation

Mobile rendering and Nest submission validation import this package directly.

## Consequences

- Client and server validation semantics stay aligned.
- Expression-driven behavior has one implementation.
- Schema changes require updating shared contracts first.
- FastAPI must generate schema JSON that conforms to these contracts.
- Python cannot directly execute TypeScript validators, so it must treat the
  contracts as JSON shape and rely on Nest for authoritative validation.

## Alternatives Considered

### Duplicate validators in each app

Rejected. It would increase drift risk across mobile and backend behavior.

### JSON Schema only

Rejected as the only mechanism. JSON Schema can describe structure but does not
cover the full expression and runtime data-source semantics used by the
renderer.

