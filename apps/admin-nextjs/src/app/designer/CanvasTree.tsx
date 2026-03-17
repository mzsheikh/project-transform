"use client";

import type { DragEvent } from "react";
import type { LayoutNode, Node } from "@transform/contracts/form-types";
import type { ToolboxItem } from "./Toolbox";
import { isControl, isLayout } from "./types";

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
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff", color: "#111" }}>
      <h3 style={{ margin: "0 0 10px" }}>Canvas</h3>
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
}: {
  parentLayoutId: string;
  insertIndex: number;
  onDropItem: (item: ToolboxItem, parentLayoutId: string, insertIndex: number) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const item = parseToolboxItem(event);
        if (!item) return;
        onDropItem(item, parentLayoutId, insertIndex);
      }}
      style={dropZone}
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
    <div style={{ marginLeft: depth * 14, marginTop: 8 }}>
      <div
        onClick={() => onSelect(node.id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: "8px 10px",
          cursor: "pointer",
          background: selected ? "#111" : "#fff",
          color: selected ? "#fff" : "#111",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
        {depth > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            style={{
              padding: "6px 8px",
              borderRadius: 10,
              border: selected ? "1px solid #fff" : "1px solid #111",
              background: "transparent",
              color: selected ? "#fff" : "#111",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Delete
          </button>
        ) : null}
      </div>

      {isLayout(node) ? (
        <div>
          <DropZone parentLayoutId={node.id} insertIndex={0} onDropItem={onDropItem} />
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
          <DropZone
            parentLayoutId={node.id}
            insertIndex={node.children.length}
            onDropItem={onDropItem}
          />
          {node.children.length === 0 ? (
            <div style={{ marginLeft: 14, marginTop: 6, opacity: 0.85, fontSize: 12 }}>No children</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const dropZone: React.CSSProperties = {
  height: 10,
  marginLeft: 14,
  marginTop: 4,
  marginBottom: 4,
  borderRadius: 10,
  border: "1px dashed #d1d5db",
  background: "linear-gradient(90deg, #f9fafb, #f1f5f9)",
};
