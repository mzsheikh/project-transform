"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { FormDto } from "../../../lib/api";
import { InlinePublishButton } from "../../../components/InlinePublishButton";
import { qk, useDeleteForm, useForms } from "../../../lib/queries";
import { useQueryClient } from "@tanstack/react-query";

type Row = {
  formKey: string;
  draft?: FormDto;
  published?: FormDto;
};

function buildRows(forms: FormDto[]): Row[] {
  const map = new Map<string, Row>();

  for (const f of forms) {
    const key = f.formKey;
    if (!map.has(key)) map.set(key, { formKey: key });
    const row = map.get(key)!;

    if (f.status === "draft" && f.version === 0) {
      if (!row.draft) row.draft = f;
      else if (new Date(f.createdAt).getTime() > new Date(row.draft.createdAt).getTime()) row.draft = f;
    }

    if (f.status === "published") {
      if (!row.published) row.published = f;
      else if (f.version > row.published.version) row.published = f;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.formKey.localeCompare(b.formKey));
}

export default function AppPage() {
  const routeParams = useParams<{ appCode?: string }>();
  const appCodeParam = routeParams?.appCode;
  const appCode = Array.isArray(appCodeParam) ? appCodeParam[0] : appCodeParam ?? "";

  const { data: forms = [], isLoading, error } = useForms(appCode);
  const deleteForm = useDeleteForm(appCode);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreatingFromPdf, setIsCreatingFromPdf] = useState(false);
  const rows = useMemo(() => buildRows(forms), [forms]);
  const transformBase = process.env.NEXT_PUBLIC_TRANSFORM_AI_BASE_URL ?? "http://localhost:8001";

  async function handlePdfSelected(file: File) {
    if (!appCode) return;

    const inferredTitle = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    const title = inferredTitle || "Untitled Form";
    const formKey = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    setIsCreatingFromPdf(true);
    try {
      const formData = new FormData();
      formData.append("appCode", appCode);
      formData.append("title", title);
      formData.append("file", file, file.name);

      const ingestRes = await fetch(`${transformBase}/ingest/pdf/upload`, {
        method: "POST",
        body: formData,
      });
      if (!ingestRes.ok) {
        const text = await ingestRes.text().catch(() => "");
        throw new Error(`Ingest failed (${ingestRes.status}): ${text}`);
      }

      const generateRes = await fetch(`${transformBase}/generate/form-draft-and-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appCode,
          query: title,
          topK: 20,
          title: `${title} (AI)`,
          formKey: formKey || "untitled_form",
        }),
      });
      if (!generateRes.ok) {
        const text = await generateRes.text().catch(() => "");
        throw new Error(`Generate failed (${generateRes.status}): ${text}`);
      }

      qc.invalidateQueries({ queryKey: qk.forms(appCode) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create form from PDF.";
      window.alert(message);
    } finally {
      setIsCreatingFromPdf(false);
    }
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>Forms Workspace</div>
          <h1 style={heroTitle}>{appCode || "App"}</h1>
        </div>

        <div style={toolbar}>
          {appCode ? (
            <>
              <Link
                href={`/apps/${appCode}/forms/new`}
                style={iconAction}
                title="Create draft form"
                aria-label="Create draft form"
              >
                <PlusIcon />
              </Link>
              <button
                type="button"
                style={iconButton}
                title={isCreatingFromPdf ? "Creating from PDF..." : "Create from PDF"}
                aria-label={isCreatingFromPdf ? "Creating from PDF..." : "Create from PDF"}
                disabled={isCreatingFromPdf}
                onClick={() => fileInputRef.current?.click()}
              >
                <PdfIcon />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void handlePdfSelected(file);
                }}
              />
            </>
          ) : null}
        </div>
      </section>

      {isLoading ? <p>Loading…</p> : null}
      {error ? <p style={{ color: "crimson" }}>{(error as Error).message}</p> : null}

      <section style={section}>
        <div style={tableHeader}>
          <div>Form</div>
          <div style={{ textAlign: "right" }}>Versions</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        <div style={listShell}>
          <div style={listWrap}>
          {rows.map((row) => (
            <article key={row.formKey} style={rowCard}>
              <div>
                <div style={formKeyLabel}>
                  {row.draft?.title ?? row.published?.title ?? "Untitled form"}{" "}
                  <span style={formKeyInline}>({row.formKey})</span>
                </div>
              </div>

              <section style={infoCell}>
                <div style={cardMeta}>
                  draft: {row.draft ? `v${row.draft.version}` : "-"}{" "}
                  <span style={versionSpacer}>|</span>{" "}
                  published: {row.published ? `v${row.published.version}` : "-"}
                </div>
              </section>

              <div style={actions}>
                {row.draft ? (
                  <Link
                    href={`/apps/${appCode}/forms/${row.formKey}/edit`}
                    style={iconAction}
                    title="Edit draft"
                    aria-label="Edit draft"
                  >
                    <EditIcon />
                  </Link>
                ) : (
                  <Link
                    href={`/apps/${appCode}/forms/new`}
                    style={iconAction}
                    title="Create draft"
                    aria-label="Create draft"
                  >
                    <DraftIcon />
                  </Link>
                )}

                {row.draft ? <InlinePublishButton appCode={appCode} formKey={row.formKey} /> : null}

                <button
                  type="button"
                  style={dangerIconButton}
                  title="Delete form"
                  aria-label="Delete form"
                  disabled={deleteForm.isPending}
                  onClick={() => {
                    if (!appCode) return;
                    const ok = window.confirm(`Delete form "${row.formKey}"? This removes all versions.`);
                    if (!ok) return;
                    deleteForm.mutate({ formKey: row.formKey });
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            </article>
          ))}
          </div>
        </div>

      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  padding: 24,
  fontFamily: "system-ui",
  background: "#fff",
  color: "#111",
  minHeight: "100vh",
};

const hero: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  color: "#667085",
  fontWeight: 700,
  marginBottom: 8,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
};

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const section: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  gap: 14,
  padding: "0 8px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#667085",
  fontWeight: 700,
};

const listShell: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 18,
  background: "#fcfcfd",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
  overflow: "hidden",
  padding: "4px 0",
};

const listWrap: React.CSSProperties = {
  display: "grid",
};

const rowCard: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  gap: 14,
  alignItems: "center",
  padding: "16px 18px",
  background: "transparent",
};

const formKeyLabel: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1.3,
};

const formKeyInline: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: "#667085",
};

const actions: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const infoCell: React.CSSProperties = {
  justifySelf: "end",
  textAlign: "right",
};

const cardMeta: React.CSSProperties = {
  fontSize: 18,
  color: "#475467",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const iconAction: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #d0d5dd",
  background: "#fff",
  color: "#111",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
  flexShrink: 0,
};

const iconButton: React.CSSProperties = {
  ...iconAction,
  cursor: "pointer",
};

const dangerIconButton: React.CSSProperties = {
  ...iconButton,
  color: "#b42318",
  border: "1px solid #f0c7c2",
};

const iconBase: React.CSSProperties = {
  width: 18,
  height: 18,
  display: "block",
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const versionSpacer: React.CSSProperties = {
  color: "#98a2b3",
};

function PdfIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M4 2h5l3 3v9H4z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M5.2 11V8.9h1.1c.67 0 1.08.39 1.08 1.03 0 .63-.41 1.07-1.08 1.07H5.2zM8.35 11V8.9h.86c.85 0 1.36.39 1.36 1.05 0 .67-.51 1.05-1.36 1.05h-.86zM12.1 8.9h-1.85V11"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M3 11l7-7 2 2-7 7H3v-2z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M9 3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M4 2h5l3 3v9H4z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M3 4h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 4v-1h4v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 4l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}
