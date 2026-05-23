import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDraftFormDto } from "./dto/create-draft-form.dto";
import { UpdateDraftFormDto } from "./dto/update-draft-form.dto";
import { Prisma } from "@prisma/client";
import { validateFormExpressions } from "../../../../packages/contracts/src/expressions";
import type { FormDefinition } from "../../../../packages/contracts/src/form-types";

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.form.update({
      where: { id: draft.id },
      data: {
        title: dto.title?.trim() ?? undefined,
        description: dto.description?.trim() ?? undefined,
        schemaJson: dto.schemaJson ?? undefined,
      },
    });
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

    const draftActions = await this.prisma.formSubmitAction.findMany({
      where: { appCode, formId: draft.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    this.validateSubmitActionTriggers(draft.schemaJson as unknown as FormDefinition, draftActions);

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

      if (draftActions.length > 0) {
        await tx.formSubmitAction.createMany({
          data: draftActions.map((action) => ({
            appCode,
            formId: published.id,
            formKey,
            formVersion: published.version,
            type: action.type,
            name: action.name,
            enabled: action.enabled,
            sortOrder: action.sortOrder,
            triggerKey: action.triggerKey,
            connectorId: action.connectorId,
            configJson:
              action.configJson === null
                ? Prisma.JsonNull
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

  private validateSubmitActionTriggers(
    form: FormDefinition,
    actions: Array<{ name: string; triggerKey: string | null }>,
  ) {
    const buttonKeys = new Set<string>();
    this.collectButtonKeys(form.root, buttonKeys);
    const invalid = actions.find((action) => action.triggerKey && !buttonKeys.has(action.triggerKey));
    if (invalid) {
      throw new BadRequestException({
        message: "Form submit action validation failed",
        errors: [{
          key: invalid.triggerKey,
          message: `Submit action "${invalid.name}" references a button that does not exist.`,
        }],
      });
    }
  }

  private collectButtonKeys(node: FormDefinition["root"] | FormDefinition["root"]["children"][number], keys: Set<string>) {
    if (node.type === "control") {
      if (node.controlType === "button") keys.add(node.key);
      return;
    }
    node.children.forEach((child) => this.collectButtonKeys(child, keys));
  }

  async deleteForm(appCode: string, formKey: string) {
    const result = await this.prisma.form.deleteMany({
      where: { appCode, formKey },
    });
    if (result.count === 0) throw new NotFoundException("Form not found");
    return { deleted: result.count };
  }
}
