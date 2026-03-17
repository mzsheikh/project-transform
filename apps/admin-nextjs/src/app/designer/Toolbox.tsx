/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { DragEvent, ReactNode } from "react";
import type { ControlNode, LayoutNode } from "@transform/contracts/form-types";

export type ToolboxItem =
  | { kind: "layout"; layoutType: LayoutNode["layoutType"] }
  | { kind: "control"; controlType: ControlNode["controlType"] };

type ToolboxEntry = {
  label: string;
  item: ToolboxItem;
  icon: ReactNode;
};

const LAYOUTS: ToolboxEntry[] = [
  { label: "Stack", item: { kind: "layout", layoutType: "stack" }, icon: <StackIcon /> },
  { label: "Row", item: { kind: "layout", layoutType: "row" }, icon: <RowIcon /> },
];

const CONTROLS: ToolboxEntry[] = [
  { label: "Text", item: { kind: "control", controlType: "text" }, icon: <TextIcon /> },
  { label: "Number", item: { kind: "control", controlType: "number" }, icon: <NumberIcon /> },
  { label: "Switch", item: { kind: "control", controlType: "switch" }, icon: <SwitchIcon /> },
  { label: "Dropdown", item: { kind: "control", controlType: "dropdown" }, icon: <DropdownIcon /> },
  { label: "Multi Select", item: { kind: "control", controlType: "multiselect" }, icon: <MultiSelectIcon /> },
  { label: "Date", item: { kind: "control", controlType: "date" }, icon: <DateIcon /> },
  { label: "Signature", item: { kind: "control", controlType: "signature" }, icon: <SignatureIcon /> },
  { label: "File", item: { kind: "control", controlType: "file" }, icon: <FileIcon /> },
];

export function Toolbox({ onAdd }: { onAdd: (item: ToolboxItem) => void }) {
  function dragStart(item: ToolboxItem) {
    return (event: DragEvent<HTMLButtonElement>) => {
      const payload = JSON.stringify(item);
      event.dataTransfer.setData("application/x-form-designer-item", payload);
      event.dataTransfer.setData("text/plain", payload);
      event.dataTransfer.effectAllowed = "copy";
    };
  }

  return (
    <aside style={panel}>
      <h3 style={h3}>Toolbox</h3>

      <div style={section}>
        <div style={label}>Layouts</div>
        <div style={grid}>
          {LAYOUTS.map((x) => (
            <button
              key={x.label}
              style={btn}
              draggable
              onDragStart={dragStart(x.item)}
              onClick={() => onAdd(x.item)}
            >
              <span style={btnContent}>
                <span style={iconWrap}>{x.icon}</span>
                <span style={btnLabel}>{x.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={label}>Controls</div>
        <div style={grid}>
          {CONTROLS.map((x) => (
            <button
              key={x.label}
              style={btn}
              draggable
              onDragStart={dragStart(x.item)}
              onClick={() => onAdd(x.item)}
            >
              <span style={btnContent}>
                <span style={iconWrap}>{x.icon}</span>
                <span style={btnLabel}>{x.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 12, opacity: 0.85, marginTop: 12 }}>
        Tip: click to add at selected layout. Drag to drop at a specific position in the canvas.
      </p>
    </aside>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
  color: "#111",
};

const h3: React.CSSProperties = {
  margin: 0,
  marginBottom: 10,
  fontSize: 16,
};

const section: React.CSSProperties = {
  marginTop: 10,
};

const label: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.9,
  marginBottom: 8,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const btn: React.CSSProperties = {
  padding: "8px 8px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#fff",
  cursor: "grab",
  fontWeight: 700,
  fontSize: 12,
};

const btnContent: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const btnLabel: React.CSSProperties = {
  whiteSpace: "nowrap",
};

const iconWrap: React.CSSProperties = {
  width: 14,
  height: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconBase: React.CSSProperties = {
  width: 14,
  height: 14,
  display: "block",
};

function StackIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <rect x="2" y="2" width="12" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="7" width="12" height="3" rx="1" fill="currentColor" />
      <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function RowIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <rect x="2" y="2" width="3" height="12" rx="1" fill="currentColor" />
      <rect x="6.5" y="2" width="3" height="12" rx="1" fill="currentColor" />
      <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M3 3h10M8 3v10M6 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NumberIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M5 2l-2 12M11 2l-2 12M3 6h10M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <rect x="2" y="5" width="12" height="6" rx="3" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="6" cy="8" r="2.2" fill="currentColor" />
    </svg>
  );
}

function DropdownIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M3 4h10M3 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 10l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MultiSelectIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M3 4h6M3 8h6M3 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 4l1.5 1.5L15 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 8l1.5 1.5L15 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DateIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M5 2.5v3M11 2.5v3M2.5 6.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SignatureIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M2 11c2-4 3-4 5-1s3 2 7-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M2 13h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <path d="M4 2h5l3 3v9H4z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}
