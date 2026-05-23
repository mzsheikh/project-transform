import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { validateAndNormalizeSubmissionData } from "./runtime/form-data-validator";
import { SubmissionActionRunnerService } from "./submission-action-runner.service";
import type { FormDefinition, Node } from "../../../../packages/contracts/src/form-types";

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: SubmissionActionRunnerService,
  ) {}

  async submit(appCode: string, formKey: string, dto: CreateSubmissionDto) {
    const existing = await this.prisma.submission.findUnique({
      where: { id: dto.submissionId },
      include: { actionRuns: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    if (existing) {
      if (
        existing.appCode !== appCode ||
        existing.formKey !== formKey ||
        existing.formVersion !== dto.formVersion
      ) {
        throw new BadRequestException("submissionId was already used for another form submission");
      }
      if (existing.actionRuns.some((run) => run.status === "pending")) {
        this.runner.enqueueSubmission(existing.id);
      }
      return this.toAccepted(existing, true);
    }

    const form = await this.prisma.form.findFirst({
      where: { appCode, formKey, version: dto.formVersion, status: "published" },
    });
    if (!form) throw new NotFoundException("Published form version not found");
    const triggerKey = this.resolveTriggerKey(form.schemaJson as unknown as FormDefinition, dto.triggerKey);

    const validation = validateAndNormalizeSubmissionData(form.schemaJson, dto.data);
    const errors = validation.errors;
    if (errors.length > 0) {
      throw new BadRequestException({ message: "Submission validation failed", errors });
    }

    const actions = await this.prisma.formSubmitAction.findMany({
      where: { appCode, formId: form.id, enabled: true, triggerKey },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const created = await this.createSubmissionWithRuns(appCode, formKey, { ...dto, data: validation.data }, actions);

    if (created.actionRuns.length > 0) {
      this.runner.enqueueSubmission(created.id);
    }

    return this.toAccepted(created, false);
  }

  private async createSubmissionWithRuns(
    appCode: string,
    formKey: string,
    dto: CreateSubmissionDto,
    actions: Array<{
      id: string;
      type: "email_pdf" | "database" | "rest_api";
      name: string;
      sortOrder: number;
      triggerKey: string | null;
      connectorId: string | null;
      configJson: Prisma.JsonValue;
    }>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          id: dto.submissionId,
          appCode,
          formKey,
          formVersion: dto.formVersion,
          status: actions.length > 0 ? "pending_sync" : "synced",
          dataJson: dto.data as Prisma.InputJsonObject,
          createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
          updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
        },
      });

      if (actions.length > 0) {
        await tx.submissionActionRun.createMany({
          data: actions.map((action) => ({
            appCode,
            submissionId: submission.id,
            actionId: action.id,
            actionType: action.type,
            actionName: action.name,
            sortOrder: action.sortOrder,
            status: "pending",
            actionSnapshot: {
              id: action.id,
              name: action.name,
              type: action.type,
              sortOrder: action.sortOrder,
              triggerKey: action.triggerKey,
              connectorId: action.connectorId,
              configJson: action.configJson,
            } as Prisma.InputJsonObject,
          })),
        });
      }

      return tx.submission.findUniqueOrThrow({
        where: { id: submission.id },
        include: { actionRuns: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.submission.findUniqueOrThrow({
          where: { id: dto.submissionId },
          include: { actionRuns: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
        });
        return existing;
      }
      throw error;
    }
  }

  private toAccepted(submission: {
    id: string;
    status: "draft" | "pending_sync" | "submitted" | "synced" | "failed";
    actionRuns: Array<{
      id: string;
      submissionId: string;
      actionId: string | null;
      actionName: string;
      actionType: "email_pdf" | "database" | "rest_api";
      status: "pending" | "running" | "success" | "failed" | "skipped";
      attemptCount: number;
    }>;
  }, duplicate: boolean) {
    return {
      submissionId: submission.id,
      status: submission.status,
      duplicate,
      actionRuns: submission.actionRuns.map((run) => ({
        id: run.id,
        submissionId: run.submissionId,
        actionId: run.actionId,
        actionName: run.actionName,
        actionType: run.actionType,
        status: run.status,
        attemptCount: run.attemptCount,
      })),
    };
  }

  private resolveTriggerKey(form: FormDefinition, triggerKey: string | undefined) {
    const normalized = typeof triggerKey === "string" && triggerKey.trim() ? triggerKey.trim() : null;
    if (!normalized) return null;

    const buttonKeys = new Set<string>();
    this.collectButtonKeys(form.root, buttonKeys);
    if (!buttonKeys.has(normalized)) {
      throw new BadRequestException(`triggerKey "${normalized}" does not match a button control.`);
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
}
