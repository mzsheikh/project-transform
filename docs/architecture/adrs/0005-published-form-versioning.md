# ADR-0005: Published Form Versioning

Status: Accepted
Date: 2026-06-20

## Context

Submissions must be validated against the exact form version users saw.
Admins also need to keep editing draft forms without changing already published
behavior.

## Decision

Forms use explicit version and status rules:

- drafts use `version = 0` and `status = draft`
- published forms use `version >= 1` and `status = published`
- previously published versions become `status = archived` when a new version
  is published
- submissions include `formVersion`

## Consequences

- Submission validation can load a precise published version.
- Admins can keep editing drafts without mutating published schemas.
- Historical submissions remain explainable because they reference a version.
- Publishing copies draft-scoped submit actions and mappings into the published
  form context.
- Querying the latest form requires filtering by `status = published` and
  ordering by version.

## Alternatives Considered

### Mutable published form row

Rejected. Mutating a published schema would make historical submissions hard to
validate and explain.

### Separate draft table

Deferred. A single `forms` table with status and version is simpler and works
for current needs.

