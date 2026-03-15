"use client";

import type { LayoutNode, Node } from "@transform/contracts/form-types";
import { isControl, isLayout } from "./types";

export function CanvasTree({
  root,
  selectedId,
  onSelect,
  onDelete,
}: {
  root: LayoutNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff", color: "#111" }}>
      <h3 style={{ margin: "0 0 10px" }}>Canvas</h3>
      <TreeNode node={root} depth={0} selectedId={selectedId} onSelect={onSelect} onDelete={onDelete} />
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  onDelete,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
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
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onDelete={onDelete} />
          ))}
          {node.children.length === 0 ? (
            <div style={{ marginLeft: 14, marginTop: 6, opacity: 0.85, fontSize: 12 }}>No children</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
