"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectorInput, ConnectorType, DatabaseProvider } from "@transform/contracts/action-types";
import { api } from "../../../../lib/api";
import { qk, useConnectors } from "../../../../lib/queries";

const databaseConfig = JSON.stringify(
  { host: "localhost", port: 5432, database: "target_db", username: "target_user", schema: "public", ssl: false },
  null,
  2,
);
const databaseSecrets = JSON.stringify({ password: "replace-me" }, null, 2);
const restConfig = JSON.stringify({ baseUrl: "https://api.example.com", auth: { mode: "none" } }, null, 2);
const ddlExample = JSON.stringify(
  {
    tables: [
      {
        tableName: "inspection_submissions",
        source: "root",
        includeMetadataColumns: true,
        columns: [{ sourceKey: "customerName", targetField: "customer_name", type: "text" }],
      },
    ],
  },
  null,
  2,
);

export default function ConnectorsPage() {
  const params = useParams<{ appCode?: string }>();
  const appCodeParam = params?.appCode;
  const appCode = Array.isArray(appCodeParam) ? appCodeParam[0] : appCodeParam ?? "";
  const connectors = useConnectors(appCode);
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<ConnectorType>("database");
  const [provider, setProvider] = useState<DatabaseProvider>("postgresql");
  const [configText, setConfigText] = useState(databaseConfig);
  const [secretsText, setSecretsText] = useState(databaseSecrets);
  const [ddlText, setDdlText] = useState(ddlExample);
  const [status, setStatus] = useState("");
  const [createResult, setCreateResult] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);

  function changeType(nextType: ConnectorType) {
    setType(nextType);
    if (nextType === "database") {
      setConfigText(databaseConfig);
      setSecretsText(databaseSecrets);
    } else {
      setConfigText(restConfig);
      setSecretsText("{}");
    }
  }

  async function createConnector() {
    setStatus("Creating connector...");
    setCreateResult(null);
    try {
      const body = connectorInput(true);
      await api.createConnector(appCode, body);
      setName("");
      setStatus("Connector created");
      await qc.invalidateQueries({ queryKey: qk.connectors(appCode) });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create connector");
    }
  }

  async function testNewConnector() {
    setStatus("Testing connection...");
    setCreateResult(null);
    try {
      const next = await api.testConnectorInput(appCode, connectorInput(false));
      setCreateResult(next);
      setStatus("Connection test complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection test failed");
    }
  }

  function connectorInput(requireName: boolean): ConnectorInput {
    const trimmedName = name.trim();
    if (requireName && !trimmedName) throw new Error("Name is required");
    return {
      name: trimmedName || "Unsaved connector",
      type,
      provider: type === "database" ? provider : null,
      configJson: parseJsonObject(configText, "config"),
      secretsJson: parseJsonObject(secretsText, "secrets"),
    };
  }

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setStatus(`${label}...`);
    setResult(null);
    try {
      const next = await fn();
      setResult(next);
      setStatus(`${label} complete`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed`);
    }
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <div style={eyebrow}>Transform Data</div>
          <h1 style={title}>{appCode} Connectors</h1>
        </div>
        <Link href={`/apps/${appCode}`} style={secondaryLink}>Back to forms</Link>
      </header>

      <section style={grid}>
        <form
          style={panel}
          onSubmit={(event) => {
            event.preventDefault();
            void createConnector();
          }}
        >
          <h2 style={panelTitle}>New connector</h2>
          <label style={fieldLabel}>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} style={input} placeholder="Production CRM" />
          </label>
          <label style={fieldLabel}>
            Type
            <select value={type} onChange={(event) => changeType(event.target.value as ConnectorType)} style={input}>
              <option value="database">Database</option>
              <option value="rest_api">REST API</option>
            </select>
          </label>
          {type === "database" ? (
            <label style={fieldLabel}>
              Provider
              <select value={provider} onChange={(event) => setProvider(event.target.value as DatabaseProvider)} style={input}>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlserver">SQL Server</option>
              </select>
            </label>
          ) : null}
          <label style={fieldLabel}>
            Config JSON
            <textarea value={configText} onChange={(event) => setConfigText(event.target.value)} style={textarea} />
          </label>
          <label style={fieldLabel}>
            Secrets JSON
            <textarea value={secretsText} onChange={(event) => setSecretsText(event.target.value)} style={textareaSmall} />
          </label>
          <div style={formActions}>
            <button
              type="button"
              style={secondaryButton}
              onClick={() => void testNewConnector()}
            >
              Test connection
            </button>
            <button type="submit" style={primaryButton} disabled={!name.trim()}>Create connector</button>
          </div>
          {status ? <p style={statusText}>{status}</p> : null}
          {createResult ? <pre style={pre}>{JSON.stringify(createResult, null, 2)}</pre> : null}
        </form>

        <section style={panel}>
          <h2 style={panelTitle}>DDL preview/apply</h2>
          <textarea value={ddlText} onChange={(event) => setDdlText(event.target.value)} style={textarea} />
          <p style={hint}>Select a database connector below, then preview or apply this approved table mapping.</p>
          {result ? <pre style={pre}>{JSON.stringify(result, null, 2)}</pre> : null}
        </section>
      </section>

      <section style={list}>
        <h2 style={panelTitle}>Configured connectors</h2>
        {connectors.isLoading ? <p>Loading...</p> : null}
        {connectors.error ? <p style={errorText}>{(connectors.error as Error).message}</p> : null}
        {(connectors.data ?? []).map((connector) => (
          <article key={connector.id} style={card}>
            <div>
              <h3 style={cardTitle}>{connector.name}</h3>
              <p style={cardMeta}>
                {connector.type === "database" ? connector.provider : "REST API"} | secrets: {connector.hasSecrets ? "stored" : "none"}
              </p>
              <pre style={pre}>{JSON.stringify(connector.configJson, null, 2)}</pre>
            </div>
            <div style={cardActions}>
              <button type="button" style={secondaryButton} onClick={() => void runAction("Connection test", () => api.testConnector(appCode, connector.id))}>
                Test
              </button>
              {connector.type === "database" ? (
                <>
                  <button type="button" style={secondaryButton} onClick={() => void runAction("Schema inspection", () => api.inspectConnectorSchema(appCode, connector.id))}>
                    Inspect schema
                  </button>
                  <button type="button" style={secondaryButton} onClick={() => void runAction("DDL preview", () => api.previewConnectorDdl(appCode, connector.id, parseJsonObject(ddlText, "DDL config")))}>
                    Preview DDL
                  </button>
                  <button type="button" style={primaryButton} onClick={() => {
                    const ok = window.confirm("Apply this DDL to the connected database?");
                    if (ok) void runAction("DDL apply", () => api.applyConnectorDdl(appCode, connector.id, parseJsonObject(ddlText, "DDL config")));
                  }}>
                    Apply DDL
                  </button>
                </>
              ) : null}
              <button type="button" style={dangerButton} onClick={async () => {
                const ok = window.confirm(`Delete connector "${connector.name}"?`);
                if (!ok) return;
                await api.deleteConnector(appCode, connector.id);
                await qc.invalidateQueries({ queryKey: qk.connectors(appCode) });
              }}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

const page: React.CSSProperties = { padding: 24, fontFamily: "system-ui", color: "#111", display: "grid", gap: 20 };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" };
const eyebrow: React.CSSProperties = { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1, color: "#667085", fontWeight: 700 };
const title: React.CSSProperties = { margin: "6px 0 0", fontSize: 32 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 };
const panel: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 12, padding: 16, display: "grid", gap: 12, alignContent: "start" };
const panelTitle: React.CSSProperties = { margin: 0, fontSize: 18 };
const fieldLabel: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 700, fontSize: 13 };
const input: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: "10px 12px", font: "inherit" };
const textarea: React.CSSProperties = { ...input, minHeight: 220, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
const textareaSmall: React.CSSProperties = { ...textarea, minHeight: 110 };
const formActions: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 8, background: "#111", color: "#fff", padding: "10px 12px", fontWeight: 700, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", color: "#111", padding: "10px 12px", fontWeight: 700, cursor: "pointer" };
const dangerButton: React.CSSProperties = { ...secondaryButton, color: "#b42318", border: "1px solid #f0c7c2" };
const secondaryLink: React.CSSProperties = { ...secondaryButton, textDecoration: "none" };
const statusText: React.CSSProperties = { margin: 0, color: "#475467" };
const hint: React.CSSProperties = { margin: 0, color: "#667085", fontSize: 13 };
const pre: React.CSSProperties = { margin: 0, padding: 12, borderRadius: 8, background: "#f8fafc", overflow: "auto", fontSize: 12 };
const list: React.CSSProperties = { display: "grid", gap: 12 };
const card: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 12, padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16 };
const cardTitle: React.CSSProperties = { margin: 0, fontSize: 18 };
const cardMeta: React.CSSProperties = { margin: "4px 0 12px", color: "#667085" };
const cardActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignContent: "start", maxWidth: 420 };
const errorText: React.CSSProperties = { color: "#b42318" };
