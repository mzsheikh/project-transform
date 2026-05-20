import { Injectable } from "@nestjs/common";
import { TemplateContext, renderTemplate } from "./template";

type EmailPdfConfig = {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subjectTemplate?: unknown;
  bodyTemplate?: unknown;
  includeJson?: unknown;
};

type SendEmailInput = {
  config: EmailPdfConfig;
  context: TemplateContext;
};

function loadOptionalModule(name: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(name);
  } catch {
    throw new Error(`Missing optional email dependency: ${name}`);
  }
}

@Injectable()
export class EmailPdfService {
  async send(input: SendEmailInput): Promise<Record<string, unknown>> {
    const to = this.readRecipients(input.config.to, "to");
    const cc = this.readRecipients(input.config.cc, "cc", false);
    const bcc = this.readRecipients(input.config.bcc, "bcc", false);
    const subject = renderTemplate(
      typeof input.config.subjectTemplate === "string" ? input.config.subjectTemplate : undefined,
      input.context,
      `Form submission ${input.context.formKey}`,
    );
    const text = renderTemplate(
      typeof input.config.bodyTemplate === "string" ? input.config.bodyTemplate : undefined,
      input.context,
      `Submission ${input.context.submissionId} was received.`,
    );
    const attachment = await this.generatePdf(input.context, input.config.includeJson !== false);

    if ((process.env.EMAIL_DELIVERY_MODE ?? "dry_run") !== "smtp") {
      return {
        dryRun: true,
        to,
        cc,
        bcc,
        subject,
        attachmentBytes: attachment.length,
      };
    }

    const nodemailer = loadOptionalModule("nodemailer");
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error("SMTP_HOST is required when EMAIL_DELIVERY_MODE=smtp");

    const transporter = nodemailer.createTransport({
      host,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      cc,
      bcc,
      subject,
      text,
      attachments: [
        {
          filename: `${input.context.formKey}-${input.context.submissionId}.pdf`,
          content: attachment,
          contentType: "application/pdf",
        },
      ],
    });

    return {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    };
  }

  private async generatePdf(context: TemplateContext, includeJson: boolean): Promise<Buffer> {
    const PDFDocument = loadOptionalModule("pdfkit");
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    doc.fontSize(18).text("Form Submission", { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`App: ${context.appCode}`);
    doc.text(`Form: ${context.formKey} v${context.formVersion}`);
    doc.text(`Submission: ${context.submissionId}`);
    doc.moveDown();

    for (const [key, value] of Object.entries(context.data)) {
      doc.fontSize(10).text(`${key}: ${formatPdfValue(value)}`);
    }

    if (includeJson) {
      doc.addPage();
      doc.fontSize(14).text("Raw submission data");
      doc.moveDown();
      doc.fontSize(8).text(JSON.stringify(context.data, null, 2));
    }

    doc.end();
    return done;
  }

  private readRecipients(value: unknown, label: string, required = true): string[] {
    const recipients = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    const cleaned = recipients
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (required && cleaned.length === 0) throw new Error(`Email action requires at least one ${label} recipient`);
    const invalid = cleaned.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalid) throw new Error(`Invalid ${label} email recipient: ${invalid}`);
    return cleaned;
  }
}

function formatPdfValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
