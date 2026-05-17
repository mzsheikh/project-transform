/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FormDesigner } from "../../../../../../app/designer/FormDesigner";
import { useDraftForm, useSaveDraft } from "../../../../../../lib/queries";

export default function EditFormPage() {
  const params = useParams<{ appCode?: string; formKey?: string }>();

  const appCodeParam = params?.appCode;
  const formKeyParam = params?.formKey;

  const appCode = Array.isArray(appCodeParam) ? appCodeParam[0] : appCodeParam ?? "";
  const formKey = Array.isArray(formKeyParam) ? formKeyParam[0] : formKeyParam ?? "";

  const [status, setStatus] = useState<string>("");

  // Load draft via React Query (internally uses listForms cache)
  const draftQ = useDraftForm(appCode, formKey);

  // Save draft mutation
  const saveM = useSaveDraft(appCode, formKey);

  // Clear status message after a bit (like before)
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const mainStyle: React.CSSProperties = {
    padding: 24,
    fontFamily: "system-ui",
    background: "#fff",
    color: "#111",
    minHeight: "100vh",
  };

  if (!appCode || !formKey) {
    return (
      <main style={mainStyle}>
        <h1>Edit Draft</h1>
        <p>Missing appCode or formKey in route.</p>
      </main>
    );
  }

  if (draftQ.isLoading) {
    return (
      <main style={mainStyle}>
        <h1>Edit Draft</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (draftQ.isError) {
    return (
      <main style={mainStyle}>
        <h1>Edit Draft</h1>
        <p style={{ color: "crimson" }}>
          {(draftQ.error as Error).message ?? "Failed to load draft"}
        </p>
      </main>
    );
  }

  const form = draftQ.data;

  if (!form) {
    return (
      <main style={mainStyle}>
        <h1>Edit Draft</h1>
        <p>Draft not found. Create a draft first.</p>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <FormDesigner
        appCode={appCode}
        formKey={formKey}
        initialSchema={form.schemaJson}
        // IMPORTANT: now saving is powered by React Query mutation
        onSaved={async (schema) => {
          setStatus("");
          try {
            await saveM.mutateAsync({ schemaJson: schema });
            setStatus("Saved ✅");
            // no need to setForm manually; invalidation keeps cache fresh
          } catch (e: any) {
            setStatus(`Error: ${e.message ?? "save failed"}`);
          }
        }}
      />

      {/* Optional: show mutation state */}
      {saveM.isPending ? <p style={{ marginTop: 12, opacity: 0.9 }}>Saving…</p> : null}

      {status ? <p style={{ marginTop: 12 }}>{status}</p> : null}
    </main>
  );
}
