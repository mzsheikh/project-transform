/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function NewAppPage() {
  const [appCode, setAppCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.createApp({ appCode, name });
      router.push(`/apps/${created.appCode}`);
    } catch (err: any) {
      setError(err.message ?? "Failed");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
      <h1>Create App</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          App Code
          <input value={appCode} onChange={(e) => setAppCode(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

        <button style={{ padding: 10 }}>Create</button>
      </form>
    </main>
  );
}