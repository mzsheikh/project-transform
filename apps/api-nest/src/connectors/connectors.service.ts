import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateConnectorDto, DatabaseDdlDto, UpdateConnectorDto } from "./dto/connector.dto";
import { SecretVaultService } from "./secret-vault.service";
import { ConnectorFactory } from "./runtime/connector.factory";
import { ConnectorRuntimeConfig, DatabaseTableMapping } from "./runtime/base-connectors";

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: SecretVaultService,
    private readonly factory: ConnectorFactory,
  ) {}

  async list(appCode: string) {
    const rows = await this.prisma.connector.findMany({
      where: { appCode },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  async get(appCode: string, id: string) {
    const connector = await this.findConnector(appCode, id);
    return this.toPublic(connector);
  }

  async create(appCode: string, dto: CreateConnectorDto) {
    this.validateConnectorInput(dto);

    const connector = await this.prisma.connector.create({
      data: {
        appCode,
        name: dto.name.trim(),
        type: dto.type,
        provider: dto.type === "database" ? dto.provider : null,
        configJson: (dto.configJson ?? {}) as Prisma.InputJsonObject,
        secretsJson: this.encryptedSecrets(dto.secretsJson),
      },
    });
    return this.toPublic(connector);
  }

  async testConfig(_appCode: string, dto: CreateConnectorDto) {
    this.validateConnectorInput(dto);
    const runtime: ConnectorRuntimeConfig = {
      id: "unsaved",
      name: dto.name?.trim() || "Unsaved connector",
      type: dto.type,
      provider: dto.type === "database" ? dto.provider ?? null : null,
      config: dto.configJson ?? {},
      secrets: dto.secretsJson ?? {},
    };
    const result =
      runtime.type === "database"
        ? await this.factory.database(runtime).test()
        : await this.factory.rest(runtime).test();
    return { ok: true, result };
  }

  async update(appCode: string, id: string, dto: UpdateConnectorDto) {
    const existing = await this.findConnector(appCode, id);
    const nextType = dto.type ?? existing.type;
    const nextProvider = nextType === "database" ? dto.provider ?? existing.provider : null;
    if (nextType === "database" && !nextProvider) {
      throw new BadRequestException("Database connector requires provider");
    }

    const connector = await this.prisma.connector.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        provider: nextProvider,
        configJson: dto.configJson ? (dto.configJson as Prisma.InputJsonObject) : undefined,
        secretsJson:
          dto.secretsJson === undefined
            ? undefined
            : this.encryptedSecrets(dto.secretsJson),
      },
    });
    return this.toPublic(connector);
  }

  async delete(appCode: string, id: string) {
    const existing = await this.findConnector(appCode, id);
    await this.prisma.connector.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async test(appCode: string, id: string) {
    const runtime = await this.runtimeConfig(appCode, id);
    const result =
      runtime.type === "database"
        ? await this.factory.database(runtime).test()
        : await this.factory.rest(runtime).test();
    return { ok: true, result };
  }

  async inspectSchema(appCode: string, id: string) {
    const runtime = await this.runtimeConfig(appCode, id);
    if (runtime.type !== "database") {
      throw new BadRequestException("Schema inspection is only available for database connectors");
    }
    const columns = await this.factory.database(runtime).inspectSchema();
    await this.prisma.connectorSchemaSnapshot.create({
      data: {
        appCode,
        connectorId: id,
        snapshotJson: { columns } as Prisma.InputJsonObject,
      },
    });
    return { columns };
  }

  async previewDdl(appCode: string, id: string, dto: DatabaseDdlDto) {
    const runtime = await this.runtimeConfig(appCode, id);
    if (runtime.type !== "database") {
      throw new BadRequestException("DDL preview is only available for database connectors");
    }
    const tables = this.readTables(dto.config);
    return { statements: this.factory.database(runtime).previewDdl(tables) };
  }

  async applyDdl(appCode: string, id: string, dto: DatabaseDdlDto) {
    const runtime = await this.runtimeConfig(appCode, id);
    if (runtime.type !== "database") {
      throw new BadRequestException("DDL apply is only available for database connectors");
    }
    const tables = this.readTables(dto.config);
    const statements = await this.factory.database(runtime).ensureTables(tables);
    return { applied: true, statements };
  }

  async runtimeConfig(appCode: string, id: string): Promise<ConnectorRuntimeConfig> {
    const connector = await this.findConnector(appCode, id);
    return {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      provider: connector.provider,
      config: this.asRecord(connector.configJson),
      secrets: this.vault.decryptJson(connector.secretsJson),
    };
  }

  private async findConnector(appCode: string, id: string) {
    const connector = await this.prisma.connector.findFirst({ where: { appCode, id } });
    if (!connector) throw new NotFoundException("Connector not found");
    return connector;
  }

  private validateConnectorInput(dto: CreateConnectorDto) {
    if (dto.type === "database" && !dto.provider) {
      throw new BadRequestException("Database connector requires provider");
    }
    if (dto.type === "rest_api" && dto.provider) {
      throw new BadRequestException("REST API connector cannot set database provider");
    }
  }

  private toPublic(connector: {
    id: string;
    appCode: string;
    name: string;
    type: "database" | "rest_api";
    provider: "postgresql" | "mysql" | "sqlserver" | null;
    configJson: Prisma.JsonValue;
    secretsJson: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: connector.id,
      appCode: connector.appCode,
      name: connector.name,
      type: connector.type,
      provider: connector.provider,
      configJson: connector.configJson,
      hasSecrets: !!connector.secretsJson,
      createdAt: connector.createdAt.toISOString(),
      updatedAt: connector.updatedAt.toISOString(),
    };
  }

  private readTables(config: Record<string, unknown>): DatabaseTableMapping[] {
    const tables = config.tables;
    if (!Array.isArray(tables)) {
      throw new BadRequestException("config.tables must be an array");
    }
    return tables as DatabaseTableMapping[];
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private encryptedSecrets(value: Record<string, unknown> | undefined) {
    return (this.vault.encryptJson(value) as Prisma.InputJsonObject | null) ?? Prisma.DbNull;
  }
}
