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
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #111",
          background: "#fff",
          color: "#111",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700,
          width: 130,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <PublishIcon />
          {loading ? "Publishing..." : "Publish"}
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
