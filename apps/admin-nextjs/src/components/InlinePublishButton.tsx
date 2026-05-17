/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { usePublish } from "../lib/queries";

export function InlinePublishButton({
  appCode,
  formKey,
}: {
  appCode: string;
  formKey: string;
}) {
  const [msg, setMsg] = useState<string>("");

  const publish = usePublish(appCode, formKey);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  async function onPublish() {
    setMsg("");
    try {
      const published = await publish.mutateAsync();
      setMsg(`Published v${published.version} ✅`);
    } catch (e: any) {
      setMsg(`Error: ${e.message ?? "publish failed"}`);
    }
  }

  const loading = publish.isPending;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        onClick={onPublish}
        disabled={loading}
        title={loading ? "Publishing..." : "Publish draft"}
        aria-label={loading ? "Publishing..." : "Publish draft"}
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          border: "1px solid #d0d5dd",
          background: "#fff",
          color: "#111",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <PublishIcon />
        </span>
      </button>

      {msg ? <span style={{ fontSize: 12, opacity: 0.8 }}>{msg}</span> : null}
    </div>
  );
}

const iconBase: React.CSSProperties = {
  width: 14,
  height: 14,
  display: "block",
};

function PublishIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M8 2l4 4H9v5H7V6H4l4-4z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
