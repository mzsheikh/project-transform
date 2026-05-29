/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type React from "react";
import { useState } from "react";
import type { DataSourceDefinition } from "@transform/contracts/form-types";
import { api } from "../../lib/api";
import { useConnectors } from "../../lib/queries";

type DataSourcesPanelProps = {
  appCode: string;
  formKey: string;
  dataSources: DataSourceDefinition[];
  onChange: (dataSources: DataSourceDefinition[]) => void;
  onClose: () => void;
};

export function DataSourcesPanel({ appCode, formKey, dataSources, onChange, onClose }: DataSourcesPanelProps) {
  const connectors = useConnectors(appCode);
  const [previewTextByIndex, setPreviewTextByIndex] = useState<Record<number, string>>({});
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});

  function patch(index: number, next: Partial<DataSourceDefinition>) {
    onChange(dataSources.map((source, i) => (i === index ? ({ ...source, ...next } as DataSourceDefinition) : source)));
  }

  function add(type: DataSourceDefinition["type"]) {
    onChange([...dataSources, defaultSource(type, dataSources.length + 1)]);
  }

  function remove(index: number) {
    onChange(dataSources.filter((_, i) => i !== index));
  }

  async function preview(index: number, source: DataSourceDefinition) {
    setPreviewingIndex(index);
    try {
      const result = await api.previewDataSource(appCode, formKey, { source: source as unknown as Record<string, unknown>, data: previewData });
      setPreviewTextByIndex((current) => ({
        ...current,
        [index]: JSON.stringify({ rows: result.rows, fetchedAt: result.fetchedAt }, null, 2),
      }));
    } catch (error: any) {
      setPreviewTextByIndex((current) => ({
        ...current,
        [index]: error.message ?? "Preview failed",
      }));
    } finally {
      setPreviewingIndex(null);
    }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <div style={header}>
          <div>
            <h2 style={title}>Data Sources</h2>
            <div style={hint}>Reusable database and REST reads available to expressions through DATA().</div>
          </div>
          <button type="button" style={closeBtn} onClick={onClose} aria-label="Close data sources">×</button>
        </div>

        <div style={toolbar}>
          <button type="button" style={primaryBtn} onClick={() => add("database")}>Add Database Source</button>
          <button type="button" style={secondaryBtn} onClick={() => add("rest_api")}>Add REST Source</button>
        </div>

        <div style={previewDataPanel}>
          <JsonField label="Preview Input Data JSON" value={previewData} onChange={(value) => setPreviewData(isRecord(value) ? value : {})} />
        </div>

        <div style={body}>
          {dataSources.length === 0 ? (
            <div style={empty}>No data sources yet. Add one to bind controls with DATA("key").</div>
          ) : null}

          {dataSources.map((source, index) => {
            const connectorOptions = (connectors.data ?? []).filter((connector) => connector.type === source.type);
            return (
              <div key={`${source.key}-${index}`} style={sourceCard}>
                <div style={sourceHeader}>
                  <strong>{source.key || `dataSource${index + 1}`}</strong>
                  <div style={sourceActions}>
                    <button type="button" style={secondaryBtn} onClick={() => void preview(index, source)} disabled={previewingIndex === index}>
                      {previewingIndex === index ? "Previewing..." : "Preview"}
                    </button>
                    <button type="button" style={dangerBtn} onClick={() => remove(index)}>Delete</button>
                  </div>
                </div>

                <div style={grid}>
                  <TextField label="Key" value={source.key} onChange={(key) => patch(index, { key } as Partial<DataSourceDefinition>)} />
                  <label style={label}>
                    Type
                    <select
                      style={input}
                      value={source.type}
                      onChange={(event) => {
                        const type = event.target.value as DataSourceDefinition["type"];
                        const next = defaultSource(type, index + 1);
                        patch(index, {
                          type,
                          connectorId: "",
                          config: next.config,
                        } as Partial<DataSourceDefinition>);
                      }}
                    >
                      <option value="database">Database</option>
                      <option value="rest_api">REST API</option>
                    </select>
                  </label>

                  <label style={label}>
                    Connector
                    <select
                      style={input}
                      value={source.connectorId}
                      onChange={(event) => patch(index, { connectorId: event.target.value } as Partial<DataSourceDefinition>)}
                    >
                      <option value="">Select connector...</option>
                      {connectorOptions.map((connector) => (
                        <option key={connector.id} value={connector.id}>{connector.name}</option>
                      ))}
                    </select>
                  </label>

                  <TextField
                    label="Cache TTL Seconds"
                    value={String(source.cacheTtlSeconds ?? 3600)}
                    inputType="number"
                    onChange={(value) => patch(index, { cacheTtlSeconds: numberOrUndefined(value) } as Partial<DataSourceDefinition>)}
                  />

                  <label style={inline}>
                    <input
                      type="checkbox"
                      checked={source.offlineRequired === true}
                      onChange={(event) => patch(index, { offlineRequired: event.target.checked } as Partial<DataSourceDefinition>)}
                    />
                    <span>Required for offline use</span>
                  </label>
                </div>

                <JsonField
                  label="Params JSON"
                  value={source.params ?? {}}
                  onChange={(params) => patch(index, { params } as Partial<DataSourceDefinition>)}
                />
                <JsonField
                  label={source.type === "database" ? "Database Config JSON" : "REST Config JSON"}
                  value={source.config ?? defaultSource(source.type, index + 1).config}
                  onChange={(config) => patch(index, { config } as Partial<DataSourceDefinition>)}
                />
                {previewTextByIndex[index] ? <pre style={previewBox}>{previewTextByIndex[index]}</pre> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function defaultSource(type: DataSourceDefinition["type"], index: number): DataSourceDefinition {
  if (type === "database") {
    return {
      key: `dataset${index}`,
      type,
      connectorId: "",
      cacheTtlSeconds: 3600,
      offlineRequired: false,
      params: {},
      config: {
        query: "SELECT id, name FROM table_name WHERE site_id = :siteId",
        limit: 500,
      },
    };
  }
  return {
    key: `dataset${index}`,
    type,
    connectorId: "",
    cacheTtlSeconds: 3600,
    offlineRequired: false,
    params: {},
    config: {
      method: "GET",
      pathTemplate: "/items",
      resultPath: "body",
    },
  };
}

function TextField({
  label,
  value,
  inputType = "text",
  onChange,
}: {
  label: string;
  value: string;
  inputType?: "text" | "number";
  onChange: (value: string) => void;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input style={input} type={inputType} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: any) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <textarea
        style={jsonInput}
        value={JSON.stringify(value, null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value));
          } catch {
            return;
          }
        }}
      />
    </label>
  );
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.35)",
  display: "grid",
  placeItems: "center",
  padding: 24,
};

const modal: React.CSSProperties = {
  width: "min(940px, 100%)",
  maxHeight: "90vh",
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 22px 70px rgba(16, 24, 40, 0.24)",
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  padding: "20px 22px 16px",
  borderBottom: "1px solid #e6ebf2",
};

const title: React.CSSProperties = { margin: 0, fontSize: 22, color: "#1f2937" };
const hint: React.CSSProperties = { marginTop: 5, color: "#667085", fontSize: 14 };
const closeBtn: React.CSSProperties = { border: 0, background: "transparent", color: "#667085", fontSize: 30, lineHeight: 1, cursor: "pointer" };

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "14px 22px",
  borderBottom: "1px solid #e6ebf2",
};

const previewDataPanel: React.CSSProperties = {
  padding: "14px 22px",
  borderBottom: "1px solid #e6ebf2",
};

const body: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 22,
  overflow: "auto",
};

const sourceCard: React.CSSProperties = {
  display: "grid",
  gap: 14,
  border: "1px solid #dfe6f0",
  borderRadius: 8,
  padding: 16,
};

const sourceHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: "#344054",
};
const sourceActions: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const labelStyle: React.CSSProperties = { display: "grid", gap: 8, fontWeight: 800, color: "#344054", fontSize: 13 };
const label = labelStyle;
const inline: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", fontWeight: 800, color: "#344054", fontSize: 14 };
const input: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #dfe6f0",
  color: "#344054",
  background: "#fff",
};
const jsonInput: React.CSSProperties = { ...input, height: 140, fontFamily: "monospace", whiteSpace: "pre" };
const previewBox: React.CSSProperties = {
  margin: 0,
  maxHeight: 220,
  overflow: "auto",
  border: "1px solid #dfe6f0",
  borderRadius: 8,
  padding: 12,
  background: "#f8fafc",
  color: "#344054",
  fontSize: 12,
};
const primaryBtn: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: "#0b2a66", color: "#fff", fontWeight: 900, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: "10px 14px", background: "#fff", color: "#344054", fontWeight: 900, cursor: "pointer" };
const dangerBtn: React.CSSProperties = { border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", background: "#fff", color: "#b42318", fontWeight: 900, cursor: "pointer" };
const empty: React.CSSProperties = { padding: 16, color: "#667085", border: "1px dashed #cbd5e1", borderRadius: 8 };
