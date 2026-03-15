/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../lib/api";

export default function NewFormPage() {
  const params = useParams<{ appCode?: string }>();
  const appCodeParam = params?.appCode;
  const appCode = Array.isArray(appCodeParam) ? appCodeParam[0] : appCodeParam ?? "";
  const router = useRouter();

  const [formKey, setFormKey] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!appCode) {
      setError("Missing appCode in route.");
      return;
    }

    const schemaJson = {
      schemaVersion: "1.0",
      formKey,
      title,
      version: 1,
      status: "draft",
      root: { type: "layout", layoutType: "stack", id: "root", children: [] },
    };

    try {
      await api.createDraftForm(appCode, { formKey, title, schemaJson });
      router.push(`/apps/${appCode}`);
    } catch (err: any) {
      setError(err.message ?? "Failed");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 640 }}>
      <h1>Create Draft Form</h1>
      <p>App: {appCode || "—"}</p>

      <form onSubmit={onCreate} style={{ display: "grid", gap: 12 }}>
        <label>
          formKey
          <input value={formKey} onChange={(e) => setFormKey(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          title
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        <button style={{ padding: 10 }}>Create Draft</button>
      </form>
    </main>
  );
}
