/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

function normalizeAppCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function NewAppPage() {
  const [appCode, setAppCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ appCode?: string; name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  function validate(nextAppCode: string, nextName: string) {
    const nextErrors: { appCode?: string; name?: string } = {};

    if (!nextAppCode.trim()) {
      nextErrors.appCode = "App code is required.";
    } else if (!/^[A-Z0-9_]+$/.test(nextAppCode.trim())) {
      nextErrors.appCode = "Use uppercase letters, numbers, and underscores only.";
    }

    if (!nextName.trim()) {
      nextErrors.name = "App name is required.";
    }

    return nextErrors;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanedCode = normalizeAppCode(appCode);
    const cleanedName = name.trim();
    const nextErrors = validate(cleanedCode, cleanedName);

    setAppCode(cleanedCode);
    setName(cleanedName);
    setFieldErrors(nextErrors);
    setError(null);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const created = await api.createApp({ appCode: cleanedCode, name: cleanedName });
      router.push(`/apps/${created.appCode}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create app.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div style={eyebrow}>App Setup</div>
        <h1 style={title}>Create a new app</h1>
        <p style={subtitle}>Set up the app identity first. You can add forms and workflows right after this step.</p>
      </section>

      <div style={shell}>
        <section style={card}>
          <div style={cardHeader}>
            <div>
              <div style={cardTitle}>App details</div>
              <div style={cardDescription}>Choose a stable app code and a clear display name for your team.</div>
            </div>
            <div style={badge}>2 fields</div>
          </div>

          <form onSubmit={onSubmit} style={form}>
            <div style={fieldGrid}>
              <label style={field}>
                <span style={labelRow}>
                  App code
                  <span style={required}>Required</span>
                </span>
                <input
                  value={appCode}
                  onChange={(e) => {
                    setAppCode(normalizeAppCode(e.target.value));
                    if (fieldErrors.appCode) {
                      setFieldErrors((prev) => ({ ...prev, appCode: undefined }));
                    }
                  }}
                  placeholder="DEMO001"
                  style={fieldErrors.appCode ? inputError : input}
                  aria-invalid={!!fieldErrors.appCode}
                />
                <span style={hint}>Used in URLs and integrations. Example: `DEMO001`, `HR_PORTAL`.</span>
                {fieldErrors.appCode ? <span style={errorText}>{fieldErrors.appCode}</span> : null}
              </label>

              <label style={field}>
                <span style={labelRow}>
                  App name
                  <span style={required}>Required</span>
                </span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="HR Performance"
                  style={fieldErrors.name ? inputError : input}
                  aria-invalid={!!fieldErrors.name}
                />
                <span style={hint}>Shown throughout the admin UI as the human-friendly app label.</span>
                {fieldErrors.name ? <span style={errorText}>{fieldErrors.name}</span> : null}
              </label>
            </div>

            <div style={previewBox}>
              <div style={previewLabel}>Preview</div>
              <div style={previewTitle}>{name.trim() || "Your app name"}</div>
              <div style={previewMeta}>/{appCode.trim() || "APP_CODE"}</div>
            </div>

            {error ? <div style={errorBanner}>{error}</div> : null}

            <div style={actions}>
              <Link href="/apps" style={secondaryAction}>
                Cancel
              </Link>
              <button type="submit" style={primaryAction} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create app"}
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

const title: React.CSSProperties = {
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
