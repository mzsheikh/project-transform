import {
  DatabaseFieldMapping,
  DatabaseFieldType,
  DatabaseTableMapping,
  SubmissionInsertContext,
} from "./base-connectors";

export type SqlDialect = "postgresql" | "mysql" | "sqlserver";

export type InsertStatement = {
  sql: string;
  values: unknown[];
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertIdentifier(value: string, label: string) {
  const parts = value.split(".");
  if (parts.length > 2 || parts.some((part) => !IDENTIFIER.test(part))) {
    throw new Error(`${label} must contain only letters, numbers, and underscores`);
  }
}

export function quoteIdentifier(value: string, dialect: SqlDialect): string {
  assertIdentifier(value, "Identifier");
  const quote = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : "\"";
  const close = dialect === "sqlserver" ? "]" : quote;
  return value
    .split(".")
    .map((part) => `${quote}${part}${close}`)
    .join(".");
}

export function columnType(type: DatabaseFieldType | undefined, dialect: SqlDialect): string {
  switch (type) {
    case "number":
      return dialect === "sqlserver" ? "FLOAT" : "DOUBLE PRECISION";
    case "boolean":
      return dialect === "sqlserver" ? "BIT" : "BOOLEAN";
    case "date":
      return "DATE";
    case "datetime":
      return dialect === "postgresql" ? "TIMESTAMPTZ" : "DATETIME";
    case "json":
      return dialect === "postgresql" ? "JSONB" : dialect === "mysql" ? "JSON" : "NVARCHAR(MAX)";
    case "text":
    default:
      return dialect === "sqlserver" ? "NVARCHAR(MAX)" : "TEXT";
  }
}

export function metadataColumns(dialect: SqlDialect, child: boolean): string[] {
  const text = dialect === "sqlserver" ? "NVARCHAR(128)" : "VARCHAR(128)";
  const timestamp = dialect === "postgresql" ? "TIMESTAMPTZ" : "DATETIME";
  const currentTimestamp = dialect === "sqlserver" ? "SYSUTCDATETIME()" : "CURRENT_TIMESTAMP";
  const columns = [
    `transform_submission_id ${text} NOT NULL`,
    `transform_form_key ${text} NOT NULL`,
    `transform_form_version INTEGER NOT NULL`,
    `transform_created_at ${timestamp} NOT NULL DEFAULT ${currentTimestamp}`,
  ];
  if (child) {
    columns.push(`transform_repeater_key ${text}`);
    columns.push("transform_repeater_index INTEGER");
  }
  return columns;
}

export function createTableStatement(table: DatabaseTableMapping, dialect: SqlDialect): string {
  assertIdentifier(table.tableName, "Table name");
  const seen = new Set<string>();
  const child = table.source === "repeater";
  const columns = table.includeMetadataColumns === false ? [] : metadataColumns(dialect, child);

  for (const mapping of table.columns) {
    assertIdentifier(mapping.targetField, "Column name");
    if (seen.has(mapping.targetField)) continue;
    seen.add(mapping.targetField);
    const nullable = mapping.required ? " NOT NULL" : "";
    columns.push(`${quoteIdentifier(mapping.targetField, dialect)} ${columnType(mapping.type, dialect)}${nullable}`);
  }

  const tableName = quoteIdentifier(table.tableName, dialect);
  if (dialect === "sqlserver") {
    return `IF OBJECT_ID(N'${table.tableName.replace(/'/g, "''")}', N'U') IS NULL CREATE TABLE ${tableName} (${columns.join(", ")});`;
  }
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(", ")});`;
}

export function buildInsertStatements(
  actionTables: DatabaseTableMapping[],
  context: SubmissionInsertContext,
  dialect: SqlDialect,
): InsertStatement[] {
  const statements: InsertStatement[] = [];
  for (const table of actionTables) {
    if (table.source === "root") {
      statements.push(buildInsert(table, context.data, context, dialect));
      continue;
    }

    const repeated = table.repeaterKey ? context.data[table.repeaterKey] : undefined;
    const rows = Array.isArray(repeated) ? repeated : [];
    rows.forEach((row, index) => {
      if (!isPlainObject(row)) return;
      statements.push(buildInsert(table, row, context, dialect, index));
    });
  }
  return statements;
}

function buildInsert(
  table: DatabaseTableMapping,
  source: Record<string, unknown>,
  context: SubmissionInsertContext,
  dialect: SqlDialect,
  repeaterIndex?: number,
): InsertStatement {
  assertIdentifier(table.tableName, "Table name");
  const columns: string[] = [];
  const values: unknown[] = [];

  if (table.includeMetadataColumns !== false) {
    columns.push("transform_submission_id", "transform_form_key", "transform_form_version");
    values.push(context.submissionId, context.formKey, context.formVersion);
    if (table.source === "repeater") {
      columns.push("transform_repeater_key", "transform_repeater_index");
      values.push(table.repeaterKey ?? null, repeaterIndex ?? null);
    }
  }

  for (const mapping of table.columns) {
    pushMappedValue(columns, values, mapping, source);
  }

  const placeholders = values.map((_, index) => placeholder(index, dialect)).join(", ");
  const quotedColumns = columns.map((column) => quoteIdentifier(column, dialect)).join(", ");
  return {
    sql: `INSERT INTO ${quoteIdentifier(table.tableName, dialect)} (${quotedColumns}) VALUES (${placeholders})`,
    values,
  };
}

function pushMappedValue(
  columns: string[],
  values: unknown[],
  mapping: DatabaseFieldMapping,
  source: Record<string, unknown>,
) {
  assertIdentifier(mapping.targetField, "Column name");
  columns.push(mapping.targetField);
  values.push(coerceDatabaseValue(source[mapping.sourceKey], mapping.type));
}

function coerceDatabaseValue(value: unknown, type: DatabaseFieldType | undefined) {
  if (value === undefined) return null;
  if (type === "json") return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}

function placeholder(index: number, dialect: SqlDialect) {
  if (dialect === "postgresql") return `$${index + 1}`;
  if (dialect === "sqlserver") return `@p${index}`;
  return "?";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
