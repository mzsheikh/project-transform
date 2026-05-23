/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../lib/api";

function normalizeFormKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const defaultSubmitButtonKey = "submitButton";

const defaultEmailPdfActionConfig = {
  to: ["operations@example.com"],
  cc: [],
  bcc: [],
  subjectTemplate: "{{formKey}} submission {{submissionId}}",
  bodyTemplate: "A new {{formKey}} submission was received.",
  includeJson: true,
};

function createDefaultSchema(formKey: string, title: string) {
  return {
    schemaVersion: "1.2",
    formKey,
    title,
    version: 1,
    status: "draft",
    root: {
      type: "layout",
      layoutType: "stack",
      id: "root",
      children: [
        {
          id: "save_draft_button",
          type: "control",
          controlType: "button",
          key: "saveDraftButton",
          label: "Save Draft",
          props: {
            text: "Save Draft",
            variant: "secondary",
            actions: [{ id: "save_draft", type: "save_draft" }],
          },
        },
        {
          id: "submit_button",
          type: "control",
          controlType: "button",
          key: defaultSubmitButtonKey,
          label: "Submit",
          props: {
            text: "Submit",
            variant: "primary",
            actions: [{ id: "submit", type: "submit", clearDraftOnSuccess: true }],
          },
        },
      ],
    },
  };
}

export default function NewFormPage() {
  const params = useParams<{ appCode?: string }>();
  const appCodeParam = params?.appCode;
  const appCode = Array.isArray(appCodeParam) ? appCodeParam[0] : appCodeParam ?? "";
  const router = useRouter();

  const [formKey, setFormKey] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ formKey?: string; title?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(nextFormKey: string, nextTitle: string) {
    const nextErrors: { formKey?: string; title?: string } = {};

    if (!nextFormKey.trim()) {
      nextErrors.formKey = "Form key is required.";
    } else if (!/^[a-z0-9_]+$/.test(nextFormKey.trim())) {
      nextErrors.formKey = "Use lowercase letters, numbers, and underscores only.";
    }

    if (!nextTitle.trim()) {
      nextErrors.title = "Form title is required.";
    }

    return nextErrors;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!appCode) {
      setError("Missing appCode in route.");
      return;
    }

    const cleanedFormKey = normalizeFormKey(formKey);
    const cleanedTitle = title.trim();
    const nextErrors = validate(cleanedFormKey, cleanedTitle);

    setFormKey(cleanedFormKey);
    setTitle(cleanedTitle);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    const schemaJson = createDefaultSchema(cleanedFormKey, cleanedTitle);

    setIsSubmitting(true);
    try {
      await api.createDraftForm(appCode, { formKey: cleanedFormKey, title: cleanedTitle, schemaJson });
      await api.createSubmitAction(appCode, cleanedFormKey, {
        type: "email_pdf",
        name: "Email PDF",
        enabled: true,
        sortOrder: 0,
        triggerKey: defaultSubmitButtonKey,
        connectorId: null,
        configJson: defaultEmailPdfActionConfig,
      });
      router.push(`/apps/${appCode}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create draft form.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div style={eyebrow}>Form Setup</div>
        <h1 style={titleStyle}>Create a new draft form</h1>
        <p style={subtitle}>Start with the form identity first. You can design the fields and layout right after creation.</p>
      </section>

      <div style={shell}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <div style={cardTitle}>Form details</div>
              <div style={cardDescription}>This draft will be created under app <b>{appCode || "—"}</b> and opened from the forms list.</div>
            </div>
            <div style={badge}>Draft v0</div>
          </div>

          <form onSubmit={onCreate} style={form}>
            <div style={fieldGrid}>
              <label style={field}>
                <span style={labelRow}>
                  Form key
                  <span style={required}>Required</span>
                </span>
                <input
                  value={formKey}
                  onChange={(e) => {
                    setFormKey(normalizeFormKey(e.target.value));
                    if (fieldErrors.formKey) {
                      setFieldErrors((prev) => ({ ...prev, formKey: undefined }));
                    }
                  }}
                  placeholder="inspection_form"
                  style={fieldErrors.formKey ? inputError : input}
                  aria-invalid={!!fieldErrors.formKey}
                />
                <span style={hint}>Stable identifier used in URLs, publishing, and submissions. Example: `patient_assessment_form`.</span>
                {fieldErrors.formKey ? <span style={errorText}>{fieldErrors.formKey}</span> : null}
              </label>

              <label style={field}>
                <span style={labelRow}>
                  Form title
                  <span style={required}>Required</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => ({ ...prev, title: undefined }));
                    }
                  }}
                  placeholder="Inspection Form"
                  style={fieldErrors.title ? inputError : input}
                  aria-invalid={!!fieldErrors.title}
                />
                <span style={hint}>Human-readable title shown to admins and end users.</span>
                {fieldErrors.title ? <span style={errorText}>{fieldErrors.title}</span> : null}
              </label>
            </div>

            <div style={previewBox}>
              <div style={previewLabel}>Preview</div>
              <div style={previewTitle}>{title.trim() || "Your form title"}</div>
              <div style={previewMeta}>
                app: {appCode || "APP"} / form: {formKey.trim() || "form_key"} / status: draft
              </div>
            </div>

            {error ? <div style={errorBanner}>{error}</div> : null}

            <div style={actions}>
              <Link href={appCode ? `/apps/${appCode}` : "/apps"} style={secondaryAction}>
                Cancel
              </Link>
              <button type="submit" style={primaryAction} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create draft"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "linear-gradient(180deg, #fcfcfd 0%, #f8fafc 100%)",
  color: "#101828",
  fontFamily: "system-ui",
};

const hero: React.CSSProperties = {
  maxWidth: 760,
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#667085",
  fontWeight: 700,
  marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 36,
  lineHeight: 1.1,
  fontWeight: 800,
};

const subtitle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 16,
  lineHeight: 1.6,
  color: "#667085",
  maxWidth: 620,
};

const shell: React.CSSProperties = {
  maxWidth: 760,
};

const card: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 24,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(16, 24, 40, 0.06)",
  padding: 24,
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 24,
};

const cardTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 6,
};

const cardDescription: React.CSSProperties = {
  fontSize: 14,
  color: "#667085",
  maxWidth: 520,
  lineHeight: 1.5,
};

const badge: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e4e7ec",
  background: "#f9fafb",
  fontSize: 12,
  color: "#475467",
  fontWeight: 700,
  flexShrink: 0,
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const fieldGrid: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  fontWeight: 700,
};

const required: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "#f2f4f7",
  color: "#667085",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #d0d5dd",
  background: "#fff",
  color: "#101828",
  fontSize: 16,
  outline: "none",
};

const inputError: React.CSSProperties = {
  ...input,
  border: "1px solid #f04438",
  boxShadow: "0 0 0 3px rgba(240, 68, 56, 0.12)",
};

const hint: React.CSSProperties = {
  fontSize: 13,
  color: "#667085",
  lineHeight: 1.5,
};

const errorText: React.CSSProperties = {
  fontSize: 13,
  color: "#d92d20",
  fontWeight: 600,
};

const previewBox: React.CSSProperties = {
  border: "1px solid #e4e7ec",
  borderRadius: 18,
  padding: 18,
  background: "linear-gradient(180deg, #f8fafc 0%, #f9fafb 100%)",
  display: "grid",
  gap: 6,
};

const previewLabel: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#667085",
  fontWeight: 700,
};

const previewTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.2,
};

const previewMeta: React.CSSProperties = {
  fontSize: 14,
  color: "#667085",
};

const errorBanner: React.CSSProperties = {
  border: "1px solid #fecdca",
  background: "#fef3f2",
  color: "#b42318",
  borderRadius: 16,
  padding: "14px 16px",
  fontSize: 14,
  lineHeight: 1.5,
};

const actions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 8,
};

const secondaryAction: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 112,
  height: 48,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid #d0d5dd",
  background: "#fff",
  color: "#344054",
  textDecoration: "none",
  fontWeight: 700,
};

const primaryAction: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 140,
  height: 48,
  padding: "0 20px",
  borderRadius: 14,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};
