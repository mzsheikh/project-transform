# Runtime Flows

This document describes the main end-to-end flows in the current architecture.

## Admin Draft And Publish Flow

1. Admin authenticates through the NestJS auth endpoints.
2. Admin creates or edits a draft form through:
   - `POST /apps/:appCode/forms`
   - `PUT /apps/:appCode/forms/:formKey/draft`
3. The admin designer stores the schema as `schemaJson`.
4. Submit actions and database mappings are configured separately but scoped to
   the same app and form.
5. Admin publishes through `POST /apps/:appCode/forms/:formKey/publish`.
6. Nest validates:
   - expression syntax and references
   - data-source connector types
   - submit action triggers and linked button action IDs
7. Nest archives currently published versions for that `appCode` and `formKey`.
8. Nest inserts a new published form with the next positive version.
9. Mappings and submit actions are copied from draft to published form context.

## Mobile Render Flow

1. Mobile user enters an `appCode`.
2. Mobile calls `GET /apps/:appCode/bootstrap`.
3. User selects a form.
4. Mobile calls `GET /apps/:appCode/forms/:formKey/latest`.
5. Mobile loads cached datasets when present.
6. Mobile calls `POST /apps/:appCode/forms/:formKey/datasets` to refresh
   runtime data sources for the current form data and variables.
7. Mobile renders the schema with `FormRenderer`.
8. Contract expression functions resolve:
   - calculated values
   - control visibility
   - enabled/read-only state
   - dynamic labels, help text, and options
   - repeater row scope
9. User data is saved locally as drafts when needed.

## Mobile Submission Flow

1. User triggers submit through a footer submit button or a schema button action.
2. Mobile validates form data through `validateFormData` from
   `packages/contracts`.
3. Mobile sends:
   - `submissionId`
   - `formVersion`
   - `triggerKey`
   - `variables`
   - `data`
   - timestamps
4. Nest loads the exact published form version.
5. Nest fetches current runtime datasets if the form defines data sources.
6. Nest recomputes calculated values through contracts.
7. Nest rejects calculated values that do not match server-side expression
   results.
8. Nest validates form data through contracts, including resolved option
   membership.
9. Nest creates the submission and pending submit action runs in a transaction.
10. If action runs exist, the runner processes them asynchronously.

## Data Source Fetch Flow

1. A form schema defines `dataSources`.
2. Each data source references a connector by `connectorId`.
3. Runtime params are resolved from expressions using form data and variables.
4. Nest loads connector runtime config and secrets.
5. Database sources must use a read-only `SELECT` or `WITH` query.
6. REST sources render path, headers, and optional body templates.
7. Results are normalized to rows and returned to the mobile app.
8. Mobile caches datasets by form and data context.

## AI PDF Ingestion Flow

1. Caller uploads a PDF to `POST /ingest/pdf/upload` or passes a path to
   `POST /ingest/pdf`.
2. FastAPI extracts text and PDF metadata.
3. The extracted text is chunked.
4. Chunks are embedded with `BAAI/bge-small-en-v1.5`.
5. FastAPI inserts:
   - one `ai.ai_documents` row
   - many `ai.ai_chunks` rows with 384-dimensional vectors
6. Search uses pgvector cosine distance and filters by `appCode`.

## AI Draft Generation And Save Flow

1. Caller requests `POST /generate/form-draft` or
   `POST /generate/form-draft-and-save`.
2. FastAPI embeds the query.
3. FastAPI performs vector search for matching chunks by app.
4. FastAPI extracts fields from PDF metadata or retrieved text.
5. FastAPI builds a canonical form schema.
6. FastAPI attaches citations and extraction metadata.
7. For save flow, FastAPI tries:
   - `PUT /internal/apps/:appCode/forms/:formKey/draft`
   - then `POST /internal/apps/:appCode/forms` when update fails
8. Nest internal endpoints are protected by `AiServiceGuard`.
9. Nest persists the draft form. Publishing remains a Nest/admin workflow.

## Submit Action Flow

1. Published forms can have enabled submit actions scoped by trigger key.
2. Submission creates action run rows with an action snapshot.
3. The runner processes pending runs.
4. Supported action types are:
   - `email_pdf`
   - `database`
   - `rest_api`
5. Submission status is recomputed from action run state.

