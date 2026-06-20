# Architecture Diagrams

These diagrams use Mermaid and should render in GitHub-style Markdown viewers.

## System Context

```mermaid
flowchart LR
    AdminUser["Admin user"] --> AdminUI["Next.js Admin UI"]
    MobileUser["Mobile user"] --> MobileApp["Expo / React Native Mobile"]
    AdminUI --> API["NestJS API"]
    MobileApp --> API
    AdminUI --> AI["FastAPI AI Service"]
    AI -->|"Internal HTTP + service token"| API
    API -->|"Business tables"| DB[("PostgreSQL public schema")]
    AI -->|"AI tables + pgvector"| AIDB[("PostgreSQL ai schema")]
    API --> ExternalDB["External databases"]
    API --> ExternalREST["External REST APIs"]
```

## Container Diagram

```mermaid
flowchart TB
    subgraph Client["Client Applications"]
        Admin["apps/admin-nextjs"]
        Mobile["apps/mobile-rn"]
    end

    subgraph Shared["Shared TypeScript Contracts"]
        Contracts["packages/contracts"]
    end

    subgraph Backend["Backend Services"]
        API["apps/api-nest"]
        AI["transform-ai/apps/ai-fastapi"]
    end

    subgraph Storage["Storage"]
        PublicDB[("PostgreSQL public")]
        AiSchema[("PostgreSQL ai + pgvector")]
    end

    Admin --> API
    Mobile --> API
    AI --> API
    API --> PublicDB
    AI --> AiSchema
    Admin -. imports .-> Contracts
    Mobile -. imports .-> Contracts
    API -. imports .-> Contracts
```

## NestJS Module View

```mermaid
flowchart TB
    AppModule["AppModule"] --> Prisma["PrismaModule"]
    AppModule --> Apps["AppsModule"]
    AppModule --> Forms["FormsModule"]
    AppModule --> Auth["AuthModule"]
    AppModule --> GraphQL["AppGraphqlModule"]
    AppModule --> Connectors["ConnectorsModule"]
    AppModule --> SubmitActions["SubmitActionsModule"]
    AppModule --> Submissions["SubmissionsModule"]

    Forms --> Contracts["packages/contracts expressions"]
    Submissions --> Validators["packages/contracts validators"]
    Forms --> Connectors
    Submissions --> FormsDatasets["FormDatasetsService"]
    FormsDatasets --> Connectors
    SubmitActions --> Connectors
```

## Data Ownership

```mermaid
erDiagram
    APP ||--o{ FORM : owns
    APP ||--o{ SUBMISSION : receives
    APP ||--o{ CONNECTOR : configures
    FORM ||--o{ FORM_SUBMIT_ACTION : has
    FORM ||--o{ FORM_DATABASE_MAPPING : has
    SUBMISSION ||--o{ SUBMISSION_ACTION_RUN : creates
    AI_DOCUMENT ||--o{ AI_CHUNK : contains

    APP {
        string app_code
        string name
    }
    FORM {
        uuid id
        string app_code
        string form_key
        int version
        string status
        json schema_json
    }
    SUBMISSION {
        uuid id
        string app_code
        string form_key
        int form_version
        json data_json
    }
    CONNECTOR {
        uuid id
        string app_code
        string type
        json config_json
        json secrets_json
    }
    AI_DOCUMENT {
        uuid id
        string app_code
        string source_type
        json meta
    }
    AI_CHUNK {
        uuid id
        uuid document_id
        int chunk_index
        vector embedding
    }
```

Note: `APP`, `FORM`, `SUBMISSION`, `CONNECTOR`, and submit-action tables are
Nest-owned Prisma tables in `public`. `AI_DOCUMENT` and `AI_CHUNK` represent
FastAPI-owned SQLAlchemy tables in the `ai` schema.

## Form Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft: version = 0
    Draft --> Draft: update schemaJson
    Draft --> Published: publish
    Published: version >= 1
    Published --> Archived: next publish for same appCode + formKey
    Archived --> [*]
```

## AI Ingestion And Draft Save

```mermaid
sequenceDiagram
    participant Admin as Admin UI or caller
    participant AI as FastAPI AI Service
    participant VectorDB as ai schema + pgvector
    participant API as NestJS API
    participant Forms as forms table

    Admin->>AI: Upload PDF
    AI->>AI: Extract text and metadata
    AI->>AI: Chunk text
    AI->>AI: Generate embeddings
    AI->>VectorDB: Insert ai_documents and ai_chunks
    Admin->>AI: Generate draft and save
    AI->>VectorDB: Vector search by appCode
    AI->>AI: Infer fields and build schema
    AI->>API: PUT internal draft with service token
    alt Draft does not exist
        AI->>API: POST internal draft with service token
    end
    API->>Forms: Save draft form
```

## Submission Validation

```mermaid
sequenceDiagram
    participant Mobile as Mobile Renderer
    participant Contracts as packages/contracts
    participant API as NestJS API
    participant DB as PostgreSQL public
    participant Runner as Submit Action Runner

    Mobile->>Contracts: validateFormData(form, data, datasets, variables)
    Contracts-->>Mobile: errors or ok
    Mobile->>API: POST submission
    API->>DB: Load published form version
    API->>API: Fetch runtime datasets if needed
    API->>Contracts: evaluate calculated values
    API->>Contracts: validateFormData with resolved options
    alt Validation fails
        API-->>Mobile: 400 validation errors
    else Validation passes
        API->>DB: Insert submission and action runs
        API->>Runner: Enqueue action processing
        API-->>Mobile: accepted
    end
```

## Runtime Data Source Fetch

```mermaid
sequenceDiagram
    participant Mobile as Mobile Renderer
    participant API as NestJS API
    participant Contracts as packages/contracts
    participant Connector as Connector Runtime
    participant Source as External DB or REST API

    Mobile->>API: POST datasets with formVersion, data, variables
    API->>API: Load published schema
    API->>Contracts: Resolve data-source params
    API->>Connector: Load connector runtime config
    Connector->>Source: Execute read-only SQL or REST request
    Source-->>Connector: Rows or response body
    Connector-->>API: Normalized rows
    API-->>Mobile: Dataset map with TTL
```

