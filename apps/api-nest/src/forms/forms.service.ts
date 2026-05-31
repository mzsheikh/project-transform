import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";
import { FormDatabaseMappingsService } from "../connectors/form-database-mappings.service";
import { CreateDraftFormDto } from "./dto/create-draft-form.dto";
import { UpdateDraftFormDto } from "./dto/update-draft-form.dto";
import { Prisma } from "@prisma/client";
import { validateFormExpressions } from "../../../../packages/contracts/src/expressions";
import type { FormDefinition, Node } from "../../../../packages/contracts/src/form-types";
import type { SubmitActionType } from "../../../../packages/contracts/src/action-types";

type ButtonSubmitActionRef = {
  buttonKey: string;
  actionId: string;
  type: SubmitActionType;
  sortOrder: number;
  enabled: boolean;
};

@Injectable()
export class FormsService {
  constructor(
    private prisma: PrismaService,
    private connectors: ConnectorsService,
    private databaseMappings: FormDatabaseMappingsService,
  ) {}

  async list(appCode: string) {
    return this.prisma.form.findMany({
      where: { appCode },
      orderBy: [{ formKey: "asc" }, { version: "desc" }],
    });
  }

  async createDraft(appCode: string, dto: CreateDraftFormDto, createdById?: string) {
    const formKey = dto.formKey.trim();

    // Draft version = 0 (we’ll publish to 1,2,3...)
    return this.prisma.form.create({
      data: {
        appCode,
        formKey,
        version: 0,
        status: "draft",
        title: dto.title.trim(),
        description: dto.description?.trim(),
        schemaJson: dto.schemaJson,
        createdById: createdById ?? null,
      },
    });
  }

  async updateDraft(appCode: string, formKey: string, dto: UpdateDraftFormDto) {
    // Update the latest draft (version 0) by createdAt
    const draft = await this.prisma.form.findFirst({
      where: { appCode, formKey, status: "draft", version: 0 },
      orderBy: { createdAt: "desc" },
    });
    if (!draft) throw new NotFoundException("Draft form not found");

    const updated = await this.prisma.form.update({
      where: { id: draft.id },
      data: {
        title: dto.title?.trim() ?? undefined,
        description: dto.description?.trim() ?? undefined,
        schemaJson: dto.schemaJson ?? undefined,
      },
    });

    if (dto.schemaJson !== undefined) {
      await this.syncButtonSubmitActions(appCode, draft.id, dto.schemaJson as unknown as FormDefinition);
    }

    return updated;
  }

  async publish(appCode: string, formKey: string, createdById?: string) {
    // Find latest draft
    const draft = await this.prisma.form.findFirst({
      where: { appCode, formKey, status: "draft", version: 0 },
      orderBy: { createdAt: "desc" },
    });
    if (!draft) throw new NotFoundException("Draft form not found");

    const expressionIssues = validateFormExpressions(draft.schemaJson as unknown as FormDefinition);
    if (expressionIssues.length > 0) {
      throw new BadRequestException({
        message: "Form expression validation failed",
        errors: expressionIssues,
      });
    }

    const formSchema = draft.schemaJson as unknown as FormDefinition;
    await this.validateDataSourceConnectors(appCode, formSchema);

    const draftActions = await this.prisma.formSubmitAction.findMany({
      where: { appCode, formId: draft.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    this.validateSubmitActionTriggers(formSchema, draftActions);
    const orderedDraftActions = this.withSchemaSortOrder(formSchema, draftActions);

    // Find current max published version
    const max = await this.prisma.form.aggregate({
      where: { appCode, formKey },
      _max: { version: true },
    });
    const nextVersion = Math.max(0, max._max.version ?? 0) + 1;

    // Transaction:
    // - archive any currently published versions (optional but keeps latest clean)
    // - create new published version
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.form.updateMany({
        where: { appCode, formKey, status: "published" },
        data: { status: "archived" },
      });

      const published = await tx.form.create({
        data: {
          appCode,
          formKey,
          version: nextVersion,
          status: "published",
          title: draft.title,
          description: draft.description,
          schemaJson:
            draft.schemaJson === null
              ? Prisma.JsonNull
              : (draft.schemaJson as Prisma.InputJsonValue),
          createdById: createdById ?? draft.createdById ?? null,
        },
      });
      const mappingIdMap = await this.databaseMappings.copyDraftMappingsToPublishedForm(tx, appCode, draft.id, {
        id: published.id,
        formKey,
        version: published.version,
      });

      if (orderedDraftActions.length > 0) {
        await tx.formSubmitAction.createMany({
          data: orderedDraftActions.map((action) => ({
            appCode,
            formId: published.id,
            formKey,
            formVersion: published.version,
            type: action.type,
            name: action.name,
            enabled: action.enabled,
            sortOrder: action.sortOrder,
            triggerKey: action.triggerKey,
            buttonActionId: action.buttonActionId,
            connectorId: action.connectorId,
            configJson:
              action.configJson === null
                ? Prisma.JsonNull
                : action.type === "database"
                  ? this.databaseMappings.rewritePublishedDatabaseActionConfig(action, mappingIdMap)
                  : (action.configJson as Prisma.InputJsonValue),
          })),
        });
      }

      return published;
    });
  }

  async latestPublished(appCode: string, formKey: string) {
    const latest = await this.prisma.form.findFirst({
      where: { appCode, formKey, status: "published" },
      orderBy: { version: "desc" },
    });
    if (!latest) throw new NotFoundException("Published form not found");
    return latest;
  }

  private async validateDataSourceConnectors(appCode: string, form: FormDefinition) {
    const sources = Array.isArray(form.dataSources) ? form.dataSources : [];
    for (const source of sources) {
      const runtime = await this.connectors.runtimeConfig(appCode, source.connectorId);
      if (runtime.type !== source.type) {
        throw new BadRequestException({
          message: "Form data source validation failed",
          errors: [{
            key: source.key,
            message: `Data source "${source.key}" must use a ${source.type} connector.`,
          }],
        });
      }
    }
  }

  private validateSubmitActionTriggers(
    form: FormDefinition,
    actions: Array<{
      name: string;
      type: SubmitActionType;
      triggerKey: string | null;
      buttonActionId: string | null;
    }>,
  ) {
    const triggerKeys = new Set<string>();
    this.collectTriggerKeys(form.root, triggerKeys);
    const invalid = actions.find((action) => action.triggerKey && !triggerKeys.has(action.triggerKey));
    if (invalid) {
      throw new BadRequestException({
        message: "Form submit action validation failed",
        errors: [{
          key: invalid.triggerKey,
          message: `Submit action "${invalid.name}" references an action control that does not exist.`,
        }],
      });
    }

    const refs = this.collectButtonSubmitActionRefs(form);
    const refsById = new Map(refs.map((ref) => [ref.actionId, ref]));
    const actionsByButtonActionId = new Map(
      actions
        .filter((action) => action.buttonActionId)
        .map((action) => [action.buttonActionId as string, action]),
    );

    for (const ref of refs) {
      const action = actionsByButtonActionId.get(ref.actionId);
      if (!action || action.triggerKey !== ref.buttonKey || action.type !== ref.type) {
        throw new BadRequestException({
          message: "Form submit action validation failed",
          errors: [{
            key: ref.buttonKey,
            message: `Control action "${ref.actionId}" must be configured before publishing.`,
          }],
        });
      }
    }

    const stale = actions.find((action) => action.buttonActionId && !refsById.has(action.buttonActionId));
    if (stale) {
      throw new BadRequestException({
        message: "Form submit action validation failed",
        errors: [{
          key: stale.triggerKey,
          message: `Submit action "${stale.name}" is linked to a control action that no longer exists.`,
        }],
      });
    }
  }

  private async syncButtonSubmitActions(appCode: string, formId: string, form: FormDefinition) {
    const refs = this.collectButtonSubmitActionRefs(form);
    const refsById = new Map(refs.map((ref) => [ref.actionId, ref]));
    const linkedActions = await this.prisma.formSubmitAction.findMany({
      where: {
        appCode,
        formId,
        buttonActionId: { not: null },
      },
    });

    await Promise.all(linkedActions.map((action) => {
      const ref = action.buttonActionId ? refsById.get(action.buttonActionId) : undefined;
      if (!ref) {
        return this.prisma.formSubmitAction.delete({ where: { id: action.id } });
      }
      return this.prisma.formSubmitAction.update({
        where: { id: action.id },
        data: {
          triggerKey: ref.buttonKey,
          sortOrder: ref.sortOrder,
          enabled: ref.enabled,
        },
      });
    }));
  }

  private withSchemaSortOrder<T extends { buttonActionId: string | null; sortOrder: number; triggerKey: string | null; enabled: boolean }>(
    form: FormDefinition,
    actions: T[],
  ): T[] {
    const refsById = new Map(this.collectButtonSubmitActionRefs(form).map((ref) => [ref.actionId, ref]));
    return actions
      .map((action) => {
        const ref = action.buttonActionId ? refsById.get(action.buttonActionId) : undefined;
        return ref
          ? { ...action, sortOrder: ref.sortOrder, triggerKey: ref.buttonKey, enabled: ref.enabled }
          : action;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private collectButtonSubmitActionRefs(form: FormDefinition) {
    const refs: ButtonSubmitActionRef[] = [];
    const walk = (node: Node) => {
      if (node.type === "control") {
        if (node.controlType !== "button" && !isListViewControlType(node.controlType)) return;
        const actions = Array.isArray(node.props?.actions) ? node.props.actions : [];
        actions.forEach((action, index) => {
          if (!action || !this.isSubmitActionType(action.type)) return;
          refs.push({
            buttonKey: node.key,
            actionId: action.id,
            type: action.type,
            sortOrder: index * 10,
            enabled: action.enabled !== false,
          });
        });
        return;
      }
      node.children.forEach(walk);
    };
    walk(form.root);
    return refs;
  }

  private isSubmitActionType(type: unknown): type is SubmitActionType {
    return type === "email_pdf" || type === "database" || type === "rest_api";
  }

  private collectTriggerKeys(node: FormDefinition["root"] | FormDefinition["root"]["children"][number], keys: Set<string>) {
    if (node.type === "control") {
      if (node.controlType === "button" || isListViewControlType(node.controlType)) keys.add(node.key);
      return;
    }
    node.children.forEach((child) => this.collectTriggerKeys(child, keys));
  }

  async deleteForm(appCode: string, formKey: string) {
    const result = await this.prisma.form.deleteMany({
      where: { appCode, formKey },
    });
    if (result.count === 0) throw new NotFoundException("Form not found");
    return { deleted: result.count };
  }
}

function isListViewControlType(controlType: unknown): boolean {
  return controlType === "listview" || controlType === "listView" || controlType === "list_view";
}
