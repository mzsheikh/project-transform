"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import type { ControlNode, LayoutNode, Node } from "@transform/contracts/form-types";
import type { ToolboxItem } from "./Toolbox";
import { isLayout } from "./types";

const DRAG_DATA_TYPE = "application/x-form-designer-item";

function parseToolboxItem(event: DragEvent): ToolboxItem | null {
  const raw = event.dataTransfer.getData(DRAG_DATA_TYPE) || event.dataTransfer.getData("text/plain");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.kind === "layout" && typeof parsed.layoutType === "string") return parsed as ToolboxItem;
    if (parsed.kind === "control" && typeof parsed.controlType === "string") return parsed as ToolboxItem;
    return null;
  } catch {
    return null;
  }
}

export function CanvasTree({
  root,
  selectedId,
  zoom,
  onSelect,
  onDelete,
  onDuplicate,
  onDropItem,
}: {
  root: LayoutNode;
  selectedId: string | null;
  zoom: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDropItem: (item: ToolboxItem, parentLayoutId: string, insertIndex: number) => void;
}) {
  return (
    <section style={panel}>
      <div style={panelTitle}>Canvas</div>
      <div style={canvasShell}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 160ms ease" }}>
          <TreeNode
            node={root}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onDropItem={onDropItem}
          />
        </div>
      </div>
    </section>
  );
}

function DropZone({
  parentLayoutId,
  insertIndex,
  onDropItem,
  empty = false,
}: {
  parentLayoutId: string;
  insertIndex: number;
  onDropItem: (item: ToolboxItem, parentLayoutId: string, insertIndex: number) => void;
  empty?: boolean;
}) {
  const [active, setActive] = useState(false);

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (!active) setActive(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setActive(false);
        const item = parseToolboxItem(event);
        if (item) onDropItem(item, parentLayoutId, insertIndex);
      }}
      style={{
        ...dropZone,
        ...(active ? dropZoneActive : null),
        ...(empty ? emptyDropZone : null),
      }}
    />
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onDropItem,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDropItem: (item: ToolboxItem, parentLayoutId: string, insertIndex: number) => void;
}) {
  const selected = node.id === selectedId;
  const [collapsed, setCollapsed] = useState(false);

  if (isLayout(node)) {
    const canDelete = depth > 0;
    return (
      <div style={{ marginTop: depth === 0 ? 0 : 18 }}>
        <div
          onClick={() => onSelect(node.id)}
          style={{
            ...layoutCard,
            ...(selected ? selectedCard : null),
            marginLeft: depth * 14,
          }}
        >
          <div style={layoutHeader}>
            <div style={nodeTitleWrap}>
              <GripIcon />
              <span style={nodeTitle}>layout: {node.layoutType}</span>
            </div>
            <div style={nodeActions}>
              <IconButton label="Duplicate layout" onClick={() => onDuplicate(node.id)}>
                <DuplicateIcon />
              </IconButton>
              <IconButton label="Delete layout" disabled={!canDelete} onClick={() => onDelete(node.id)}>
                <TrashIcon />
              </IconButton>
              <IconButton label={collapsed ? "Expand layout" : "Collapse layout"} onClick={() => setCollapsed((v) => !v)}>
                <ChevronIcon collapsed={collapsed} />
              </IconButton>
            </div>
          </div>

          {!collapsed ? (
            <div style={layoutBody}>
              {node.children.map((child, index) => (
                <div key={child.id}>
                  <DropZone parentLayoutId={node.id} insertIndex={index} onDropItem={onDropItem} />
                  <TreeNode
                    node={child}
                    depth={depth + 1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onDropItem={onDropItem}
                  />
                </div>
              ))}
              <DropZone parentLayoutId={node.id} insertIndex={node.children.length} onDropItem={onDropItem} empty={node.children.length === 0} />
              {node.children.length === 0 ? <EmptyState /> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(node.id)}
      style={{
        ...controlCard,
        ...(selected ? selectedControlCard : null),
        marginLeft: depth * 14,
      }}
    >
      <div style={controlContent}>
        <span style={controlIconBox}>{controlIcon(node.controlType)}</span>
        <span style={controlTitle}>control: {node.controlType} ({node.key})</span>
      </div>
      <div style={nodeActions}>
        <IconButton label="Configure control" onClick={() => onSelect(node.id)}>
          <GearIcon />
        </IconButton>
        <IconButton label="Duplicate control" onClick={() => onDuplicate(node.id)}>
          <DuplicateIcon />
        </IconButton>
        <IconButton label="Delete control" onClick={() => onDelete(node.id)}>
          <TrashIcon />
        </IconButton>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={emptyState}>
      <div style={emptyIllustration}>
        <div style={emptyBlockOne} />
        <div style={emptyBlockTwo} />
      </div>
      <div style={emptyTitle}>Your form is empty.</div>
      <div style={emptyText}>Drag and drop controls from the toolbox<br />to get started.</div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      style={{ ...iconButton, ...(disabled ? disabledIconButton : null) }}
    >
      {children}
    </button>
  );
}

function controlIcon(type: ControlNode["controlType"]) {
  if (type === "number") return <span style={{ fontWeight: 900, fontSize: 22 }}>#</span>;
  if (type === "signature") return <SignatureIcon />;
  if (type === "date") return <CalendarIcon />;
  if (type === "dropdown" || type === "multiselect") return <ChevronListIcon />;
  if (type === "file" || type === "image") return <FileIcon />;
  return <span style={{ fontFamily: "serif", fontSize: 25 }}>T</span>;
}

const panel: React.CSSProperties = {
  border: "1px dashed #d8e0ea",
  borderRadius: 12,
  padding: 26,
  background: "#fff",
  minHeight: 650,
};

const panelTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 16,
  color: "#2c3441",
};

const canvasShell: React.CSSProperties = {
  minHeight: 560,
  overflow: "auto",
};

const layoutCard: React.CSSProperties = {
  border: "1px solid #dfe6f0",
  borderRadius: 8,
  background: "#f8fbff",
  boxShadow: "0 10px 28px rgba(20, 38, 69, 0.05)",
  padding: 16,
};

const selectedCard: React.CSSProperties = {
  border: "2px solid #a8c7ff",
  boxShadow: "0 0 0 4px rgba(47, 111, 237, 0.06)",
};

const layoutHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const nodeTitleWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const nodeTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: "#2e3a4a",
};

const nodeActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const layoutBody: React.CSSProperties = {
  borderRadius: 8,
};

const controlCard: React.CSSProperties = {
  minHeight: 76,
  border: "1px solid #dfe6f0",
  borderRadius: 8,
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "14px 18px",
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(20, 38, 69, 0.04)",
};

const selectedControlCard: React.CSSProperties = {
  borderColor: "#a8c7ff",
};

const controlContent: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const controlIconBox: React.CSSProperties = {
  width: 50,
  height: 50,
  border: "1px solid #e5ebf3",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#344054",
};

const controlTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: "#2e3a4a",
};

const iconButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#4b5563",
  cursor: "pointer",
  padding: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const disabledIconButton: React.CSSProperties = {
  opacity: 0.35,
  cursor: "not-allowed",
};

const dropZone: React.CSSProperties = {
  height: 10,
  borderRadius: 10,
  border: "1px dashed transparent",
  background: "transparent",
  transition: "all 120ms ease",
};

const dropZoneActive: React.CSSProperties = {
  height: 30,
  border: "1px dashed #76a7ff",
  background: "#edf5ff",
};

const emptyDropZone: React.CSSProperties = {
  height: 34,
};

const emptyState: React.CSSProperties = {
  minHeight: 360,
  display: "grid",
  placeContent: "center",
  justifyItems: "center",
  textAlign: "center",
  color: "#667085",
};

const emptyIllustration: React.CSSProperties = {
  position: "relative",
  width: 180,
  height: 120,
  marginBottom: 8,
};

const emptyBlockOne: React.CSSProperties = {
  position: "absolute",
  left: 28,
  top: 22,
  width: 130,
  height: 62,
  border: "2px solid #a8c7ff",
  borderRadius: 6,
  background: "#f6fbff",
};

const emptyBlockTwo: React.CSSProperties = {
  position: "absolute",
  left: 58,
  bottom: 8,
  width: 128,
  height: 34,
  border: "2px solid #a8c7ff",
  borderRadius: 6,
  background: "#edf5ff",
};

const emptyTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#475467",
  marginTop: 6,
};

const emptyText: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.35,
  marginTop: 8,
};

const iconBase: React.CSSProperties = { width: 21, height: 21, display: "block" };

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" style={{ width: 16, height: 16, color: "#667085" }} aria-hidden>
      <path d="M5 3h.1M5 8h.1M5 13h.1M11 3h.1M11 8h.1M11 13h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M4 12V6a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <path d="M4 6h12M8 4h4M7 8l.5 7h5L13 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <path d="M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="m15.5 11 .9 1.6-1.8 3.1h-1.9l-1.1.7-.9 1.6H9.3l-.9-1.6-1.1-.7H5.4l-1.8-3.1.9-1.6V9l-.9-1.6 1.8-3.1h1.9l1.1-.7L9.3 2h1.4l.9 1.6 1.1.7h1.9l1.8 3.1-.9 1.6v2Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <path d={collapsed ? "m7 5 6 5-6 5" : "m5 7 5 6 5-6"} stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignatureIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <path d="M3 13c3-6 5-6 7-1 2 4 4 1 7-3" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M3 16h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M7 2.5v4M13 2.5v4M3 8h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronListIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <path d="M4 6h12M4 10h8M4 14h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" style={iconBase} aria-hidden>
      <path d="M6 3h6l3 3v11H6V3Z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
