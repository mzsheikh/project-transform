import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectorsService } from "../connectors/connectors.service";
import { ConnectorFactory } from "../connectors/runtime/connector.factory";
import { DatabaseActionConfig } from "../connectors/runtime/base-connectors";
import { EmailPdfService } from "./runtime/email-pdf.service";
import { readPath, renderJsonTemplate, renderTemplate, setPath, TemplateContext } from "./runtime/template";

type ActionSnapshot = {
  id: string;
  name: string;
  type: "email_pdf" | "database" | "rest_api";
  sortOrder: number;
  triggerKey?: string | null;
  buttonActionId?: string | null;
  connectorId?: string | null;
  configJson: Record<string, unknown>;
};

type RunResult = "success" | "pending" | "failed" | "skipped";

@Injectable()
export class SubmissionActionRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubmissionActionRunnerService.name);
  private readonly processing = new Set<string>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectors: ConnectorsService,
    private readonly factory: ConnectorFactory,
    private readonly emailPdf: EmailPdfService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDue();
    }, 30_000);
    void this.processDue();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  enqueueSubmission(submissionId: string) {
    setImmediate(() => {
      void this.processSubmission(submissionId);
    });
  }

  async processDue() {
    const now = new Date();
    const runs = await this.prisma.submissionActionRun.findMany({
      where: {
        status: "pending",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: [{ createdAt: "asc" }],
      take: 20,
      select: { submissionId: true },
    });
    for (const run of runs) {
      await this.processSubmission(run.submissionId);
    }
  }

  async processSubmission(submissionId: string) {
    if (this.processing.has(submissionId)) return;
    this.processing.add(submissionId);
    try {
      const runs = await this.prisma.submissionActionRun.findMany({
        where: {
          submissionId,
          status: "pending",
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        include: { submission: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      for (const run of runs) {
        const result = await this.processRun(run.id);
        if (result === "failed") {
          await this.skipRemainingRuns(submissionId);
          break;
        }
        if (result !== "success") break;
      }
      await this.recomputeSubmissionStatus(submissionId);
    } finally {
      this.processing.delete(submissionId);
    }
  }

  private async processRun(runId: string): Promise<RunResult> {
    const run = await this.prisma.submissionActionRun.findUnique({
      where: { id: runId },
      include: { submission: true },
    });
    if (!run) return "skipped";
    if (run.status !== "pending") return run.status as RunResult;

    const attemptCount = run.attemptCount + 1;
    await this.prisma.submissionActionRun.update({
      where: { id: run.id },
      data: {
        status: "running",
        attemptCount,
        lastAttemptAt: new Date(),
      },
    });

    try {
      const snapshot = this.readSnapshot(run.actionSnapshot);
      const context: TemplateContext = {
        submissionId: run.submissionId,
        appCode: run.submission.appCode,
        formKey: run.submission.formKey,
        formVersion: run.submission.formVersion,
        data: this.asRecord(run.submission.dataJson),
      };
      const response = await this.execute(snapshot, context);
      await this.prisma.submissionActionRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          responseJson: response as Prisma.InputJsonObject,
          errorJson: Prisma.JsonNull,
          nextAttemptAt: null,
          completedAt: new Date(),
        },
      });
      this.logger.log(`Submission action succeeded: ${run.id}`);
      return "success";
    } catch (error) {
      const finalFailure = attemptCount >= run.maxAttempts;
      const nextAttemptAt = finalFailure ? null : this.nextAttempt(attemptCount);
      await this.prisma.submissionActionRun.update({
        where: { id: run.id },
        data: {
          status: finalFailure ? "failed" : "pending",
          errorJson: this.sanitizeError(error) as Prisma.InputJsonObject,
          nextAttemptAt,
          completedAt: finalFailure ? new Date() : null,
        },
      });
      if (!finalFailure && nextAttemptAt) {
        await this.delayRemainingRuns(run.submissionId, nextAttemptAt);
      }
      this.logger.warn(`Submission action failed: ${run.id}`);
      return finalFailure ? "failed" : "pending";
    }
  }

  private async skipRemainingRuns(submissionId: string) {
    await this.prisma.submissionActionRun.updateMany({
      where: { submissionId, status: "pending" },
      data: {
        status: "skipped",
        completedAt: new Date(),
      },
    });
  }

  private async delayRemainingRuns(submissionId: string, nextAttemptAt: Date) {
    await this.prisma.submissionActionRun.updateMany({
      where: { submissionId, status: "pending", nextAttemptAt: null },
      data: { nextAttemptAt },
    });
  }

  private async execute(snapshot: ActionSnapshot, context: TemplateContext) {
    switch (snapshot.type) {
      case "email_pdf":
        return this.emailPdf.send({ config: snapshot.configJson, context });
      case "database":
        return this.executeDatabase(snapshot, context);
      case "rest_api":
        return this.executeRest(snapshot, context);
      default:
        throw new Error("Unsupported submit action type");
    }
  }

  private async executeDatabase(snapshot: ActionSnapshot, context: TemplateContext) {
    const connectorId = snapshot.connectorId ?? stringValue(snapshot.configJson.connectorId);
    if (!connectorId) throw new Error("Database action requires connectorId");
    const runtime = await this.connectors.runtimeConfig(context.appCode, connectorId);
    const database = this.factory.database(runtime);
    return database.insertSubmission(snapshot.configJson as DatabaseActionConfig, {
      submissionId: context.submissionId,
      appCode: context.appCode,
      formKey: context.formKey,
      formVersion: context.formVersion,
      submittedAt: new Date(),
      data: context.data,
    });
  }

  private async executeRest(snapshot: ActionSnapshot, context: TemplateContext) {
    const connectorId = snapshot.connectorId ?? stringValue(snapshot.configJson.connectorId);
    if (!connectorId) throw new Error("REST action requires connectorId");
    const runtime = await this.connectors.runtimeConfig(context.appCode, connectorId);
    const rest = this.factory.rest(runtime);
    const method = stringValue(snapshot.configJson.method)?.toUpperCase() ?? "POST";
    const path = renderTemplate(stringValue(snapshot.configJson.path), context, "/");
    const headers = this.readStringRecord(snapshot.configJson.headers);
    const body = this.buildRestBody(snapshot.configJson, context);
    return rest.request({ method, path, headers, body });
  }

  private buildRestBody(config: Record<string, unknown>, context: TemplateContext) {
    let body: unknown = undefined;
    if ("bodyTemplate" in config) {
      body = renderJsonTemplate(config.bodyTemplate, context);
    }
    if (Array.isArray(config.fieldMappings)) {
      const mapped = body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
      for (const mapping of config.fieldMappings) {
        if (!mapping || typeof mapping !== "object") continue;
        const sourceKey = stringValue((mapping as Record<string, unknown>).sourceKey);
        const targetPath = stringValue((mapping as Record<string, unknown>).targetPath);
        if (!sourceKey || !targetPath) continue;
        setPath(mapped, targetPath, readPath(context.data, sourceKey));
      }
      body = mapped;
    }
    return body;
  }

  private async recomputeSubmissionStatus(submissionId: string) {
    const runs = await this.prisma.submissionActionRun.findMany({
      where: { submissionId },
      select: { status: true },
    });
    const status =
      runs.length === 0 || runs.every((run) => run.status === "success")
        ? "synced"
        : runs.some((run) => run.status === "failed")
          ? "failed"
          : "pending_sync";
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status },
    });
  }

  private readSnapshot(value: Prisma.JsonValue): ActionSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Action snapshot is invalid");
    }
    const record = value as Record<string, unknown>;
    const type = record.type;
    if (type !== "email_pdf" && type !== "database" && type !== "rest_api") {
      throw new Error("Action snapshot type is invalid");
    }
    return {
      id: String(record.id ?? ""),
      name: String(record.name ?? "Submit action"),
      type,
      sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : 0,
      triggerKey: typeof record.triggerKey === "string" ? record.triggerKey : null,
      buttonActionId: typeof record.buttonActionId === "string" ? record.buttonActionId : null,
      connectorId: typeof record.connectorId === "string" ? record.connectorId : null,
      configJson: this.asRecord(record.configJson as Prisma.JsonValue),
    };
  }

  private readStringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }

  private asRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private sanitizeError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : "Unknown action failure",
      name: error instanceof Error ? error.name : "Error",
    };
  }

  private nextAttempt(attemptCount: number) {
    return new Date(Date.now() + Math.min(60_000, 2 ** attemptCount * 5_000));
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
