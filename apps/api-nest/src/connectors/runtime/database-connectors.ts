import {
  BaseDatabaseConnector,
  ConnectorRuntimeConfig,
  DatabaseActionConfig,
  DatabaseSchemaColumn,
  DatabaseTableMapping,
  SubmissionInsertContext,
} from "./base-connectors";
import {
  buildInsertStatements,
  createTableStatement,
  SqlDialect,
  syncTablePlan,
} from "./database-utils";

function loadOptionalModule(name: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(name);
  } catch {
    throw new Error(`Missing optional connector dependency: ${name}`);
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function boolValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

abstract class SqlDatabaseConnector extends BaseDatabaseConnector {
  protected abstract readonly dialect: SqlDialect;

  previewDdl(tables: DatabaseTableMapping[]): string[] {
    return tables.map((table) => createTableStatement(table, this.dialect));
  }

  async ensureTables(tables: DatabaseTableMapping[]): Promise<string[]> {
    const ddl = this.previewDdl(tables);
    for (const statement of ddl) {
      await this.execute(statement, []);
    }
    return ddl;
  }

  async syncTables(tables: DatabaseTableMapping[], options?: { allowDestructive?: boolean }) {
    const existing = await this.inspectSchema();
    const plan = syncTablePlan(tables, existing, this.dialect);
    const statements = [
      ...plan.safeStatements,
      ...(options?.allowDestructive ? plan.destructiveStatements : []),
    ];
    for (const statement of statements) {
      await this.execute(statement, []);
    }
    return {
      statements: [...plan.safeStatements, ...plan.destructiveStatements],
      warnings: plan.warnings,
      executedStatements: statements.length,
      requiresConfirmation: plan.destructiveStatements.length > 0 && !options?.allowDestructive,
    };
  }

  async insertSubmission(config: DatabaseActionConfig, context: SubmissionInsertContext): Promise<Record<string, unknown>> {
    if (config.autoCreateTables) {
      await this.ensureTables(config.tables);
    }
    const statements = buildInsertStatements(config.tables, context, this.dialect);
    for (const statement of statements) {
      await this.execute(statement.sql, statement.values);
    }
    return { insertedStatements: statements.length };
  }

  async queryRows(sql: string, values: unknown[], limit: number): Promise<Record<string, unknown>[]> {
    const rows = await this.query(sql, values);
    return rows.slice(0, limit);
  }

  protected abstract execute(sql: string, values: unknown[]): Promise<void>;
  protected abstract query(sql: string, values: unknown[]): Promise<Record<string, unknown>[]>;
}

export class PostgresDatabaseConnector extends SqlDatabaseConnector {
  protected readonly dialect = "postgresql" as const;

  async test(): Promise<Record<string, unknown>> {
    await this.withClient(async (client) => {
      await client.query("SELECT 1");
    });
    return { ok: true, provider: "postgresql" };
  }

  async inspectSchema(): Promise<DatabaseSchemaColumn[]> {
    return this.withClient(async (client) => {
      const schema = stringValue(this.connector.config.schema) ?? "public";
      const result = await client.query(
        `SELECT table_schema, table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1
         ORDER BY table_name, ordinal_position`,
        [schema],
      );
      return result.rows.map((row: Record<string, unknown>) => ({
        schema: String(row.table_schema),
        table: String(row.table_name),
        column: String(row.column_name),
        dataType: String(row.data_type),
        nullable: row.is_nullable === "YES",
      }));
    });
  }

  protected async execute(sql: string, values: unknown[]): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(sql, values);
    });
  }

  protected async query(sql: string, values: unknown[]): Promise<Record<string, unknown>[]> {
    return this.withClient(async (client) => {
      const result = await client.query(sql, values);
      return Array.isArray(result.rows) ? result.rows : [];
    });
  }

  private async withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const pg = loadOptionalModule("pg");
    const client = new pg.Client(this.connectionOptions());
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  private connectionOptions(): Record<string, unknown> | string {
    const connectionString = stringValue(this.connector.secrets.connectionString);
    if (connectionString) return connectionString;
    return {
      host: stringValue(this.connector.config.host),
      port: numberValue(this.connector.config.port),
      database: stringValue(this.connector.config.database),
      user: stringValue(this.connector.secrets.username) ?? stringValue(this.connector.config.username),
      password: stringValue(this.connector.secrets.password),
      ssl: boolValue(this.connector.config.ssl) ? { rejectUnauthorized: false } : undefined,
    };
  }
}

export class MysqlDatabaseConnector extends SqlDatabaseConnector {
  protected readonly dialect = "mysql" as const;

  async test(): Promise<Record<string, unknown>> {
    await this.withConnection(async (connection) => {
      await connection.execute("SELECT 1");
    });
    return { ok: true, provider: "mysql" };
  }

  async inspectSchema(): Promise<DatabaseSchemaColumn[]> {
    return this.withConnection(async (connection) => {
      const database = stringValue(this.connector.config.database);
      const [rows] = await connection.execute(
        `SELECT table_schema, table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = COALESCE(?, DATABASE())
         ORDER BY table_name, ordinal_position`,
        [database ?? null],
      );
      return (rows as Record<string, unknown>[]).map((row) => ({
        schema: String(row.TABLE_SCHEMA ?? row.table_schema),
        table: String(row.TABLE_NAME ?? row.table_name),
        column: String(row.COLUMN_NAME ?? row.column_name),
        dataType: String(row.DATA_TYPE ?? row.data_type),
        nullable: String(row.IS_NULLABLE ?? row.is_nullable) === "YES",
      }));
    });
  }

  protected async execute(sql: string, values: unknown[]): Promise<void> {
    await this.withConnection(async (connection) => {
      await connection.execute(sql, values);
    });
  }

  protected async query(sql: string, values: unknown[]): Promise<Record<string, unknown>[]> {
    return this.withConnection(async (connection) => {
      const [rows] = await connection.execute(sql, values);
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    });
  }

  private async withConnection<T>(fn: (connection: any) => Promise<T>): Promise<T> {
    const mysql = loadOptionalModule("mysql2/promise");
    const connection = await mysql.createConnection(this.connectionOptions());
    try {
      return await fn(connection);
    } finally {
      await connection.end();
    }
  }

  private connectionOptions(): Record<string, unknown> | string {
    const uri = stringValue(this.connector.secrets.connectionString);
    if (uri) return uri;
    return {
      host: stringValue(this.connector.config.host),
      port: numberValue(this.connector.config.port),
      database: stringValue(this.connector.config.database),
      user: stringValue(this.connector.secrets.username) ?? stringValue(this.connector.config.username),
      password: stringValue(this.connector.secrets.password),
      ssl: boolValue(this.connector.config.ssl) ? {} : undefined,
    };
  }
}

export class SqlServerDatabaseConnector extends SqlDatabaseConnector {
  protected readonly dialect = "sqlserver" as const;

  async test(): Promise<Record<string, unknown>> {
    await this.withPool(async (pool) => {
      await pool.request().query("SELECT 1 AS ok");
    });
    return { ok: true, provider: "sqlserver" };
  }

  async inspectSchema(): Promise<DatabaseSchemaColumn[]> {
    return this.withPool(async (pool) => {
      const result = await pool.request().query(
        `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
         FROM INFORMATION_SCHEMA.COLUMNS
         ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      );
      return result.recordset.map((row: Record<string, unknown>) => ({
        schema: String(row.TABLE_SCHEMA),
        table: String(row.TABLE_NAME),
        column: String(row.COLUMN_NAME),
        dataType: String(row.DATA_TYPE),
        nullable: row.IS_NULLABLE === "YES",
      }));
    });
  }

  protected async execute(sql: string, values: unknown[]): Promise<void> {
    await this.withPool(async (pool) => {
      const request = pool.request();
      values.forEach((value, index) => request.input(`p${index}`, value));
      await request.query(sql);
    });
  }

  protected async query(sql: string, values: unknown[]): Promise<Record<string, unknown>[]> {
    return this.withPool(async (pool) => {
      const request = pool.request();
      values.forEach((value, index) => request.input(`p${index}`, value));
      const result = await request.query(sql);
      return Array.isArray(result.recordset) ? result.recordset : [];
    });
  }

  private async withPool<T>(fn: (pool: any) => Promise<T>): Promise<T> {
    const mssql = loadOptionalModule("mssql");
    const pool = await mssql.connect(this.connectionOptions());
    try {
      return await fn(pool);
    } finally {
      await pool.close();
    }
  }

  private connectionOptions(): string | Record<string, unknown> {
    const connectionString = stringValue(this.connector.secrets.connectionString);
    if (connectionString) return connectionString;
    return {
      server: stringValue(this.connector.config.host),
      port: numberValue(this.connector.config.port),
      database: stringValue(this.connector.config.database),
      user: stringValue(this.connector.secrets.username) ?? stringValue(this.connector.config.username),
      password: stringValue(this.connector.secrets.password),
      options: {
        encrypt: boolValue(this.connector.config.ssl) ?? true,
        trustServerCertificate: boolValue(this.connector.config.trustServerCertificate) ?? true,
      },
    };
  }
}
