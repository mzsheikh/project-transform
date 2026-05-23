"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ButtonAction } from "@transform/contracts/form-types";
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

export function ButtonActionConfigDialog({
  appCode,
  formKey,
  buttonKey,
  action,
  actionIndex,
  onBeforeSaveSchema,
  onPatchAction,
  onClose,
}: {
  appCode: string;
  formKey: string;
  buttonKey: string;
  action: ButtonAction;
  actionIndex: number;
  onBeforeSaveSchema: () => Promise<void>;
  onPatchAction: (patch: Partial<ButtonAction>) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const actions = useSubmitActions(appCode, formKey);
  const connectors = useConnectors(appCode);
  const submitType = normalizeSubmitActionType(action.type);
  const existing = useMemo(
    () => findLinkedSubmitAction(actions.data ?? [], buttonKey, action.id),
    [actions.data, buttonKey, action.id],
  );
  const [name, setName] = useState(defaultName(submitType));
  const [enabled, setEnabled] = useState(action.enabled !== false);
  const [connectorId, setConnectorId] = useState("");
  const [configText, setConfigText] = useState(defaultConfigText(submitType, ""));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const firstConnector = firstConnectorId(connectors.data ?? [], submitType);
    if (existing && existing.type === submitType) {
      setName(existing.name);
      setEnabled(existing.enabled);
      setConnectorId(existing.connectorId ?? "");
      setConfigText(JSON.stringify(existing.configJson, null, 2));
      return;
    }
    setName(defaultName(submitType));
    setEnabled(action.enabled !== false);
    setConnectorId(firstConnector);
    setConfigText(defaultConfigText(submitType, firstConnector));
  }, [action.enabled, existing, connectors.data, submitType]);

  const compatibleConnectors = useMemo(() => {
    const rows = connectors.data ?? [];
    if (submitType === "database") return rows.filter((connector) => connector.type === "database");
    if (submitType === "rest_api") return rows.filter((connector) => connector.type === "rest_api");
    return [] as ConnectorDto[];
  }, [connectors.data, submitType]);

  function changeConnector(nextId: string) {
    setConnectorId(nextId);
    setConfigText((current) => withConnector(current, nextId));
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: qk.submitActions(appCode, formKey) });
  }

  async function saveAction() {
    setStatus("Saving action...");
    setError("");
    try {
      const configJson = parseJsonObject(configText) as unknown as SubmitActionConfig;
      const nextConnectorId = submitType === "email_pdf" ? null : connectorId || readConnectorId(configJson);
      if (submitType !== "email_pdf" && !nextConnectorId) {
        throw new Error("Select a connector for this action.");
      }

      await onBeforeSaveSchema();
      const payload = {
        type: submitType,
        name: name.trim() || defaultName(submitType),
        enabled,
        sortOrder: Math.max(0, actionIndex) * 10,
        triggerKey: buttonKey,
        buttonActionId: action.id,
        connectorId: nextConnectorId,
        configJson,
      };

      if (existing) {
        await api.updateSubmitAction(appCode, formKey, existing.id, payload);
      } else {
        await api.createSubmitAction(appCode, formKey, payload);
      }
      onPatchAction({ enabled });
      setStatus("Action saved");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save action";
      setError(message);
      setStatus("");
    }
  }

  async function deleteConfig() {
    if (!existing) {
      onClose();
      return;
    }
    const ok = window.confirm(`Delete configuration for "${existing.name}"?`);
    if (!ok) return;
    setStatus("Deleting configuration...");
    setError("");
    try {
      await api.deleteSubmitAction(appCode, formKey, existing.id);
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete configuration");
      setStatus("");
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <header style={modalHeader}>
          <div>
            <h2 style={title}>Configure Action</h2>
            <div style={meta}>{actionLabel(submitType)} | {appCode} / {formKey} / {buttonKey}</div>
          </div>
          <button type="button" style={closeButton} onClick={onClose}>×</button>
        </header>

        <section style={content}>
          <label style={label}>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} style={input} />
          </label>

          <label style={checkLabel}>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>

          {submitType !== "email_pdf" ? (
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

          {error ? <div style={errorText}>{error}</div> : null}
          {status ? <div style={statusText}>{status}</div> : null}

          <div style={rowActions}>
            <button type="button" style={primaryButton} onClick={() => void saveAction()} disabled={!name.trim()}>
              Save Configuration
            </button>
            <button type="button" style={dangerButton} onClick={() => void deleteConfig()} disabled={!existing}>
              Delete Configuration
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function normalizeSubmitActionType(type: ButtonAction["type"] | string): SubmitActionType {
  if (type === "database" || type === "rest_api" || type === "email_pdf") return type;
  return "email_pdf";
}

function findLinkedSubmitAction(actions: FormSubmitActionDto[], buttonKey: string, buttonActionId: string) {
  return actions.find((item) => item.triggerKey === buttonKey && item.buttonActionId === buttonActionId) ?? null;
}

function firstConnectorId(connectors: ConnectorDto[], type: SubmitActionType) {
  if (type === "database") return connectors.find((connector) => connector.type === "database")?.id ?? "";
  if (type === "rest_api") return connectors.find((connector) => connector.type === "rest_api")?.id ?? "";
  return "";
}

function defaultName(type: SubmitActionType) {
  if (type === "database") return "Submit to Database";
  if (type === "rest_api") return "Submit to REST API";
  return "Email PDF";
}

function actionLabel(type: SubmitActionType) {
  return defaultName(type);
}

function defaultConfigText(type: SubmitActionType, connectorId: string) {
  if (type === "database") return withConnector(databaseDefault, connectorId);
  if (type === "rest_api") return withConnector(restDefault, connectorId);
  return emailDefault;
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

function readConnectorId(config: SubmitActionConfig) {
  const record = config as unknown as Record<string, unknown>;
  return typeof record.connectorId === "string"
    ? record.connectorId
    : null;
}

function previewConfig(value: string) {
  try {
    return parseJsonObject(value);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.38)", zIndex: 50, display: "grid", placeItems: "center", padding: 24 };
const modal: React.CSSProperties = { width: "min(760px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 60px rgba(16, 24, 40, 0.24)" };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, padding: 18, borderBottom: "1px solid #eaecf0" };
const title: React.CSSProperties = { margin: 0, fontSize: 22 };
const meta: React.CSSProperties = { color: "#667085", fontSize: 12, marginTop: 4 };
const closeButton: React.CSSProperties = { border: 0, background: "#fff", fontSize: 28, lineHeight: 1, cursor: "pointer" };
const content: React.CSSProperties = { display: "grid", gap: 14, padding: 18 };
const rowActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const label: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 700, fontSize: 13 };
const checkLabel: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", fontWeight: 700, fontSize: 13 };
const input: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: "9px 10px", font: "inherit" };
const textarea: React.CSSProperties = { ...input, minHeight: 240, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 8, background: "#111", color: "#fff", padding: "10px 12px", fontWeight: 700, cursor: "pointer" };
const dangerButton: React.CSSProperties = { border: "1px solid #f0c7c2", borderRadius: 8, background: "#fff", color: "#b42318", padding: "10px 12px", fontWeight: 700, cursor: "pointer" };
const pre: React.CSSProperties = { margin: 0, padding: 10, borderRadius: 8, background: "#f8fafc", overflow: "auto", fontSize: 12 };
const statusText: React.CSSProperties = { margin: 0, color: "#475467" };
const errorText: React.CSSProperties = { margin: 0, color: "#b42318", fontWeight: 700 };
