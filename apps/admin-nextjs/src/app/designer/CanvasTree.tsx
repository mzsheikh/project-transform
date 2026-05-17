"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import type { LayoutNode, Node } from "@transform/contracts/form-types";
import type { ToolboxItem } from "./Toolbox";
import { isLayout } from "./types";

const DRAG_DATA_TYPE = "application/x-form-designer-item";

function parseToolboxItem(event: DragEvent): ToolboxItem | null {
  const raw = event.dataTransfer.getData(DRAG_DATA_TYPE) || event.dataTransfer.getData("text/plain");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.kind === "layout" && typeof parsed.layoutType === "string") {
      return parsed as ToolboxItem;
    }
    if (parsed.kind === "control" && typeof parsed.controlType === "string") {
      return parsed as ToolboxItem;
    }
    return null;
  } catch {
    return null;
  }
}

export function CanvasTree({
  root,
  selectedId,
  onSelect,
  onDelete,
  onDropItem,
}: {
  root: LayoutNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDropItem: (item: ToolboxItem, parentLayoutId: string, insertIndex: number) => void;
}) {
  return (
    <div style={panel}>
      <div style={panelHead}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Canvas</h3>
          <div style={panelHint}>Select nodes to edit properties. Drag controls into the structure.</div>
        </div>
      </div>
      <TreeNode
        node={root}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
        onDelete={onDelete}
        onDropItem={onDropItem}
      />
    </div>
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
        if (!item) return;
        onDropItem(item, parentLayoutId, insertIndex);
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
  onDropItem,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDropItem: (item: ToolboxItem, parentLayoutId: string, insertIndex: number) => void;
}) {
  const selected = node.id === selectedId;

  const title =
    isLayout(node)
      ? `layout:${node.layoutType}${node.layoutType === "section" && node.label ? ` (${node.label})` : ""}`
      : `control:${node.controlType} (${node.key})`;

  return (
    <div style={{ marginLeft: depth * 14, marginTop: 10 }}>
      <div
        onClick={() => onSelect(node.id)}
        style={{
          ...nodeCard,
          ...(isLayout(node) ? layoutCard : controlCard),
          ...(selected ? nodeCardSelected : null),
        }}
      >
        <span style={{ display: "grid", gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
          <span style={{ fontSize: 12, color: selected ? "rgba(255,255,255,0.78)" : "#667085" }}>
            {isLayout(node) ? "Container node" : "Field node"}
          </span>
        </span>
        {depth > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            style={selected ? deleteBtnSelected : deleteBtn}
          >
            Delete
          </button>
        ) : null}
      </div>

      {isLayout(node) ? (
        <div>
          {node.children.map((c, index) => (
            <div key={c.id}>
              <DropZone parentLayoutId={node.id} insertIndex={index} onDropItem={onDropItem} />
              <TreeNode
                node={c}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onDropItem={onDropItem}
              />
            </div>
          ))}
          <DropZone parentLayoutId={node.id} insertIndex={node.children.length} onDropItem={onDropItem} empty={node.children.length === 0} />
          {node.children.length === 0 ? (
            <div style={{ marginLeft: 14, marginTop: 8, color: "#98a2b3", fontSize: 12 }}>Empty layout. Drag or click tools to add fields.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 20,
  padding: 14,
  background: "#fff",
  color: "#111",
  boxShadow: "0 10px 30px rgba(16, 24, 40, 0.04)",
};

const panelHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
};

const panelHint: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#667085",
};

const nodeCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  border: "1px solid #d0d5dd",
  borderRadius: 14,
  padding: "10px 12px",
  cursor: "pointer",
  background: "#fff",
  color: "#111",
};

const nodeCardSelected: React.CSSProperties = {
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
  boxShadow: "0 8px 20px rgba(17, 24, 39, 0.14)",
};

const layoutCard: React.CSSProperties = {
  background: "#f8fafc",
};

const controlCard: React.CSSProperties = {
  background: "#fff",
};

const deleteBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #d0d5dd",
  background: "#fff",
  color: "#344054",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};

const deleteBtnSelected: React.CSSProperties = {
  ...deleteBtn,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.24)",
};

const dropZone: React.CSSProperties = {
  height: 6,
  marginLeft: 14,
  marginTop: 4,
  marginBottom: 4,
  borderRadius: 10,
  border: "1px dashed transparent",
  background: "transparent",
  transition: "all 120ms ease",
};

const dropZoneActive: React.CSSProperties = {
  height: 24,
  border: "1px dashed #98a2b3",
  background: "linear-gradient(90deg, #eef2ff, #f8fafc)",
};

const emptyDropZone: React.CSSProperties = {
  height: 48,
  border: "1px dashed #d0d5dd",
  background: "#f8fafc",
};
