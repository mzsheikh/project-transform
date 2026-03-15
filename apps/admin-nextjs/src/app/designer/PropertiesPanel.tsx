/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { Node } from "@transform/contracts/form-types";
import { isControl, isLayout } from "./types";

export function PropertiesPanel({
  node,
  onChange,
}: {
  node: Node | null;
  onChange: (patch: Partial<any>) => void;
}) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff", color: "#111" }}>
      <h3 style={{ margin: "0 0 10px" }}>Properties</h3>

      {!node ? <div style={{ opacity: 0.85 }}>Select a node…</div> : null}

      {node && isLayout(node) ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Layout: {node.layoutType}</div>

          {node.layoutType === "section" ? (
            <label style={label}>
              Section Label
              <input
                style={input}
                value={(node as any).label ?? ""}
                onChange={(e) => onChange({ label: e.target.value })}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {node && isControl(node) ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Control: {node.controlType}</div>

          <label style={label}>
            Label
            <input style={input} value={node.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
          </label>

          <label style={label}>
            Key
            <input style={input} value={node.key} onChange={(e) => onChange({ key: e.target.value })} />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!!node.validation?.required}
              onChange={(e) => onChange({ validation: { ...(node.validation ?? {}), required: e.target.checked } })}
            />
            Required
          </label>

          {(node.controlType === "text" || node.controlType === "number" || node.controlType === "date") ? (
            <label style={label}>
              Placeholder (props.placeholder)
              <input
                style={input}
                value={(node.props as any)?.placeholder ?? ""}
                onChange={(e) => onChange({ props: { ...(node.props as any), placeholder: e.target.value } })}
              />
            </label>
          ) : null}

          {(node.controlType === "dropdown" || node.controlType === "multiselect") ? (
            <label style={label}>
              Options (one per line: label=value)
              <textarea
                style={{ ...input, height: 120 }}
                value={((node.props as any)?.options ?? [])
                  .map((o: any) => `${o.label}=${o.value}`)
                  .join("\n")}
                onChange={(e) => {
                  const options = e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [label, value] = line.split("=");
                      return { label: (label ?? "").trim(), value: (value ?? "").trim() };
                    })
                    .filter((o) => o.label && o.value);
                  onChange({ props: { ...(node.props as any), options } });
                }}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const label: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 600 };
const input: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ddd",
  fontFamily: "system-ui",
};
