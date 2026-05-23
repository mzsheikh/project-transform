import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSubmitActionDto, UpdateSubmitActionDto } from "./dto/submit-action.dto";
import type { FormDefinition, Node } from "../../../../packages/contracts/src/form-types";

@Injectable()
export class SubmitActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDraft(appCode: string, formKey: string) {
    const draft = await this.findDraft(appCode, formKey);
    const rows = await this.prisma.formSubmitAction.findMany({
      where: { appCode, formId: draft.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  async create(appCode: string, formKey: string, dto: CreateSubmitActionDto) {
    const draft = await this.findDraft(appCode, formKey);
    const connectorId = await this.resolveConnectorId(appCode, dto.type, dto.connectorId, dto.configJson);
    const triggerKey = this.resolveTriggerKey(draft.schemaJson, dto.triggerKey);
    const buttonActionId = this.resolveButtonActionId(draft.schemaJson, triggerKey, dto.buttonActionId, dto.type);
    const action = await this.prisma.formSubmitAction.create({
      data: {
        appCode,
        formId: draft.id,
        formKey: draft.formKey,
        formVersion: draft.version,
        type: dto.type,
        name: dto.name.trim(),
        enabled: dto.enabled ?? true,
        sortOrder: dto.sortOrder ?? 0,
        triggerKey,
        buttonActionId,
        connectorId,
        configJson: dto.configJson as Prisma.InputJsonObject,
      },
    });
    return this.toPublic(action);
  }

  async update(appCode: string, formKey: string, actionId: string, dto: UpdateSubmitActionDto) {
    const draft = await this.findDraft(appCode, formKey);
    const existing = await this.prisma.formSubmitAction.findFirst({
      where: { id: actionId, appCode, formId: draft.id },
    });
    if (!existing) throw new NotFoundException("Submit action not found");

    const nextType = dto.type ?? existing.type;
    const nextConfig = dto.configJson ?? this.asRecord(existing.configJson);
    const triggerKey = this.resolveTriggerKey(
      draft.schemaJson,
      dto.triggerKey === undefined ? existing.triggerKey : dto.triggerKey,
    );
    const buttonActionId = this.resolveButtonActionId(
      draft.schemaJson,
      triggerKey,
      dto.buttonActionId === undefined ? existing.buttonActionId : dto.buttonActionId,
      nextType,
    );
    const connectorId = await this.resolveConnectorId(
      appCode,
      nextType,
      dto.connectorId === undefined ? existing.connectorId : dto.connectorId,
      nextConfig,
    );

    const action = await this.prisma.formSubmitAction.update({
      where: { id: existing.id },
      data: {
        type: dto.type,
        name: dto.name?.trim(),
        enabled: dto.enabled,
        sortOrder: dto.sortOrder,
        triggerKey,
        buttonActionId,
        connectorId,
        configJson: dto.configJson ? (dto.configJson as Prisma.InputJsonObject) : undefined,
      },
    });
    return this.toPublic(action);
  }

  async delete(appCode: string, formKey: string, actionId: string) {
    const draft = await this.findDraft(appCode, formKey);
    const existing = await this.prisma.formSubmitAction.findFirst({
      where: { id: actionId, appCode, formId: draft.id },
    });
    if (!existing) throw new NotFoundException("Submit action not found");
    await this.prisma.formSubmitAction.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  private async findDraft(appCode: string, formKey: string) {
    const draft = await this.prisma.form.findFirst({
      where: { appCode, formKey, status: "draft", version: 0 },
      orderBy: { createdAt: "desc" },
    });
    if (!draft) throw new NotFoundException("Draft form not found");
    return draft;
  }

  private async resolveConnectorId(
    appCode: string,
    type: "email_pdf" | "database" | "rest_api",
    connectorId: string | null | undefined,
    configJson: Record<string, unknown>,
  ) {
    const configConnectorId = typeof configJson.connectorId === "string" ? configJson.connectorId : undefined;
    const resolved = connectorId ?? configConnectorId ?? null;

    if (type === "email_pdf") return null;
    if (!resolved) throw new BadRequestException(`${type} action requires connectorId`);

    const connector = await this.prisma.connector.findFirst({ where: { appCode, id: resolved } });
    if (!connector) throw new BadRequestException("Connector not found for this app");
    if (type === "database" && connector.type !== "database") {
      throw new BadRequestException("Database action requires a database connector");
    }
    if (type === "rest_api" && connector.type !== "rest_api") {
      throw new BadRequestException("REST action requires a REST API connector");
    }
    return resolved;
  }

  private resolveTriggerKey(schemaJson: Prisma.JsonValue, triggerKey: string | null | undefined) {
    const normalized = typeof triggerKey === "string" && triggerKey.trim() ? triggerKey.trim() : null;
    if (!normalized) return null;

    const form = schemaJson as unknown as FormDefinition;
    const keys = new Set<string>();
    if (form?.root) {
      this.collectButtonKeys(form.root, keys);
    }
    if (!keys.has(normalized)) {
      throw new BadRequestException(`Submit action triggerKey "${normalized}" does not match a button control.`);
    }
    return normalized;
  }

  private collectButtonKeys(node: Node, keys: Set<string>) {
    if (node.type === "control") {
      if (node.controlType === "button") keys.add(node.key);
      return;
    }
    node.children.forEach((child) => this.collectButtonKeys(child, keys));
  }

  private resolveButtonActionId(
    schemaJson: Prisma.JsonValue,
    triggerKey: string | null,
    buttonActionId: string | null | undefined,
    type: "email_pdf" | "database" | "rest_api",
  ) {
    const normalized = typeof buttonActionId === "string" && buttonActionId.trim()
      ? buttonActionId.trim()
      : null;
    if (!normalized) return null;
    if (!triggerKey) {
      throw new BadRequestException("buttonActionId requires a button triggerKey.");
    }

    const form = schemaJson as unknown as FormDefinition;
    const button = form?.root ? this.findButtonControl(form.root, triggerKey) : null;
    const actions = Array.isArray(button?.props?.actions) ? button.props.actions : [];
    const action = actions.find((item) => item && item.id === normalized);
    if (!action) {
      throw new BadRequestException(`buttonActionId "${normalized}" does not match an action on button "${triggerKey}".`);
    }
    if (action.type !== type) {
      throw new BadRequestException(`buttonActionId "${normalized}" is configured as "${action.type}", not "${type}".`);
    }
    return normalized;
  }

  private findButtonControl(node: Node, key: string): Extract<Node, { type: "control" }> | null {
    if (node.type === "control") {
      return node.controlType === "button" && node.key === key ? node : null;
    }
    for (const child of node.children) {
      const found = this.findButtonControl(child, key);
      if (found) return found;
    }
    return null;
  }

  private toPublic(action: {
    id: string;
    appCode: string;
    formId: string;
    formKey: string;
    formVersion: number;
    type: "email_pdf" | "database" | "rest_api";
    name: string;
    enabled: boolean;
    sortOrder: number;
    triggerKey?: string | null;
    buttonActionId?: string | null;
    connectorId: string | null;
    configJson: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: action.id,
      appCode: action.appCode,
      formId: action.formId,
      formKey: action.formKey,
      formVersion: action.formVersion,
      type: action.type,
      name: action.name,
      enabled: action.enabled,
      sortOrder: action.sortOrder,
      triggerKey: action.triggerKey ?? null,
      buttonActionId: action.buttonActionId ?? null,
      connectorId: action.connectorId,
      configJson: action.configJson,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    };
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
