/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormDefinition, LayoutNode, Node } from "@transform/contracts/form-types";
import { Toolbox, type ToolboxItem } from "./Toolbox";
import { CanvasTree } from "./CanvasTree";
import { PropertiesPanel } from "./PropertiesPanel";
import { useDesignerStore } from "./designerStore";
import { useSaveDraft } from "../../lib/queries";

export function FormDesigner({
  appCode,
  formKey,
  initialSchema,
  onSaved,
}: {
  appCode: string;
  formKey: string;
  initialSchema: FormDefinition;
  onSaved?: (schema: FormDefinition) => void;
}) {
  const [status, setStatus] = useState<string>("");

  // Zustand state + actions
  const schema = useDesignerStore((s) => s.schema);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const dirty = useDesignerStore((s) => s.dirty);

  const init = useDesignerStore((s) => s.init);
  const select = useDesignerStore((s) => s.select);
  const updateNode = useDesignerStore((s) => s.updateNode);
  const removeNode = useDesignerStore((s) => s.removeNode);
  const addLayout = useDesignerStore((s) => s.addLayout);
  const addControl = useDesignerStore((s) => s.addControl);
  const markSaved = useDesignerStore((s) => s.markSaved);

  // Initialize store from initialSchema
  useEffect(() => {
    init(initialSchema);
    select(initialSchema.root.id);
    setStatus("");
  }, [initialSchema, init, select]);

  const selectedNode: Node | null = useMemo(() => {
    if (!schema || !selectedId) return null;
    return useDesignerStore.getState().getSelectedNode();
  }, [schema, selectedId]);

  const insertionTargetId = useMemo(() => {
    if (!schema) return "";
    const n = selectedNode;
    if (n && n.type === "layout") return n.id;
    return schema.root.id;
  }, [selectedNode, schema]);

  function addFromToolbox(item: ToolboxItem) {
    if (!schema) return;

    // insert under selected layout; if control selected, insert under root
    const targetLayoutId = insertionTargetId;

    if (item.kind === "layout") {
      addLayout(targetLayoutId, item.layoutType);
    } else {
      addControl(targetLayoutId, item.controlType);
    }

    setStatus("");
  }

  function insertFromToolbox(item: ToolboxItem, parentLayoutId: string, insertIndex: number) {
    if (!schema) return;

    if (item.kind === "layout") {
      addLayout(parentLayoutId, item.layoutType, insertIndex);
    } else {
      addControl(parentLayoutId, item.controlType, insertIndex);
    }

    setStatus("");
  }

  function deleteNode(id: string) {
    if (!schema) return;
    if (id === schema.root.id) return;

    removeNode(id);
    select(schema.root.id);
    setStatus("");
  }

  function patchSelected(patch: Partial<any>) {
    if (!selectedNode) return;
    updateNode(selectedNode.id, patch);
    setStatus("");
  }

  const saveDraft = useSaveDraft(appCode, formKey);

  async function onSaveDraft() {
    if (!schema) return;

    setStatus("Saving…");
    try {
      await saveDraft.mutateAsync({ schemaJson: schema });

      // ✅ mark saved in Zustand
      markSaved();

      setStatus("Saved ✅");
      onSaved?.(schema);
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? "save failed"}`);
    }
  }

  if (!schema) {
    return <div style={{ padding: 12, opacity: 0.8 }}>Loading designer…</div>;
  }

  return (
    <div style={workspace}>
      <div style={statusBar}>
        <div style={statusPill}>
          Insert target: <b>{insertionTargetId === schema.root.id ? "root" : "selected layout"}</b>
        </div>
        <div style={statusPillMuted}>
          {dirty ? "Unsaved changes" : "All changes saved"}
        </div>
        <button onClick={onSaveDraft} style={primaryBtn} disabled={saveDraft.isPending}>
          {saveDraft.isPending ? "Saving…" : "Save Draft"}
        </button>
        {status ? <span style={{ fontSize: 13, color: "#667085" }}>{status}</span> : null}
      </div>

      <div style={layout}>
      <div style={stickySidePanel}>
        <Toolbox onAdd={addFromToolbox} />
      </div>

      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <CanvasTree
          root={schema.root as LayoutNode}
          selectedId={selectedId ?? schema.root.id}
          onSelect={(id) => {
            select(id);
            setStatus("");
          }}
          onDelete={deleteNode}
          onDropItem={(toolboxItem, parentLayoutId, insertIndex) => {
            insertFromToolbox(toolboxItem, parentLayoutId, insertIndex);
          }}
        />
      </div>

      <div style={stickySidePanel}>
        <PropertiesPanel node={selectedNode} onChange={patchSelected} />
      </div>
      </div>
    </div>
  );
}

const workspace: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 8,
  background: "linear-gradient(180deg, #fcfcfd 0%, #f8fafc 100%)",
  minHeight: "calc(100vh - 180px)",
};

const statusBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const statusPill: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  background: "#fff",
  border: "1px solid #d0d5dd",
  fontSize: 13,
  color: "#344054",
};

const statusPillMuted: React.CSSProperties = {
  ...statusPill,
  background: "#f8fafc",
  color: "#667085",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr) 360px",
  gap: 16,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(17, 17, 17, 0.12)",
};

const stickySidePanel: React.CSSProperties = {
  position: "sticky",
  top: 16,
  alignSelf: "start",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
};
