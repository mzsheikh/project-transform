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
  { label: "Image", item: { kind: "control", controlType: "image" }, icon: <ImageIcon /> },
  { label: "File", item: { kind: "control", controlType: "file" }, icon: <FileIcon /> },
];

export function Toolbox({
  collapsed,
  onToggleCollapsed,
  onAdd,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAdd: (item: ToolboxItem) => void;
}) {
  function dragStart(item: ToolboxItem) {
    return (event: DragEvent<HTMLButtonElement>) => {
      const payload = JSON.stringify(item);
      event.dataTransfer.setData("application/x-form-designer-item", payload);
      event.dataTransfer.setData("text/plain", payload);
      event.dataTransfer.effectAllowed = "copy";
    };
  }

  return (
    <aside style={{ ...panel, ...(collapsed ? panelCollapsed : null) }}>
      <div style={headerWrap}>
        <h3 style={h3}>Toolbox</h3>
        <button type="button" style={collapseBtn} onClick={onToggleCollapsed} aria-label={collapsed ? "Expand toolbox" : "Collapse toolbox"}>
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div style={section}>
            <div style={label}>Layouts</div>
            <div style={grid}>
              {LAYOUTS.map((x) => (
                <ToolButton key={x.label} entry={x} dragStart={dragStart} onAdd={onAdd} />
              ))}
            </div>
          </div>

          <div style={section}>
            <div style={label}>Controls</div>
            <div style={grid}>
              {CONTROLS.map((x) => (
                <ToolButton key={x.label} entry={x} dragStart={dragStart} onAdd={onAdd} />
              ))}
            </div>
          </div>

          <div style={tipCard}>
            <div style={tipTitle}>Tip</div>
            <div style={tipText}>Drag a layout or control onto the canvas to add it to your form.</div>
          </div>
        </>
      ) : (
        <div style={collapsedRail}>
          {[...LAYOUTS, ...CONTROLS].map((x) => (
            <button
              key={x.label}
              style={railBtn}
              draggable
              title={x.label}
              onDragStart={dragStart(x.item)}
              onClick={() => onAdd(x.item)}
            >
              {x.icon}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function ToolButton({
  entry,
  dragStart,
  onAdd,
}: {
  entry: ToolboxEntry;
  dragStart: (item: ToolboxItem) => (event: DragEvent<HTMLButtonElement>) => void;
  onAdd: (item: ToolboxItem) => void;
}) {
  return (
    <button
      style={btn}
      draggable
      onDragStart={dragStart(entry.item)}
      onClick={() => onAdd(entry.item)}
    >
      <span style={btnContent}>
        <span style={iconWrap}>{entry.icon}</span>
        <span style={btnLabel}>{entry.label}</span>
      </span>
    </button>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid #dfe6f0",
  borderRadius: 8,
  padding: 16,
  background: "#fff",
  color: "#111",
  boxShadow: "0 14px 35px rgba(20, 38, 69, 0.04)",
  transition: "width 160ms ease",
};

const headerWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 18,
};

const h3: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#2f3a4a",
};

const section: React.CSSProperties = {
  marginTop: 14,
};

const label: React.CSSProperties = {
  fontSize: 14,
  color: "#5b6677",
  marginBottom: 12,
  fontWeight: 700,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const btn: React.CSSProperties = {
  minHeight: 58,
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #dfe6f0",
  background: "#fff",
  cursor: "grab",
  fontWeight: 700,
  fontSize: 15,
  color: "#344054",
  boxShadow: "0 4px 12px rgba(20, 38, 69, 0.03)",
};

const btnContent: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
};

const btnLabel: React.CSSProperties = {
  whiteSpace: "nowrap",
};

const iconWrap: React.CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconBase: React.CSSProperties = {
  width: 22,
  height: 22,
  display: "block",
};

const panelCollapsed: React.CSSProperties = {
  padding: 10,
};

const collapseBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "1px solid #dfe6f0",
  background: "#fff",
  color: "#667085",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 18,
};

const tipCard: React.CSSProperties = {
  marginTop: 26,
  border: "1px solid #e7edf5",
  borderRadius: 8,
  padding: 14,
  background: "#fff",
};

const tipTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#2454d6",
  marginBottom: 10,
};

const tipText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: "#667085",
  fontWeight: 600,
};

const collapsedRail: React.CSSProperties = {
  display: "grid",
  gap: 10,
  justifyItems: "center",
};

const railBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  border: "1px solid #dfe6f0",
  background: "#fff",
  color: "#344054",
  cursor: "grab",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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

function ImageIcon() {
  return (
    <svg viewBox="0 0 16 16" style={iconBase} aria-hidden>
      <rect x="2.5" y="3" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="6" cy="6.5" r="1.2" fill="currentColor" />
      <path d="M4 11l2.5-2.5 2 1.5L10.5 8l1.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
