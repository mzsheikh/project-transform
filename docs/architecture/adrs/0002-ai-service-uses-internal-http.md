# ADR-0002: AI Service Uses Internal HTTP To Save Drafts

Status: Accepted
Date: 2026-06-20

## Context

The AI service generates draft schemas, but it does not own form persistence.
It still needs to save generated drafts so admins can review and publish them.

## Decision

FastAPI saves draft forms through Nest internal HTTP endpoints:

- `POST /internal/apps/:appCode/forms`
- `PUT /internal/apps/:appCode/forms/:formKey/draft`

These endpoints are protected by `AiServiceGuard` and require
`X-AI-Service-Token`.

## Consequences

- AI-generated drafts pass through the same Nest services as manually created
  drafts.
- App boundaries and schema persistence stay centralized in Nest.
- FastAPI needs `NEST_API_BASE_URL` and `AI_SERVICE_TOKEN` configuration.
- Internal endpoint compatibility is now part of the service contract between
  FastAPI and Nest.

## Alternatives Considered

### Direct database writes from FastAPI

Rejected. This violates ownership boundaries and bypasses Nest validation and
authorization.

### Message queue for draft creation

Deferred. A queue may be useful when generation volume increases, but HTTP is
simple and adequate for the current synchronous draft-save workflow.

