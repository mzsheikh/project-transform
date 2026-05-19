"use client";

import { useParams } from "next/navigation";
import { FormDesigner } from "../../../../../../app/designer/FormDesigner";
import { useDraftForm } from "../../../../../../lib/queries";

export default function EditFormPage() {
  const params = useParams<{ appCode?: string; formKey?: string }>();

  const appCodeParam = params?.appCode;
  const formKeyParam = params?.formKey;

  const appCode = Array.isArray(appCodeParam) ? appCodeParam[0] : appCodeParam ?? "";
  const formKey = Array.isArray(formKeyParam) ? formKeyParam[0] : formKeyParam ?? "";

  // Load draft via React Query (internally uses listForms cache)
  const draftQ = useDraftForm(appCode, formKey);

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
      />
    </main>
  );
}
