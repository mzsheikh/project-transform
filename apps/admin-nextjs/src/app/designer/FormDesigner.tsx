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

  function addFromToolbox(item: any) {
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
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 340px", gap: 12 }}>
      <div style={stickySidePanel}>
        <Toolbox onAdd={addFromToolbox} />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ opacity: 0.9, fontSize: 13 }}>
            Insert target: <b>{insertionTargetId === schema.root.id ? "root" : "selected layout"}</b>
            {dirty ? <span style={{ marginLeft: 10, opacity: 0.85 }}>• unsaved changes</span> : null}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={onSaveDraft} style={primaryBtn} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? "Saving…" : "Save Draft"}
            </button>
            <span style={{ fontSize: 13, opacity: 0.85 }}>{status}</span>
          </div>
        </div>

        <CanvasTree
          root={schema.root as LayoutNode}
          selectedId={selectedId ?? schema.root.id}
          onSelect={(id) => {
            select(id);
            setStatus("");
          }}
          onDelete={deleteNode}
        />
      </div>

      <div style={stickySidePanel}>
        <PropertiesPanel node={selectedNode} onChange={patchSelected} />
      </div>
    </div>
  );
}
//c
const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const stickySidePanel: React.CSSProperties = {
  position: "sticky",
  top: 12,
  alignSelf: "start",
  maxHeight: "calc(100vh - 24px)",
  overflowY: "auto",
};
