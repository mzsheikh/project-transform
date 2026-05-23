"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectorDto, FormSubmitActionDto, SubmitActionConfig, SubmitActionType } from "@transform/contracts/action-types";
import { api } from "../../lib/api";
import { qk, useConnectors, useSubmitActions } from "../../lib/queries";

const emailDefault = JSON.stringify(
  {
    to: ["operations@example.com"],
    cc: [],
    bcc: [],
    subjectTemplate: "{{formKey}} submission {{submissionId}}",
    bodyTemplate: "A new {{formKey}} submission was received.",
    includeJson: true,
  },
  null,
  2,
);

const databaseDefault = JSON.stringify(
  {
    connectorId: "",
    autoCreateTables: true,
    tables: [
      {
        tableName: "form_submissions",
        source: "root",
        includeMetadataColumns: true,
        columns: [{ sourceKey: "customerName", targetField: "customer_name", type: "text" }],
      },
    ],
  },
  null,
  2,
);

const restDefault = JSON.stringify(
  {
    connectorId: "",
    method: "POST",
    path: "/submissions",
    headers: {},
    bodyTemplate: { submissionId: "{{submissionId}}", formKey: "{{formKey}}", formVersion: "{{formVersion}}" },
    fieldMappings: [{ sourceKey: "customerName", targetPath: "data.customerName" }],
  },
  null,
  2,
);

export function SubmitActionsPanel({
  appCode,
  formKey,
  triggerKey,
  title: titleOverride,
  onClose,
}: {
  appCode: string;
  formKey: string;
  triggerKey?: string;
  title?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const actions = useSubmitActions(appCode, formKey);
  const connectors = useConnectors(appCode);
  const [type, setType] = useState<SubmitActionType>("email_pdf");
  const [name, setName] = useState("Email PDF");
  const [connectorId, setConnectorId] = useState("");
  const [configText, setConfigText] = useState(emailDefault);
  const [status, setStatus] = useState("");
  const visibleActions = useMemo(
    () => (triggerKey ? (actions.data ?? []).filter((action) => action.triggerKey === triggerKey) : actions.data ?? []),
    [actions.data, triggerKey],
  );

  const compatibleConnectors = useMemo(() => {
    const rows = connectors.data ?? [];
    if (type === "database") return rows.filter((connector) => connector.type === "database");
    if (type === "rest_api") return rows.filter((connector) => connector.type === "rest_api");
    return [] as ConnectorDto[];
  }, [connectors.data, type]);

  function changeType(nextType: SubmitActionType) {
    setType(nextType);
    if (nextType === "email_pdf") {
      setName("Email PDF");
      setConnectorId("");
      setConfigText(emailDefault);
    }
    if (nextType === "database") {
      setName("Write to database");
      const first = connectors.data?.find((connector) => connector.type === "database")?.id ?? "";
      setConnectorId(first);
      setConfigText(withConnector(databaseDefault, first));
    }
    if (nextType === "rest_api") {
      setName("Call REST API");
      const first = connectors.data?.find((connector) => connector.type === "rest_api")?.id ?? "";
      setConnectorId(first);
      setConfigText(withConnector(restDefault, first));
    }
  }

  function changeConnector(nextId: string) {
    setConnectorId(nextId);
    setConfigText((current) => withConnector(current, nextId));
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: qk.submitActions(appCode, formKey) });
  }

  async function createAction() {
    setStatus("Saving action...");
    try {
      const configJson = parseJsonObject(configText) as unknown as SubmitActionConfig;
      await api.createSubmitAction(appCode, formKey, {
        type,
        name,
        enabled: true,
        sortOrder: visibleActions.length * 10,
        triggerKey: triggerKey ?? null,
        connectorId: type === "email_pdf" ? null : connectorId,
        configJson,
      });
      setStatus("Action saved");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save action");
    }
  }

  async function updateAction(action: FormSubmitActionDto, patch: Partial<FormSubmitActionDto>) {
    setStatus("Updating action...");
    try {
      await api.updateSubmitAction(appCode, formKey, action.id, {
        name: patch.name,
        enabled: patch.enabled,
        sortOrder: patch.sortOrder,
        connectorId: patch.connectorId,
        configJson: patch.configJson,
      });
      setStatus("Action updated");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update action");
    }
  }

  async function deleteAction(action: FormSubmitActionDto) {
    const ok = window.confirm(`Delete submit action "${action.name}"?`);
    if (!ok) return;
    await api.deleteSubmitAction(appCode, formKey, action.id);
    await refresh();
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <header style={modalHeader}>
          <div>
            <h2 style={title}>Submit Actions</h2>
            <div style={meta}>{titleOverride ?? "Submit Actions"} | {appCode} / {formKey}{triggerKey ? ` / ${triggerKey}` : ""}</div>
          </div>
          <button type="button" style={closeButton} onClick={onClose}>×</button>
        </header>

        <div style={contentGrid}>
          <section style={panel}>
            <h3 style={panelTitle}>Configured actions</h3>
            {actions.isLoading ? <p>Loading...</p> : null}
            {visibleActions.map((action) => (
              <article key={action.id} style={actionCard}>
                <div>
                  <strong>{action.name}</strong>
                  <div style={meta}>{action.type} | order {action.sortOrder} | {action.enabled ? "enabled" : "disabled"}{action.triggerKey ? ` | button ${action.triggerKey}` : ""}</div>
                </div>
                <pre style={pre}>{JSON.stringify(action.configJson, null, 2)}</pre>
                <div style={rowActions}>
                  <button type="button" style={smallButton} onClick={() => void updateAction(action, { enabled: !action.enabled })}>
                    {action.enabled ? "Disable" : "Enable"}
                  </button>
                  <button type="button" style={smallButton} onClick={() => void updateAction(action, { sortOrder: action.sortOrder - 10 })}>Move up</button>
                  <button type="button" style={smallButton} onClick={() => void updateAction(action, { sortOrder: action.sortOrder + 10 })}>Move down</button>
                  <button type="button" style={dangerButton} onClick={() => void deleteAction(action)}>Delete</button>
                </div>
              </article>
            ))}
          </section>

          <section style={panel}>
            <h3 style={panelTitle}>Add action</h3>
            <label style={label}>
              Type
              <select value={type} onChange={(event) => changeType(event.target.value as SubmitActionType)} style={input}>
                <option value="email_pdf">Email PDF</option>
                <option value="database">Database</option>
                <option value="rest_api">REST API</option>
              </select>
            </label>
            <label style={label}>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} style={input} />
            </label>
            {type !== "email_pdf" ? (
              <label style={label}>
                Connector
                <select value={connectorId} onChange={(event) => changeConnector(event.target.value)} style={input}>
                  <option value="">Select connector</option>
                  {compatibleConnectors.map((connector) => (
                    <option key={connector.id} value={connector.id}>{connector.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label style={label}>
              Config JSON
              <textarea value={configText} onChange={(event) => setConfigText(event.target.value)} style={textarea} />
            </label>
            <pre style={pre}>{JSON.stringify(previewConfig(configText), null, 2)}</pre>
            <button type="button" style={primaryButton} onClick={() => void createAction()} disabled={!name.trim()}>
              Add submit action
            </button>
            {status ? <p style={statusText}>{status}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Config must be a JSON object");
  return parsed as Record<string, unknown>;
}

function withConnector(jsonText: string, connectorId: string) {
  try {
    const parsed = parseJsonObject(jsonText);
    parsed.connectorId = connectorId;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return jsonText;
  }
}

function previewConfig(value: string) {
  try {
    return parseJsonObject(value);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.38)", zIndex: 50, display: "grid", placeItems: "center", padding: 24 };
const modal: React.CSSProperties = { width: "min(1180px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 60px rgba(16, 24, 40, 0.24)" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, padding: 18, borderBottom: "1px solid #eaecf0" };
const title: React.CSSProperties = { margin: 0, fontSize: 22 };
const meta: React.CSSProperties = { color: "#667085", fontSize: 12, marginTop: 4 };
const closeButton: React.CSSProperties = { border: 0, background: "#fff", fontSize: 28, lineHeight: 1, cursor: "pointer" };
const contentGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, padding: 18 };
const panel: React.CSSProperties = { display: "grid", gap: 12, alignContent: "start" };
const panelTitle: React.CSSProperties = { margin: 0, fontSize: 16 };
const actionCard: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 10, padding: 12, display: "grid", gap: 10 };
const rowActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const label: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 700, fontSize: 13 };
const input: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: "9px 10px", font: "inherit" };
const textarea: React.CSSProperties = { ...input, minHeight: 240, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 8, background: "#111", color: "#fff", padding: "10px 12px", fontWeight: 700, cursor: "pointer" };
const smallButton: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", padding: "8px 10px", fontWeight: 700, cursor: "pointer" };
const dangerButton: React.CSSProperties = { ...smallButton, color: "#b42318", border: "1px solid #f0c7c2" };
const pre: React.CSSProperties = { margin: 0, padding: 10, borderRadius: 8, background: "#f8fafc", overflow: "auto", fontSize: 12 };
const statusText: React.CSSProperties = { margin: 0, color: "#475467" };
