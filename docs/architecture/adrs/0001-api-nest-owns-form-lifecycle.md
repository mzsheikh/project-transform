# ADR-0001: NestJS Owns Form Lifecycle

Status: Accepted
Date: 2026-06-20

## Context

The platform has multiple producers and consumers of form schemas:

- the admin designer creates and updates drafts
- the AI service generates draft schemas from documents
- the mobile app renders published schemas
- submissions reference exact published versions

Allowing multiple services to write form records directly would duplicate
business rules and make versioning, publishing, authorization, and validation
hard to enforce consistently.

## Decision

`apps/api-nest` owns the form lifecycle.

It is the only service that writes:

- form drafts
- published form versions
- archived form versions
- submit action snapshots tied to forms
- form database mappings

Other services must use Nest APIs to create or update form drafts.

## Consequences

- Form publishing rules have one enforcement point.
- AI-generated schemas enter the same review and publish workflow as manual
  forms.
- Submissions can trust the published form version stored in Nest-owned tables.
- FastAPI cannot bypass app boundaries or publish unreviewed forms.
- Nest internal endpoints must remain stable because the AI service depends on
  them.

## Alternatives Considered

### Let FastAPI write forms directly

Rejected. It would couple Python code to Prisma-owned tables, duplicate
business logic, and bypass Nest authorization and publishing rules.

### Store AI drafts only in AI tables

Rejected for the current product flow. Admin review and publish workflows need
drafts in the main form system.

