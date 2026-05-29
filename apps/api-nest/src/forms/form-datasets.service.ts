import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";
import { ConnectorFactory } from "../connectors/runtime/connector.factory";
import type { ConnectorRuntimeConfig, DatabaseProviderName } from "../connectors/runtime/base-connectors";
import type {
  DataSourceDefinition,
  DataSourceRows,
  FormDefinition,
  RestApiDataSourceDefinition,
} from "../../../../packages/contracts/src/form-types";
import { resolveDynamicValue } from "../../../../packages/contracts/src/expressions";
import { FetchFormDatasetsDto, PreviewFormDataSourceDto } from "./dto/fetch-form-datasets.dto";

type DatasetPayload = {
  rows: DataSourceRows;
  fetchedAt: string;
  cacheTtlSeconds: number;
};

@Injectable()
export class FormDatasetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
    private readonly connectorFactory: ConnectorFactory,
  ) {}

  async fetchPublished(appCode: string, formKey: string, dto: FetchFormDatasetsDto) {
    const form = await this.prisma.form.findFirst({
      where: { appCode, formKey, version: dto.formVersion, status: "published" },
    });
    if (!form) throw new NotFoundException("Published form version not found");

    const schema = form.schemaJson as unknown as FormDefinition;
    const sources = Array.isArray(schema.dataSources) ? schema.dataSources : [];
    const fetchedAt = new Date().toISOString();
    const datasets: Record<string, DatasetPayload> = {};

    for (const source of sources) {
      const params = this.resolveParams(source, dto.data ?? {});
      const runtime = await this.connectors.runtimeConfig(appCode, source.connectorId);
      const rows =
        source.type === "database"
          ? await this.fetchDatabaseRows(source, runtime, params)
          : await this.fetchRestRows(source, runtime, params);

      datasets[source.key] = {
        rows,
        fetchedAt,
        cacheTtlSeconds: normalizeCacheTtl(source.cacheTtlSeconds),
      };
    }

    return {
      formKey,
      formVersion: form.version,
      datasets,
    };
  }

  async previewSource(appCode: string, dto: PreviewFormDataSourceDto) {
    const source = this.readSource(dto.source);
    const params = this.resolveParams(source, dto.data ?? {});
    const runtime = await this.connectors.runtimeConfig(appCode, source.connectorId);
    const rows =
      source.type === "database"
        ? await this.fetchDatabaseRows(source, runtime, params)
        : await this.fetchRestRows(source, runtime, params);

    return {
      key: source.key,
      fetchedAt: new Date().toISOString(),
      cacheTtlSeconds: normalizeCacheTtl(source.cacheTtlSeconds),
      rows: rows.slice(0, 50),
    };
  }

  private readSource(source: unknown): DataSourceDefinition {
    if (!isRecord(source) || typeof source.key !== "string" || !source.key.trim()) {
      throw new BadRequestException("Data source preview requires a source key");
    }
    if (source.type !== "database" && source.type !== "rest_api") {
      throw new BadRequestException(`Data source "${source.key}" type is invalid`);
    }
    if (typeof source.connectorId !== "string" || !source.connectorId.trim()) {
      throw new BadRequestException(`Data source "${source.key}" must reference a connector`);
    }
    return source as unknown as DataSourceDefinition;
  }

  private resolveParams(source: DataSourceDefinition, data: Record<string, unknown>) {
    const result = resolveDynamicValue(source.params ?? {}, { rootData: data }, `dataSources.${source.key}.params`);
    if (result.errors.length > 0) {
      throw new BadRequestException({
        message: `Data source "${source.key}" parameters could not be resolved`,
        errors: result.errors,
      });
    }
    return isRecord(result.value) ? result.value : {};
  }

  private async fetchDatabaseRows(
    source: Extract<DataSourceDefinition, { type: "database" }>,
    runtime: ConnectorRuntimeConfig,
    params: Record<string, unknown>,
  ): Promise<DataSourceRows> {
    if (runtime.type !== "database") {
      throw new BadRequestException(`Data source "${source.key}" connector is not a database connector`);
    }
    const query = source.config?.query;
    if (typeof query !== "string" || !isReadOnlySql(query)) {
      throw new BadRequestException(`Data source "${source.key}" must use a single read-only SELECT or WITH query`);
    }

    const limit = normalizeLimit(source.config?.limit);
    const compiled = compileNamedParams(query, params, runtime.provider);
    return this.connectorFactory.database(runtime).queryRows(compiled.sql, compiled.values, limit);
  }

  private async fetchRestRows(
    source: RestApiDataSourceDefinition,
    runtime: ConnectorRuntimeConfig,
    params: Record<string, unknown>,
  ): Promise<DataSourceRows> {
    if (runtime.type !== "rest_api") {
      throw new BadRequestException(`Data source "${source.key}" connector is not a REST API connector`);
    }

    const method = (source.config?.method ?? "GET").toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      throw new BadRequestException(`Data source "${source.key}" has an invalid REST method`);
    }

    const path = renderTemplate(source.config.pathTemplate, params, true);
    const headers = Object.fromEntries(
      Object.entries(source.config.headersTemplate ?? {}).map(([key, value]) => [key, renderTemplate(value, params, false)]),
    );
    const body = source.config.bodyTemplate === undefined
      ? undefined
      : renderBodyTemplate(source.config.bodyTemplate, params);

    const response = await this.connectorFactory.rest(runtime).request({ method, path, headers, body });
    const result = source.config.resultPath ? readPath(response, source.config.resultPath) : response.body;
    return normalizeRows(result);
  }
}

function normalizeCacheTtl(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 3600;
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 500;
  return Math.max(1, Math.min(5000, Math.floor(value)));
}

function compileNamedParams(
  query: string,
  params: Record<string, unknown>,
  provider?: DatabaseProviderName | null,
) {
  const values: unknown[] = [];
  const sql = query.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (match, key: string, offset: number) => {
    if (query[offset - 1] === ":") return match;
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new BadRequestException(`Missing data source parameter "${key}"`);
    }
    values.push(params[key]);
    if (provider === "postgresql") return `$${values.length}`;
    if (provider === "sqlserver") return `@p${values.length - 1}`;
    return "?";
  });
  return { sql, values };
}

function isReadOnlySql(query: string): boolean {
  const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized || normalized.includes(";") || normalized.includes("--") || normalized.includes("/*")) return false;
  if (!/^(select|with)\b/.test(normalized)) return false;
  return !/\b(insert|update|delete|drop|alter|truncate|create|merge|grant|revoke|call|execute|exec)\b/.test(normalized);
}

function renderTemplate(template: string, params: Record<string, unknown>, encode: boolean): string {
  return template.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new BadRequestException(`Missing data source parameter "${key}"`);
    }
    const value = params[key] == null ? "" : String(params[key]);
    return encode ? encodeURIComponent(value) : value;
  });
}

function renderBodyTemplate(value: unknown, params: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/.exec(value);
    if (exact) return params[exact[1]];
    return renderTemplate(value, params, false);
  }
  if (Array.isArray(value)) return value.map((item) => renderBodyTemplate(item, params));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, renderBodyTemplate(child, params)]));
  }
  return value;
}

function normalizeRows(value: unknown): DataSourceRows {
  if (Array.isArray(value)) {
    return value.map((item) => (isRecord(item) ? item : { value: item }));
  }
  if (isRecord(value)) return [value];
  if (value === null || value === undefined) return [];
  return [{ value }];
}

function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    return isRecord(current) ? current[segment] : undefined;
  }, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
