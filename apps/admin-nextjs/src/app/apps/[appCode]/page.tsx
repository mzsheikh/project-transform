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
        <main style={{ padding: 24, fontFamily: "system-ui", background: "#fff", color: "#111", minHeight: "100vh" }}>
      <h1>App: {appCode || "—"}</h1>

      {isLoading ? <p>Loading…</p> : null}
      {error ? <p style={{ color: "crimson" }}>{(error as Error).message}</p> : null}

      <p>
        {appCode ? (
          <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
            <Link href={`/apps/${appCode}/forms/new`}>+ Create Draft Form</Link>
            <button
              type="button"
              style={secondaryBtn}
              disabled={isCreatingFromPdf}
              onClick={() => fileInputRef.current?.click()}
            >
              + Create from PDF
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
          </span>
        ) : (
          <span style={{ opacity: 0.6 }}>+ Create Draft Form</span>
        )}
      </p>

      <h2>Forms</h2>
      <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>formKey</th>
            <th>Draft</th>
            <th>Latest Published</th>
                        <th style={{ textAlign: "right" }}></th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.formKey} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ verticalAlign: "top" }}>
                <b>{r.formKey}</b>
              </td>

              <td style={{ verticalAlign: "top" }}>
                {r.draft ? (
                  <>
                    <div>{r.draft.title}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      v{r.draft.version} • {r.draft.status}
                    </div>
                                    </>
                                ) : (
                                    <span style={{ opacity: 0.7 }}>—</span>
                                )}
              </td>

              <td style={{ verticalAlign: "top" }}>
                {r.published ? (
                  <>
                    <div>{r.published.title}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      v{r.published.version} • published
                    </div>
                  </>
                ) : (
                  <span style={{ opacity: 0.7 }}>—</span>
                )}
              </td>

                            <td style={{ verticalAlign: "top", textAlign: "right" }}>
                                {r.draft ? (
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                                        <Link href={`/apps/${appCode}/forms/${r.formKey}/edit`} style={actionBtn}>
                                            <span style={actionContent}>
                                                <EditIcon />
                                                Edit Draft
                                            </span>
                                        </Link>
                                        <InlinePublishButton appCode={appCode} formKey={r.formKey} />
                                        <button
                                            type="button"
                                            style={deleteBtn}
                                            disabled={deleteForm.isPending}
                                            onClick={() => {
                                                if (!appCode) return;
                                                const ok = window.confirm(
                                                    `Delete form "${r.formKey}"? This removes all versions.`
                                                );
                                                if (!ok) return;
                                                deleteForm.mutate({ formKey: r.formKey });
                                            }}
                                        >
                                            <span style={actionContent}>
                                                <TrashIcon />
                                                Delete
                                            </span>
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                                        <Link href={`/apps/${appCode}/forms/new`} style={actionBtn}>
                                            <span style={actionContent}>
                                                <DraftIcon />
                                                Create Draft
                                            </span>
                                        </Link>
                                        <button
                                            type="button"
                                            style={deleteBtn}
                                            disabled={deleteForm.isPending}
                                            onClick={() => {
                                                if (!appCode) return;
                                                const ok = window.confirm(
                                                    `Delete form "${r.formKey}"? This removes all versions.`
                                                );
                                                if (!ok) return;
                                                deleteForm.mutate({ formKey: r.formKey });
                                            }}
                                        >
                                            <span style={actionContent}>
                                                <TrashIcon />
                                                Delete
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
        </tbody>
      </table>

      <p style={{ marginTop: 16, opacity: 0.8 }}>
        Showing per formKey: Draft (version 0) + Latest Published (highest version).
      </p>
    </main>
  );
}

const actionBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#fff",
    color: "#111",
    fontWeight: 700,
    textDecoration: "none",
    width: 130,
};

const deleteBtn: React.CSSProperties = {
    ...actionBtn,
    borderColor: "#b42318",
    color: "#b42318",
};

const secondaryBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #111",
    background: "#f6f6f6",
    color: "#111",
    fontWeight: 600,
};

const actionContent: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
};

const iconBase: React.CSSProperties = {
    width: 14,
    height: 14,
    display: "block",
};

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
