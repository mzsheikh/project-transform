export type DatabaseProviderName = "postgresql" | "mysql" | "sqlserver";

export type DatabaseFieldType = "text" | "number" | "boolean" | "date" | "datetime" | "json";

export type DatabaseFieldMapping = {
  sourceKey: string;
  targetField: string;
  type?: DatabaseFieldType;
  required?: boolean;
};

export type DatabaseTableMapping = {
  tableName: string;
  source: "root" | "repeater";
  repeaterKey?: string;
  includeMetadataColumns?: boolean;
  columns: DatabaseFieldMapping[];
};

export type DatabaseActionConfig = {
  connectorId: string;
  autoCreateTables?: boolean;
  tables: DatabaseTableMapping[];
};

export type ConnectorRuntimeConfig = {
  id: string;
  name: string;
  type: "database" | "rest_api";
  provider?: DatabaseProviderName | null;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
};

export type DatabaseSchemaColumn = {
  schema?: string | null;
  table: string;
  column: string;
  dataType: string;
  nullable: boolean;
};

export type SubmissionInsertContext = {
  submissionId: string;
  appCode: string;
  formKey: string;
  formVersion: number;
  submittedAt: Date;
  data: Record<string, unknown>;
};

export abstract class BaseConnector {
  constructor(protected readonly connector: ConnectorRuntimeConfig) {}

  abstract test(): Promise<Record<string, unknown>>;
}

export abstract class BaseDatabaseConnector extends BaseConnector {
  abstract inspectSchema(): Promise<DatabaseSchemaColumn[]>;
  abstract previewDdl(tables: DatabaseTableMapping[]): string[];
  abstract ensureTables(tables: DatabaseTableMapping[]): Promise<string[]>;
  abstract queryRows(sql: string, values: unknown[], limit: number): Promise<Record<string, unknown>[]>;
  abstract insertSubmission(config: DatabaseActionConfig, context: SubmissionInsertContext): Promise<Record<string, unknown>>;
}

export abstract class BaseRestConnector extends BaseConnector {
  abstract request(input: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  }): Promise<Record<string, unknown>>;
}
