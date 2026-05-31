import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DatabaseActionConfig,
  DatabaseFieldType,
  DatabaseMappingJson,
  DatabaseMappingTable,
  DatabaseTableMapping,
} from "../../../../packages/contracts/src/action-types";
import type { ControlNode, FormDefinition, Node } from "../../../../packages/contracts/src/form-types";
import { GenerateFormDatabaseMappingDto, SaveFormDatabaseMappingDto } from "./dto/form-database-mapping.dto";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

@Injectable()
export class FormDatabaseMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(appCode: string, connectorId: string) {
    await this.assertDatabaseConnector(appCode, connectorId);
    const rows = await this.prisma.formDatabaseMapping.findMany({
      where: { appCode, connectorId },
      orderBy: [{ formKey: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  async get(appCode: string, connectorId: string, mappingId: string) {
    await this.assertDatabaseConnector(appCode, connectorId);
    const row = await this.prisma.formDatabaseMapping.findFirst({
      where: { id: mappingId, appCode, connectorId },
    });
    if (!row) throw new NotFoundException("Form database mapping not found");
    return this.toPublic(row);
  }

  async generatePreview(appCode: string, connectorId: string, dto: GenerateFormDatabaseMappingDto) {
    await this.assertDatabaseConnector(appCode, connectorId);
    const form = await this.findLatestDraft(appCode, dto.formKey);
    const mappingJson = this.generateMapping(form.schemaJson as unknown as FormDefinition, form.formKey);
    return {
      appCode,
      connectorId,
      formId: form.id,
      formKey: form.formKey,
      formVersion: form.version,
      name: `${form.title} database mapping`,
      mappingJson,
    };
  }

  async save(appCode: string, connectorId: string, dto: SaveFormDatabaseMappingDto) {
    await this.assertDatabaseConnector(appCode, connectorId);
    const form = await this.findLatestDraft(appCode, dto.formKey);
    const mappingJson = this.readMapping(dto.mappingJson);
    this.validateMapping(mappingJson);

    const row = await this.prisma.formDatabaseMapping.upsert({
      where: { connectorId_formId: { connectorId, formId: form.id } },
      create: {
        appCode,
        connectorId,
        formId: form.id,
        formKey: form.formKey,
        formVersion: form.version,
        name: dto.name?.trim() || `${form.title} database mapping`,
        mappingJson: mappingJson as unknown as Prisma.InputJsonObject,
      },
      update: {
        name: dto.name?.trim() || `${form.title} database mapping`,
        mappingJson: mappingJson as unknown as Prisma.InputJsonObject,
      },
    });
    return this.toPublic(row);
  }

  async applyMappingToDatabaseConfig(
    appCode: string,
    formId: string,
    connectorId: string | null,
    config: Record<string, unknown>,
  ): Promise<DatabaseActionConfig> {
    const mappingId = typeof config.mappingId === "string" && config.mappingId.trim()
      ? config.mappingId.trim()
      : null;

    if (!mappingId) {
      return config as unknown as DatabaseActionConfig;
    }
    if (!connectorId) throw new BadRequestException("Database mapping requires connectorId");

    const mapping = await this.prisma.formDatabaseMapping.findFirst({
      where: { id: mappingId, appCode, connectorId, formId },
    });
    if (!mapping) throw new BadRequestException("Database mapping does not match this form and connector");

    const mappingJson = this.readMapping(mapping.mappingJson);
    this.validateMapping(mappingJson);
    return {
      ...config,
      connectorId,
      mappingId: mapping.id,
      autoCreateTables: typeof config.autoCreateTables === "boolean" ? config.autoCreateTables : true,
      tables: this.toTableMappings(mappingJson),
    };
  }

  async copyDraftMappingsToPublishedForm(
    tx: Prisma.TransactionClient,
    appCode: string,
    draftFormId: string,
    published: { id: string; formKey: string; version: number },
  ): Promise<Map<string, { id: string; mappingJson: DatabaseMappingJson }>> {
    const draftMappings = await tx.formDatabaseMapping.findMany({
      where: { appCode, formId: draftFormId },
      orderBy: [{ createdAt: "asc" }],
    });
    const idMap = new Map<string, { id: string; mappingJson: DatabaseMappingJson }>();
    for (const mapping of draftMappings) {
      const mappingJson = this.readMapping(mapping.mappingJson);
      const created = await tx.formDatabaseMapping.create({
        data: {
          appCode,
          connectorId: mapping.connectorId,
          formId: published.id,
          formKey: published.formKey,
          formVersion: published.version,
          name: mapping.name,
          mappingJson: mappingJson as unknown as Prisma.InputJsonObject,
        },
      });
      idMap.set(mapping.id, { id: created.id, mappingJson });
    }
    return idMap;
  }

  rewritePublishedDatabaseActionConfig(
    action: { connectorId: string | null; configJson: Prisma.JsonValue },
    mappingIdMap: Map<string, { id: string; mappingJson: DatabaseMappingJson }>,
  ): Prisma.InputJsonValue {
    const config = this.asRecord(action.configJson);
    const draftMappingId = typeof config.mappingId === "string" ? config.mappingId : null;
    if (!draftMappingId) return config as Prisma.InputJsonObject;

    const publishedMapping = mappingIdMap.get(draftMappingId);
    if (!publishedMapping) throw new BadRequestException("Database submit action references a mapping that does not match this form");
    if (!action.connectorId) throw new BadRequestException("Database submit action mapping requires connectorId");
    this.validateMapping(publishedMapping.mappingJson);
    return {
      ...config,
      mappingId: publishedMapping.id,
      tables: this.toTableMappings(publishedMapping.mappingJson),
    } as unknown as Prisma.InputJsonObject;
  }

  private async assertDatabaseConnector(appCode: string, connectorId: string) {
    const connector = await this.prisma.connector.findFirst({ where: { appCode, id: connectorId } });
    if (!connector) throw new NotFoundException("Connector not found");
    if (connector.type !== "database") throw new BadRequestException("Mappings are only available for database connectors");
    return connector;
  }

  private async findLatestDraft(appCode: string, formKey: string) {
    const form = await this.prisma.form.findFirst({
      where: { appCode, formKey, status: "draft", version: 0 },
      orderBy: { createdAt: "desc" },
    });
    if (!form) throw new NotFoundException("Draft form not found");
    return form;
  }

  private generateMapping(form: FormDefinition, formKey: string): DatabaseMappingJson {
    const rootTable: DatabaseMappingTable = {
      tableName: sanitizeIdentifier(formKey, "form_table"),
      source: "root",
      includeMetadataColumns: true,
      columns: [],
    };
    const tables = [rootTable];
    this.walkChildren(form.root.children ?? [], rootTable, tables, formKey);
    return { tables: tables.filter((table) => table.columns.length > 0) };
  }

  private walkChildren(children: Node[], currentTable: DatabaseMappingTable, tables: DatabaseMappingTable[], formKey: string) {
    for (const child of children) {
      if (child.type === "control") {
        if (child.controlType !== "button") currentTable.columns.push(this.controlToColumn(child));
        continue;
      }

      if (child.layoutType === "repeater") {
        const repeaterKey = child.key ?? child.id;
        const repeaterTable: DatabaseMappingTable = {
          tableName: sanitizeIdentifier(`${formKey}_${repeaterKey}`, "repeater_table"),
          source: "repeater",
          repeaterKey,
          includeMetadataColumns: true,
          columns: [],
        };
        tables.push(repeaterTable);
        this.walkChildren(child.children ?? [], repeaterTable, tables, formKey);
      } else {
        this.walkChildren(child.children ?? [], currentTable, tables, formKey);
      }
    }
  }

  private controlToColumn(node: ControlNode) {
    return {
      sourceKey: node.key,
      label: node.label,
      controlType: node.controlType,
      targetField: sanitizeIdentifier(node.key, "field"),
      type: inferFieldType(node),
      required: staticRequired(node),
      enabled: true,
    };
  }

  readMapping(value: unknown): DatabaseMappingJson {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("Mapping must be an object");
    }
    const mapping = value as Partial<DatabaseMappingJson>;
    if (!Array.isArray(mapping.tables)) throw new BadRequestException("mappingJson.tables must be an array");
    return mapping as DatabaseMappingJson;
  }

  validateMapping(mapping: DatabaseMappingJson) {
    if (mapping.tables.length === 0) throw new BadRequestException("Mapping must contain at least one table");
    let enabledColumnCount = 0;
    for (const table of mapping.tables) {
      if (!table.tableName || !IDENTIFIER.test(table.tableName)) {
        throw new BadRequestException(`Table name "${table.tableName ?? ""}" must contain only letters, numbers, and underscores`);
      }
      if (table.source !== "root" && table.source !== "repeater") {
        throw new BadRequestException(`Table "${table.tableName}" has an invalid source`);
      }
      const seen = new Set<string>();
      const enabledColumns = (table.columns ?? []).filter((column) => column.enabled !== false);
      if (enabledColumns.length === 0) {
        throw new BadRequestException(`Table "${table.tableName}" must have at least one enabled column`);
      }
      for (const column of enabledColumns) {
        enabledColumnCount += 1;
        if (!column.sourceKey || typeof column.sourceKey !== "string") {
          throw new BadRequestException(`Table "${table.tableName}" has a column without sourceKey`);
        }
        if (!column.targetField || !IDENTIFIER.test(column.targetField)) {
          throw new BadRequestException(`Column "${column.targetField ?? ""}" in table "${table.tableName}" must contain only letters, numbers, and underscores`);
        }
        if (seen.has(column.targetField)) {
          throw new BadRequestException(`Table "${table.tableName}" has duplicate column "${column.targetField}"`);
        }
        seen.add(column.targetField);
      }
    }
    if (enabledColumnCount === 0) throw new BadRequestException("Mapping must contain at least one enabled column");
  }

  toTableMappings(mapping: DatabaseMappingJson): DatabaseTableMapping[] {
    return mapping.tables.map((table) => {
      const next: DatabaseTableMapping = {
        tableName: table.tableName,
        source: table.source,
        includeMetadataColumns: table.includeMetadataColumns !== false,
        columns: (table.columns ?? [])
          .filter((column) => column.enabled !== false)
          .map((column) => ({
            sourceKey: column.sourceKey,
            targetField: column.targetField,
            ...(column.type ? { type: column.type } : {}),
            ...(column.required !== undefined ? { required: column.required } : {}),
          })),
      };
      if (table.repeaterKey) next.repeaterKey = table.repeaterKey;
      return next;
    });
  }

  private toPublic(row: {
    id: string;
    appCode: string;
    connectorId: string;
    formId: string;
    formKey: string;
    formVersion: number;
    name: string;
    mappingJson: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      appCode: row.appCode,
      connectorId: row.connectorId,
      formId: row.formId,
      formKey: row.formKey,
      formVersion: row.formVersion,
      name: row.name,
      mappingJson: this.readMapping(row.mappingJson),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}

function inferFieldType(node: ControlNode): DatabaseFieldType {
  if (node.controlType === "number") return "number";
  if (node.controlType === "switch") return "boolean";
  if (node.controlType === "date") {
    const props = node.props && typeof node.props === "object" ? (node.props as Record<string, unknown>) : {};
    return props.mode === "datetime" ? "datetime" : "date";
  }
  if (node.controlType === "multiselect" || node.controlType === "file" || node.controlType === "image" || node.controlType === "signature") {
    return "json";
  }
  return "text";
}

function staticRequired(node: ControlNode) {
  if (node.validation?.required === true) return true;
  const props = node.props && typeof node.props === "object" ? (node.props as Record<string, unknown>) : {};
  return props.required === true;
}

function sanitizeIdentifier(value: string, fallback: string) {
  const next = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const safe = next || fallback;
  return /^[A-Za-z_]/.test(safe) ? safe : `f_${safe}`;
}
