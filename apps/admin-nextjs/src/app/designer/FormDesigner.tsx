/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ControlNode, FormDefinition, LayoutNode, Node } from "@transform/contracts/form-types";
import { formHasExpressions, validateFormExpressions } from "@transform/contracts/expressions";
import { Toolbox, type ToolboxItem } from "./Toolbox";
import { CanvasTree } from "./CanvasTree";
import { PropertiesPanel } from "./PropertiesPanel";
import { SubmitActionsPanel } from "./SubmitActionsPanel";
import { useDesignerStore } from "./designerStore";
import { usePublish, useSaveDraft } from "../../lib/queries";

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
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitActionsOpen, setSubmitActionsOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const schema = useDesignerStore((s) => s.schema);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const dirty = useDesignerStore((s) => s.dirty);
  const history = useDesignerStore((s) => s.history);

  const init = useDesignerStore((s) => s.init);
  const select = useDesignerStore((s) => s.select);
  const updateNode = useDesignerStore((s) => s.updateNode);
  const removeNode = useDesignerStore((s) => s.removeNode);
  const duplicateNode = useDesignerStore((s) => s.duplicateNode);
  const addLayout = useDesignerStore((s) => s.addLayout);
  const addControl = useDesignerStore((s) => s.addControl);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const markSaved = useDesignerStore((s) => s.markSaved);

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
    if (selectedNode?.type === "layout") return selectedNode.id;
    return schema.root.id;
  }, [selectedNode, schema]);

  const selectedPath = useMemo(() => {
    if (!schema || !selectedId) return ["root"];
    return getNodePath(schema.root, selectedId) ?? ["root"];
  }, [schema, selectedId]);

  const saveDraft = useSaveDraft(appCode, formKey);
  const publish = usePublish(appCode, formKey);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  function addFromToolbox(item: ToolboxItem) {
    if (!schema) return;
    if (item.kind === "layout") addLayout(insertionTargetId, item.layoutType);
    else addControl(insertionTargetId, item.controlType);
    setStatus("");
  }

  function insertFromToolbox(item: ToolboxItem, parentLayoutId: string, insertIndex: number) {
    if (!schema) return;
    if (item.kind === "layout") addLayout(parentLayoutId, item.layoutType, insertIndex);
    else addControl(parentLayoutId, item.controlType, insertIndex);
    setStatus("");
  }

  function deleteNode(id: string) {
    if (!schema || id === schema.root.id) return;
    removeNode(id);
    select(schema.root.id);
    setStatus("");
  }

  function patchSelected(patch: Partial<any>) {
    if (!selectedNode) return;
    updateNode(selectedNode.id, patch);
    setStatus("");
  }

  async function onSaveDraft() {
    if (!schema) return;
    const schemaToSave = withExpressionSchemaVersion(schema);

    setStatus("Saving...");
    try {
      await saveDraft.mutateAsync({ schemaJson: schemaToSave });
      markSaved();
      setStatus("Saved");
      onSaved?.(schemaToSave);
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? "save failed"}`);
    }
  }

  async function onPublish() {
    if (!schema) return;
    const schemaToSave = withExpressionSchemaVersion(schema);
    const expressionIssues = validateFormExpressions(schemaToSave);
    if (expressionIssues.length > 0) {
      setStatus(`Expression error: ${expressionIssues[0].message}`);
      return;
    }

    setSaveMenuOpen(false);
    setStatus("Publishing...");
    try {
      await saveDraft.mutateAsync({ schemaJson: schemaToSave });
      const published = await publish.mutateAsync();
      markSaved();
      setStatus(`Published v${published.version}`);
      onSaved?.(schemaToSave);
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? "publish failed"}`);
    }
  }

  if (!schema) {
    return <div style={{ padding: 24, opacity: 0.8 }}>Loading designer...</div>;
  }

  return (
    <div style={workspace}>
      <div style={topRow}>
        <div>
          <h1 style={title}>Form Designer</h1>
          <div style={metaLine}>
            <span>App: <b>{appCode}</b></span>
            <span style={metaDivider}>|</span>
            <span>Form Key: <b>{formKey}</b></span>
            <span style={draftPill}>Draft (v0)</span>
            {dirty ? <span style={dirtyText}>Unsaved changes</span> : null}
            {status ? <span style={statusText}>{status}</span> : null}
          </div>
        </div>

        <div style={toolbar}>
          <ToolbarButton label="Preview" icon={<EyeIcon />} active onClick={() => setPreviewOpen(true)} />
          <ToolbarButton label="Actions" icon={<ActionIcon />} onClick={() => setSubmitActionsOpen(true)} />
          <ToolbarButton label="Undo" icon={<UndoIcon />} disabled={!canUndo} onClick={() => { undo(); setStatus(""); }} />
          <ToolbarButton label="Redo" icon={<RedoIcon />} disabled={!canRedo} onClick={() => { redo(); setStatus(""); }} />
          <div style={splitWrap}>
            <button type="button" onClick={onSaveDraft} style={saveMainBtn} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? "Saving..." : "Save Draft"}
            </button>
            <button type="button" onClick={() => setSaveMenuOpen((v) => !v)} style={saveChevronBtn} aria-label="Save menu">
              <ChevronDownIcon />
            </button>
            {saveMenuOpen ? (
              <div style={saveMenu}>
                <button type="button" style={saveMenuItem} onClick={onPublish} disabled={publish.isPending || saveDraft.isPending}>
                  {publish.isPending ? "Publishing..." : "Publish"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ ...designerGrid, gridTemplateColumns: toolboxCollapsed ? "76px minmax(0, 1fr) 370px" : "330px minmax(0, 1fr) 370px" }}>
        <div style={stickySidePanel}>
          <Toolbox
            collapsed={toolboxCollapsed}
            onToggleCollapsed={() => setToolboxCollapsed((v) => !v)}
            onAdd={addFromToolbox}
          />
        </div>

        <div style={centerColumn}>
          <div style={insertTarget}>Insert target: <b>{insertionTargetId === schema.root.id ? "root" : "selected layout"}</b></div>
          <CanvasTree
            root={schema.root as LayoutNode}
            selectedId={selectedId ?? schema.root.id}
            zoom={zoom}
            onSelect={(id) => {
              select(id);
              setStatus("");
            }}
            onDelete={deleteNode}
            onDuplicate={(id) => {
              duplicateNode(id);
              setStatus("");
            }}
            onDropItem={insertFromToolbox}
          />
        </div>

        <div style={stickySidePanel}>
          <PropertiesPanel node={selectedNode} onChange={patchSelected} onClose={() => select(null)} />
        </div>
      </div>

      <div style={bottomBar}>
        <div style={pathLine}>
          <span>Path:</span>
          {selectedPath.map((part, index) => (
            <span key={`${part}-${index}`} style={index === selectedPath.length - 1 ? pathActive : undefined}>
              {index > 0 ? <span style={pathChevron}>›</span> : null}
              {part}
            </span>
          ))}
        </div>
        <div style={zoomControls}>
          <button type="button" style={zoomBtn} onClick={() => setZoom((v) => Math.max(0.5, Number((v - 0.1).toFixed(1))))}>
            <ZoomOutIcon />
          </button>
          <span style={zoomText}>{Math.round(zoom * 100)}%</span>
          <button type="button" style={zoomBtn} onClick={() => setZoom((v) => Math.min(1.5, Number((v + 0.1).toFixed(1))))}>
            <ZoomInIcon />
          </button>
          <button type="button" style={zoomBtn} onClick={() => setZoom(1)} title="Fit canvas">
            <FitIcon />
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div style={modalBackdrop} onClick={() => setPreviewOpen(false)}>
          <div style={previewModal} onClick={(event) => event.stopPropagation()}>
            <div style={previewHeader}>
              <div>
                <h2 style={{ margin: 0 }}>Preview</h2>
                <div style={{ color: "#667085", marginTop: 4 }}>{formKey}</div>
              </div>
              <button type="button" style={closeBtn} onClick={() => setPreviewOpen(false)}>×</button>
            </div>
            <div style={previewBody}>
              <PreviewNode node={schema.root} />
            </div>
          </div>
        </div>
      ) : null}

      {submitActionsOpen ? (
        <SubmitActionsPanel appCode={appCode} formKey={formKey} onClose={() => setSubmitActionsOpen(false)} />
      ) : null}
    </div>
  );
}

function withExpressionSchemaVersion(schema: FormDefinition): FormDefinition {
  return formHasExpressions(schema) && schema.schemaVersion !== "1.1"
    ? { ...schema, schemaVersion: "1.1" }
    : schema;
}

function getNodePath(root: LayoutNode, selectedId: string): string[] | null {
  if (root.id === selectedId) return ["root"];
  for (const child of root.children) {
    const found = getNodePathFromNode(child, selectedId);
    if (found) return ["root", ...found];
  }
  return null;
}

function getNodePathFromNode(node: Node, selectedId: string): string[] | null {
  const label = node.type === "layout" ? (node.layoutType === "repeater" ? node.key ?? "repeater" : node.layoutType) : node.key;
  if (node.id === selectedId) return [label];
  if (node.type === "layout") {
    for (const child of node.children) {
      const found = getNodePathFromNode(child, selectedId);
      if (found) return [label, ...found];
    }
  }
  return null;
}

function PreviewNode({ node }: { node: Node }) {
  if (node.type === "layout") {
    if (node.layoutType === "repeater") {
      const props = (node.props ?? {}) as Record<string, any>;
      return (
        <div style={previewRepeater}>
          <div style={previewRepeaterHeader}>
            <b>{node.label ?? "Repeat Section"}</b>
            <span>{node.key ?? node.id}</span>
          </div>
          <div style={previewStack}>
            {node.children.length ? node.children.map((child) => <PreviewNode key={child.id} node={child} />) : <div style={previewEmpty}>Empty repeat section</div>}
          </div>
          <button type="button" style={previewRepeatButton}>{props.addButtonLabel ?? "Add item"}</button>
        </div>
      );
    }

    return (
      <div style={node.layoutType === "row" ? previewRow : previewStack}>
        {node.children.length ? node.children.map((child) => <PreviewNode key={child.id} node={child} />) : <div style={previewEmpty}>Empty layout</div>}
      </div>
    );
  }

  const props = (node.props ?? {}) as Record<string, any>;
  return (
    <label style={previewField}>
      <span style={previewLabel}>{node.label}</span>
      {previewControl(node, props)}
    </label>
  );
}

function previewControl(node: ControlNode, props: Record<string, any>) {
  if (node.controlType === "dropdown" || node.controlType === "multiselect") {
    return <select style={previewInput}><option>{props.placeholder || "Select..."}</option></select>;
  }
  if (node.controlType === "switch") {
    return <input type="checkbox" />;
  }
  if (node.controlType === "signature") {
    return <div style={previewInput}>Add Signature</div>;
  }
  if (node.controlType === "image") {
    return <div style={previewInput}>{props.buttonLabel || "Add Image"}</div>;
  }
  if (node.controlType === "file") {
    return <div style={previewInput}>Choose File</div>;
  }
  return <input style={previewInput} placeholder={props.placeholder ?? ""} type={node.controlType === "number" ? "number" : "text"} readOnly />;
}

function ToolbarButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...toolbarBtn, ...(active ? toolbarBtnActive : null), ...(disabled ? toolbarBtnDisabled : null) }}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

const workspace: React.CSSProperties = {
  display: "grid",
  gap: 24,
  background: "#fbfcfe",
  minHeight: "calc(100vh - 126px)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 24,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#101828",
};

const metaLine: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  color: "#344054",
  fontSize: 18,
};

const metaDivider: React.CSSProperties = { color: "#98a2b3" };
const draftPill: React.CSSProperties = {
  padding: "7px 16px",
  borderRadius: 999,
  background: "#d7f8dc",
  color: "#18a031",
  fontWeight: 800,
  fontSize: 16,
};
const dirtyText: React.CSSProperties = { color: "#b54708", fontSize: 13, fontWeight: 700 };
const statusText: React.CSSProperties = { color: "#667085", fontSize: 13, fontWeight: 700 };

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 16,
};

const toolbarBtn: React.CSSProperties = {
  width: 74,
  minHeight: 74,
  border: 0,
  background: "transparent",
  color: "#101828",
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: 7,
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

const toolbarBtnActive: React.CSSProperties = { background: "#f4f8ff", color: "#052b7f" };
const toolbarBtnDisabled: React.CSSProperties = { color: "#98a2b3", cursor: "not-allowed" };

const splitWrap: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "stretch",
  marginLeft: 12,
  height: 64,
};

const saveMainBtn: React.CSSProperties = {
  minWidth: 154,
  border: "1px solid #132a63",
  borderRight: "1px solid rgba(255,255,255,0.16)",
  borderRadius: "8px 0 0 8px",
  background: "#071f5c",
  color: "#fff",
  fontWeight: 800,
  fontSize: 17,
  cursor: "pointer",
};

const saveChevronBtn: React.CSSProperties = {
  width: 58,
  border: "1px solid #132a63",
  borderRadius: "0 8px 8px 0",
  background: "#071f5c",
  color: "#fff",
  cursor: "pointer",
};

const saveMenu: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: 70,
  minWidth: 190,
  border: "1px solid #dfe6f0",
  borderRadius: 10,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(20, 38, 69, 0.14)",
  zIndex: 20,
  padding: 6,
};

const saveMenuItem: React.CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: 8,
  padding: "11px 12px",
  background: "#fff",
  textAlign: "left",
  cursor: "pointer",
  fontWeight: 800,
};

const designerGrid: React.CSSProperties = {
  display: "grid",
  gap: 28,
  alignItems: "start",
};

const stickySidePanel: React.CSSProperties = {
  position: "sticky",
  top: 18,
  alignSelf: "start",
  maxHeight: "calc(100vh - 36px)",
  overflowY: "auto",
};

const centerColumn: React.CSSProperties = {
  display: "grid",
  gap: 18,
  minWidth: 0,
};

const insertTarget: React.CSSProperties = {
  color: "#667085",
  fontSize: 16,
};

const bottomBar: React.CSSProperties = {
  minHeight: 48,
  borderTop: "1px solid #e6ebf2",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  padding: "0 16px",
  background: "#fbfcfe",
};

const pathLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#475467",
  fontWeight: 700,
};

const pathChevron: React.CSSProperties = { marginRight: 10, color: "#98a2b3" };
const pathActive: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  background: "#e8f1ff",
  color: "#175cd3",
};

const zoomControls: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const zoomBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#344054",
  cursor: "pointer",
  display: "inline-flex",
};

const zoomText: React.CSSProperties = { minWidth: 52, textAlign: "center", color: "#344054", fontWeight: 800 };

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 60,
  display: "grid",
  placeItems: "center",
  padding: 24,
};

const previewModal: React.CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "86vh",
  borderRadius: 16,
  background: "#fff",
  overflow: "hidden",
  boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
};

const previewHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 20,
  borderBottom: "1px solid #e6ebf2",
};

const closeBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  border: 0,
  background: "transparent",
  fontSize: 28,
  cursor: "pointer",
  color: "#667085",
};

const previewBody: React.CSSProperties = { padding: 24, overflow: "auto", maxHeight: "70vh" };
const previewStack: React.CSSProperties = { display: "grid", gap: 16 };
const previewRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 };
const previewField: React.CSSProperties = { display: "grid", gap: 7, color: "#344054", fontWeight: 700 };
const previewLabel: React.CSSProperties = { fontSize: 14 };
const previewInput: React.CSSProperties = { minHeight: 42, border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px", background: "#fff" };
const previewEmpty: React.CSSProperties = { border: "1px dashed #d0d5dd", borderRadius: 10, padding: 18, color: "#98a2b3" };
const previewRepeater: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 12, padding: 14, display: "grid", gap: 12 };
const previewRepeaterHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, color: "#344054" };
const previewRepeatButton: React.CSSProperties = { border: "1px solid #111", borderRadius: 10, background: "#fff", padding: "10px 12px", fontWeight: 800 };

const iconStyle: React.CSSProperties = { width: 24, height: 24, display: "block" };

function EyeIcon() {
  return <svg viewBox="0 0 24 24" style={iconStyle} aria-hidden><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" /></svg>;
}

function UndoIcon() {
  return <svg viewBox="0 0 24 24" style={iconStyle} aria-hidden><path d="M9 7H4v5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 12a8 8 0 1 0 2.4-5.7L4 9" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>;
}

function RedoIcon() {
  return <svg viewBox="0 0 24 24" style={iconStyle} aria-hidden><path d="M15 7h5v5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 12a8 8 0 1 1-2.4-5.7L20 9" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>;
}

function ActionIcon() {
  return <svg viewBox="0 0 24 24" style={iconStyle} aria-hidden><path d="M5 7h5M14 7h5M5 17h5M14 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M10 7c2 0 2 10 4 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M14 7c-2 0-2 10-4 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;
}

function ChevronDownIcon() {
  return <svg viewBox="0 0 20 20" style={{ width: 20, height: 20 }} aria-hidden><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ZoomOutIcon() {
  return <svg viewBox="0 0 20 20" style={iconStyle} aria-hidden><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M6 8.5h5M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function ZoomInIcon() {
  return <svg viewBox="0 0 20 20" style={iconStyle} aria-hidden><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M6 8.5h5M8.5 6v5M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function FitIcon() {
  return <svg viewBox="0 0 20 20" style={iconStyle} aria-hidden><path d="M4 8V4h4M12 4h4v4M16 12v4h-4M8 16H4v-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
