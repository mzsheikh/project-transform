import type { SubmissionStatus } from "./submission-types";

export type ConnectorType = "database" | "rest_api";
export type DatabaseProvider = "postgresql" | "mysql" | "sqlserver";

export type RestAuthMode =
  | "none"
  | "api_key"
  | "bearer"
  | "basic"
  | "oauth2_client_credentials";

export type SubmitActionType = "email_pdf" | "database" | "rest_api";
export type SubmitActionRunStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface ConnectorDto {
  id: string;
  appCode: string;
  name: string;
  type: ConnectorType;
  provider?: DatabaseProvider | null;
  configJson: Record<string, unknown>;
  hasSecrets: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorInput {
  name: string;
  type: ConnectorType;
  provider?: DatabaseProvider | null;
  configJson?: Record<string, unknown>;
  secretsJson?: Record<string, unknown>;
}

export interface EmailPdfActionConfig {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subjectTemplate?: string;
  bodyTemplate?: string;
  includeJson?: boolean;
}

export type DatabaseFieldType = "text" | "number" | "boolean" | "date" | "datetime" | "json";

export interface DatabaseFieldMapping {
  sourceKey: string;
  targetField: string;
  type?: DatabaseFieldType;
  required?: boolean;
}

export interface DatabaseTableMapping {
  tableName: string;
  source: "root" | "repeater";
  repeaterKey?: string;
  includeMetadataColumns?: boolean;
  columns: DatabaseFieldMapping[];
}

export interface DatabaseActionConfig {
  connectorId: string;
  mappingId?: string;
  autoCreateTables?: boolean;
  tables: DatabaseTableMapping[];
}

export interface DatabaseMappingColumn {
  sourceKey: string;
  label?: string;
  controlType?: string;
  targetField: string;
  type?: DatabaseFieldType;
  required?: boolean;
  enabled?: boolean;
}

export interface DatabaseMappingTable {
  tableName: string;
  source: "root" | "repeater";
  repeaterKey?: string;
  includeMetadataColumns?: boolean;
  columns: DatabaseMappingColumn[];
}

export interface DatabaseMappingJson {
  tables: DatabaseMappingTable[];
}

export interface FormDatabaseMappingDto {
  id: string;
  appCode: string;
  connectorId: string;
  formId: string;
  formKey: string;
  formVersion: number;
  name: string;
  mappingJson: DatabaseMappingJson;
  createdAt: string;
  updatedAt: string;
}

export interface FormDatabaseMappingInput {
  formKey: string;
  name?: string;
  mappingJson: DatabaseMappingJson;
}

export interface RestFieldMapping {
  sourceKey: string;
  targetPath: string;
}

export interface RestActionConfig {
  connectorId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  bodyTemplate?: unknown;
  fieldMappings?: RestFieldMapping[];
}

export type SubmitActionConfig =
  | EmailPdfActionConfig
  | DatabaseActionConfig
  | RestActionConfig;

export interface FormSubmitActionDto {
  id: string;
  appCode: string;
  formId: string;
  formKey: string;
  formVersion: number;
  type: SubmitActionType;
  name: string;
  enabled: boolean;
  sortOrder: number;
  triggerKey?: string | null;
  buttonActionId?: string | null;
  connectorId?: string | null;
  configJson: SubmitActionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmitActionInput {
  type: SubmitActionType;
  name: string;
  enabled?: boolean;
  sortOrder?: number;
  triggerKey?: string | null;
  buttonActionId?: string | null;
  connectorId?: string | null;
  configJson: SubmitActionConfig;
}

export interface SubmissionActionRunDto {
  id: string;
  submissionId: string;
  actionId?: string | null;
  actionName: string;
  actionType: SubmitActionType;
  status: SubmitActionRunStatus;
  attemptCount: number;
}

export interface SubmissionAcceptedResponse {
  submissionId: string;
  status: SubmissionStatus;
  duplicate: boolean;
  actionRuns: SubmissionActionRunDto[];
}
