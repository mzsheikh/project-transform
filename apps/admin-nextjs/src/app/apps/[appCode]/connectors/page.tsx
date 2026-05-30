"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectorDto, ConnectorInput, DatabaseProvider, RestAuthMode } from "@transform/contracts/action-types";
import { api } from "../../../../lib/api";
import { qk, useConnectors } from "../../../../lib/queries";

type ConnectorKind = DatabaseProvider | "rest_api";
type WizardStep = "type" | "config";

type HeaderRow = { id: string; key: string; value: string };

type ConnectorForm = {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  schema: string;
  ssl: boolean;
  trustServerCertificate: boolean;
  connectionString: string;
  password: string;
  baseUrl: string;
  testPath: string;
  authMode: RestAuthMode;
  apiKeyName: string;
  apiKeyLocation: "header" | "query";
  apiKey: string;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  defaultHeaders: HeaderRow[];
};

type DatabaseSchemaColumn = {
  schema?: string | null;
  table: string;
  column: string;
  dataType: string;
  nullable: boolean;
};

const connectorTypes: Array<{
  kind: ConnectorKind;
  title: string;
  subtitle: string;
  accent: string;
}> = [
  { kind: "postgresql", title: "PostgreSQL", subtitle: "Read and write through a PostgreSQL database connector.", accent: "#336791" },
  { kind: "mysql", title: "MySQL", subtitle: "Connect to MySQL-compatible operational databases.", accent: "#00758f" },
  { kind: "sqlserver", title: "MS SQL Server", subtitle: "Connect to Microsoft SQL Server databases.", accent: "#a91d22" },
  { kind: "rest_api", title: "REST API", subtitle: "Call HTTP APIs with configured authentication.", accent: "#175cd3" },
];

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

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("type");
  const [kind, setKind] = useState<ConnectorKind>("postgresql");
  const [form, setForm] = useState<ConnectorForm>(() => defaultConnectorForm("postgresql"));
  const [createStatus, setCreateStatus] = useState("");
  const [createResult, setCreateResult] = useState<unknown>(null);
  const [pageStatus, setPageStatus] = useState("");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [ddlText, setDdlText] = useState(ddlExample);
  const [schemaByConnector, setSchemaByConnector] = useState<Record<string, DatabaseSchemaColumn[]>>({});
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const connectorCount = connectors.data?.length ?? 0;
  const selectedConnector = (connectors.data ?? []).find((connector) => connector.id === selectedConnectorId) ?? null;
  const generatedJson = useMemo(() => {
    try {
      const input = connectorInput(false);
      return JSON.stringify({ configJson: input.configJson, secretsJson: input.secretsJson }, null, 2);
    } catch {
      return "";
    }
  }, [form, kind]);

  function selectKind(next: ConnectorKind) {
    setKind(next);
    setForm(defaultConnectorForm(next));
    setCreateStatus("");
    setCreateResult(null);
  }

  function openWizard() {
    setWizardOpen(true);
    setSelectedConnectorId(null);
    setWizardStep("type");
    setKind("postgresql");
    setForm(defaultConnectorForm("postgresql"));
    setCreateStatus("");
    setCreateResult(null);
  }

  function patchForm(patch: Partial<ConnectorForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function connectorInput(requireName: boolean): ConnectorInput {
    const trimmedName = form.name.trim();
    if (requireName && !trimmedName) throw new Error("Connector name is required.");

    if (kind === "rest_api") {
      const auth = buildRestAuth(form);
      return {
        name: trimmedName || "Unsaved REST API connector",
        type: "rest_api",
        provider: null,
        configJson: compactRecord({
          baseUrl: form.baseUrl.trim(),
          testPath: form.testPath.trim() || "/",
          auth,
          defaultHeaders: headersToRecord(form.defaultHeaders),
        }),
        secretsJson: compactRecord({
          apiKey: form.authMode === "api_key" ? form.apiKey : "",
          bearerToken: form.authMode === "bearer" ? form.bearerToken : "",
          username: form.authMode === "basic" ? form.basicUsername : "",
          password: form.authMode === "basic" ? form.basicPassword : "",
          clientId: form.authMode === "oauth2_client_credentials" ? form.clientId : "",
          clientSecret: form.authMode === "oauth2_client_credentials" ? form.clientSecret : "",
        }),
      };
    }

    return {
      name: trimmedName || `Unsaved ${connectorTypeTitle(kind)} connector`,
      type: "database",
      provider: kind,
      configJson: compactRecord({
        host: form.host.trim(),
        port: numberOrUndefined(form.port),
        database: form.database.trim(),
        username: form.username.trim(),
        schema: form.schema.trim(),
        ssl: form.ssl,
        trustServerCertificate: kind === "sqlserver" ? form.trustServerCertificate : undefined,
      }),
      secretsJson: compactRecord({
        connectionString: form.connectionString.trim(),
        password: form.password,
      }),
    };
  }

  async function createConnector() {
    setCreateStatus("Creating connector...");
    setCreateResult(null);
    try {
      await api.createConnector(appCode, connectorInput(true));
      setCreateStatus("Connector created.");
      setWizardOpen(false);
      await qc.invalidateQueries({ queryKey: qk.connectors(appCode) });
    } catch (error) {
      setCreateStatus(error instanceof Error ? error.message : "Failed to create connector.");
    }
  }

  async function testNewConnector() {
    setCreateStatus("Testing connection...");
    setCreateResult(null);
    try {
      const result = await api.testConnectorInput(appCode, connectorInput(false));
      setCreateResult(result);
      setCreateStatus("Connection test complete.");
    } catch (error) {
      setCreateStatus(error instanceof Error ? error.message : "Connection test failed.");
    }
  }

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setPageStatus(`${label}...`);
    setActionResult(null);
    try {
      const next = await fn();
      setActionResult(next);
      setPageStatus(`${label} complete.`);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : `${label} failed.`);
    }
  }

  async function inspectSchema(connector: ConnectorDto) {
    setPageStatus("Inspecting schema...");
    setActionResult(null);
    try {
      const result = await api.inspectConnectorSchema(appCode, connector.id);
      const columns = normalizeSchemaColumns(result.columns);
      setSchemaByConnector((current) => ({ ...current, [connector.id]: columns }));
      const first = groupSchemaColumns(columns)[0];
      if (first) {
        setExpandedTables((current) => ({ ...current, [`${connector.id}:${first.key}`]: true }));
      }
      setPageStatus(`Schema inspection complete: ${columns.length} columns.`);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Schema inspection failed.");
    }
  }

  return (
    <main style={page}>
      <header style={hero}>
        <div>
          <div style={eyebrow}>Transform Data</div>
          <h1 style={title}>{appCode} Connectors</h1>
          <p style={subtitle}>Manage database and REST API integrations used by data sources and submit actions.</p>
        </div>
        <div style={heroActions}>
          <Link href={`/apps/${appCode}`} style={secondaryLink}>Back to forms</Link>
          <button type="button" style={primaryButton} onClick={openWizard}>
            <PlusIcon /> Add new connector
          </button>
        </div>
      </header>

      <section style={summaryStrip}>
        <Metric label="Configured connectors" value={String(connectorCount)} />
        <Metric label="Database" value={String((connectors.data ?? []).filter((connector) => connector.type === "database").length)} />
        <Metric label="REST API" value={String((connectors.data ?? []).filter((connector) => connector.type === "rest_api").length)} />
      </section>

      {wizardOpen ? (
        <section style={wizardPanel}>
          <div style={wizardHeader}>
            <div>
              <h2 style={panelTitle}>Add connector</h2>
              <div style={stepLine}>
                <StepPill active={wizardStep === "type"} label="1. Type" />
                <StepPill active={wizardStep === "config"} label="2. Configuration" />
              </div>
            </div>
            <button type="button" style={iconButton} onClick={() => setWizardOpen(false)} aria-label="Close connector wizard">
              <CloseIcon />
            </button>
          </div>

          {wizardStep === "type" ? (
            <>
              <div style={typeGrid}>
                {connectorTypes.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    style={{ ...typeCard, ...(kind === item.kind ? selectedTypeCard : null) }}
                    onClick={() => selectKind(item.kind)}
                  >
                    <span style={{ ...typeIcon, color: item.accent }}>
                      {item.kind === "rest_api" ? <RestIcon /> : <DatabaseIcon />}
                    </span>
                    <span style={typeCardTitle}>{item.title}</span>
                    <span style={typeCardText}>{item.subtitle}</span>
                  </button>
                ))}
              </div>
              <div style={wizardFooter}>
                <button type="button" style={secondaryButton} onClick={() => setWizardOpen(false)}>Cancel</button>
                <button type="button" style={primaryButton} onClick={() => setWizardStep("config")}>Next</button>
              </div>
            </>
          ) : (
            <>
              <section style={configGrid}>
                <div style={configSection}>
                  <h3 style={sectionTitle}>{connectorTypeTitle(kind)} settings</h3>
                  <TextField label="Connector name" value={form.name} placeholder="Production CRM" onChange={(name) => patchForm({ name })} />
                  {kind === "rest_api" ? (
                    <RestFields form={form} patchForm={patchForm} />
                  ) : (
                    <DatabaseFields kind={kind} form={form} patchForm={patchForm} />
                  )}
                </div>
                <div style={configAside}>
                  <h3 style={sectionTitle}>Generated JSON</h3>
                  <p style={smallText}>These values are what will be sent to the connector API. Secrets are stored encrypted by the backend.</p>
                  <pre style={jsonPreview}>{generatedJson}</pre>
                </div>
              </section>
              <div style={wizardFooter}>
                <button type="button" style={secondaryButton} onClick={() => setWizardStep("type")}>Back</button>
                <button type="button" style={secondaryButton} onClick={() => void testNewConnector()}>Test connection</button>
                <button type="button" style={primaryButton} onClick={() => void createConnector()} disabled={!form.name.trim()}>Create connector</button>
              </div>
              {createStatus ? <p style={statusText}>{createStatus}</p> : null}
              {createResult ? <pre style={resultBox}>{JSON.stringify(createResult, null, 2)}</pre> : null}
            </>
          )}
        </section>
      ) : null}

      {!wizardOpen && !selectedConnector ? (
      <section style={listSection}>
        <div style={sectionHeader}>
          <h2 style={panelTitle}>Configured connectors</h2>
          {pageStatus ? <span style={statusInline}>{pageStatus}</span> : null}
        </div>
        {connectors.isLoading ? <p style={mutedText}>Loading connectors...</p> : null}
        {connectors.error ? <p style={errorText}>{(connectors.error as Error).message}</p> : null}
        {!connectors.isLoading && (connectors.data ?? []).length === 0 ? (
          <div style={emptyState}>
            <div style={emptyIcon}><DatabaseIcon /></div>
            <div>
              <strong>No connectors yet</strong>
              <p style={mutedText}>Add a database or REST API connector to power data sources and submit actions.</p>
            </div>
          </div>
        ) : null}

        {(connectors.data ?? []).map((connector) => (
          <article key={connector.id} style={connectorListRow}>
            <button type="button" style={connectorListMain} onClick={() => { setWizardOpen(false); setSelectedConnectorId(connector.id); }}>
              <div style={connectorMeta}>
                <span style={connectorIcon}>{connector.type === "rest_api" ? <RestIcon /> : <DatabaseIcon />}</span>
                <div>
                  <h3 style={connectorName}>{connector.name}</h3>
                  <p style={connectorDetail}>{connectorTypeLabel(connector)}</p>
                </div>
              </div>
            </button>
            <span style={typeBadge}>{connectorTypeLabel(connector)}</span>
            <button
              type="button"
              style={iconButton}
              onClick={() => { setWizardOpen(false); setSelectedConnectorId(connector.id); }}
              aria-label={`Open ${connector.name}`}
              title={`Open ${connector.name}`}
            >
              <ArrowRightIcon />
            </button>
          </article>
        ))}
      </section>
      ) : null}

      {!wizardOpen && selectedConnector ? (
          <section style={detailsWindow}>
            <div style={detailsHeader}>
              <div style={connectorMeta}>
                <span style={connectorIcon}>{selectedConnector.type === "rest_api" ? <RestIcon /> : <DatabaseIcon />}</span>
                <div>
                  <h2 style={detailsTitle}>{selectedConnector.name}</h2>
                  <p style={connectorDetail}>{connectorSummary(selectedConnector)}</p>
                </div>
              </div>
              <button type="button" style={iconButton} onClick={() => setSelectedConnectorId(null)} aria-label="Close connector details">
                <CloseIcon />
              </button>
            </div>

            <div style={detailsActions}>
              <button type="button" style={secondaryButton} onClick={() => void runAction("Connection test", () => api.testConnector(appCode, selectedConnector.id))}>
                Test connection
              </button>
              {selectedConnector.type === "database" ? (
                <button type="button" style={secondaryButton} onClick={() => void inspectSchema(selectedConnector)}>
                  Inspect schema
                </button>
              ) : null}
              <button type="button" style={dangerButton} onClick={async () => {
                const ok = window.confirm(`Delete connector "${selectedConnector.name}"?`);
                if (!ok) return;
                await api.deleteConnector(appCode, selectedConnector.id);
                setSelectedConnectorId(null);
                await qc.invalidateQueries({ queryKey: qk.connectors(appCode) });
              }}>
                Delete
              </button>
            </div>

            {pageStatus ? <p style={statusText}>{pageStatus}</p> : null}

            <div style={detailsBody}>
              <section style={detailsSection}>
                <h3 style={sectionTitle}>Configuration</h3>
                <div style={configSummary}>
                  {Object.entries(selectedConnector.configJson ?? {}).map(([key, value]) => (
                    <div key={key} style={configItem}>
                      <span style={configKey}>{key}</span>
                      <span style={configValue}>{formatConfigValue(value)}</span>
                    </div>
                  ))}
                  <div style={configItem}>
                    <span style={configKey}>secrets</span>
                    <span style={configValue}>{selectedConnector.hasSecrets ? "stored" : "none"}</span>
                  </div>
                </div>
              </section>

              {selectedConnector.type === "database" ? (
                <DatabaseTools
                  appCode={appCode}
                  connector={selectedConnector}
                  ddlText={ddlText}
                  setDdlText={setDdlText}
                  runAction={runAction}
                />
              ) : null}

              {schemaByConnector[selectedConnector.id] ? (
                <SchemaExplorer
                  connectorId={selectedConnector.id}
                  columns={schemaByConnector[selectedConnector.id]}
                  expandedTables={expandedTables}
                  setExpandedTables={setExpandedTables}
                />
              ) : null}

              {actionResult ? (
                <section style={detailsSection}>
                  <div style={sectionHeader}>
                    <h3 style={sectionTitle}>Latest action result</h3>
                    <button type="button" style={textButton} onClick={() => setActionResult(null)}>Clear</button>
                  </div>
                  <pre style={resultBox}>{JSON.stringify(actionResult, null, 2)}</pre>
                </section>
              ) : null}
            </div>
          </section>
      ) : null}
    </main>
  );
}

function DatabaseFields({
  kind,
  form,
  patchForm,
}: {
  kind: Exclude<ConnectorKind, "rest_api">;
  form: ConnectorForm;
  patchForm: (patch: Partial<ConnectorForm>) => void;
}) {
  return (
    <div style={fieldGrid}>
      <TextField label="Host" value={form.host} placeholder="db.company.internal" onChange={(host) => patchForm({ host })} />
      <TextField label="Port" value={form.port} placeholder={defaultPort(kind)} onChange={(port) => patchForm({ port })} />
      <TextField label="Database" value={form.database} placeholder="operations" onChange={(database) => patchForm({ database })} />
      <TextField label="Username" value={form.username} placeholder="connector_user" onChange={(username) => patchForm({ username })} />
      {kind === "postgresql" ? (
        <TextField label="Schema" value={form.schema} placeholder="public" onChange={(schema) => patchForm({ schema })} />
      ) : null}
      <PasswordField label="Password" value={form.password} onChange={(password) => patchForm({ password })} />
      <TextField label="Connection string override" value={form.connectionString} placeholder="Optional" onChange={(connectionString) => patchForm({ connectionString })} />
      <ToggleField label="SSL" checked={form.ssl} onChange={(ssl) => patchForm({ ssl })} />
      {kind === "sqlserver" ? (
        <ToggleField label="Trust server certificate" checked={form.trustServerCertificate} onChange={(trustServerCertificate) => patchForm({ trustServerCertificate })} />
      ) : null}
    </div>
  );
}

function RestFields({ form, patchForm }: { form: ConnectorForm; patchForm: (patch: Partial<ConnectorForm>) => void }) {
  return (
    <div style={fieldGrid}>
      <TextField label="Base URL" value={form.baseUrl} placeholder="https://api.example.com" onChange={(baseUrl) => patchForm({ baseUrl })} />
      <TextField label="Test path" value={form.testPath} placeholder="/health" onChange={(testPath) => patchForm({ testPath })} />
      <label style={fieldLabel}>
        Authentication
        <select style={input} value={form.authMode} onChange={(event) => patchForm({ authMode: event.target.value as RestAuthMode })}>
          <option value="none">None</option>
          <option value="api_key">API key</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="oauth2_client_credentials">OAuth2 client credentials</option>
        </select>
      </label>
      {form.authMode === "api_key" ? (
        <>
          <TextField label="API key name" value={form.apiKeyName} placeholder="X-API-Key" onChange={(apiKeyName) => patchForm({ apiKeyName })} />
          <label style={fieldLabel}>
            API key location
            <select style={input} value={form.apiKeyLocation} onChange={(event) => patchForm({ apiKeyLocation: event.target.value as "header" | "query" })}>
              <option value="header">Header</option>
              <option value="query">Query string</option>
            </select>
          </label>
          <PasswordField label="API key" value={form.apiKey} onChange={(apiKey) => patchForm({ apiKey })} />
        </>
      ) : null}
      {form.authMode === "bearer" ? <PasswordField label="Bearer token" value={form.bearerToken} onChange={(bearerToken) => patchForm({ bearerToken })} /> : null}
      {form.authMode === "basic" ? (
        <>
          <TextField label="Username" value={form.basicUsername} onChange={(basicUsername) => patchForm({ basicUsername })} />
          <PasswordField label="Password" value={form.basicPassword} onChange={(basicPassword) => patchForm({ basicPassword })} />
        </>
      ) : null}
      {form.authMode === "oauth2_client_credentials" ? (
        <>
          <TextField label="Token URL" value={form.tokenUrl} onChange={(tokenUrl) => patchForm({ tokenUrl })} />
          <TextField label="Client ID" value={form.clientId} onChange={(clientId) => patchForm({ clientId })} />
          <PasswordField label="Client secret" value={form.clientSecret} onChange={(clientSecret) => patchForm({ clientSecret })} />
          <TextField label="Scope" value={form.scope} placeholder="Optional" onChange={(scope) => patchForm({ scope })} />
        </>
      ) : null}
      <HeaderEditor rows={form.defaultHeaders} onChange={(defaultHeaders) => patchForm({ defaultHeaders })} />
    </div>
  );
}

function HeaderEditor({ rows, onChange }: { rows: HeaderRow[]; onChange: (rows: HeaderRow[]) => void }) {
  return (
    <div style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
      Default headers
      <div style={headerEditor}>
        {rows.map((row) => (
          <div key={row.id} style={headerRow}>
            <input style={input} value={row.key} placeholder="Header name" onChange={(event) => onChange(rows.map((item) => item.id === row.id ? { ...item, key: event.target.value } : item))} />
            <input style={input} value={row.value} placeholder="Header value" onChange={(event) => onChange(rows.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item))} />
            <button type="button" style={iconButton} onClick={() => onChange(rows.filter((item) => item.id !== row.id))} aria-label="Remove header">
              <TrashIcon />
            </button>
          </div>
        ))}
        <button type="button" style={secondaryButton} onClick={() => onChange([...rows, { id: randomId(), key: "", value: "" }])}>
          Add header
        </button>
      </div>
    </div>
  );
}

function DatabaseTools({
  appCode,
  connector,
  ddlText,
  setDdlText,
  runAction,
}: {
  appCode: string;
  connector: ConnectorDto;
  ddlText: string;
  setDdlText: (value: string) => void;
  runAction: (label: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <details style={toolPanel}>
      <summary style={toolSummary}>DDL tools</summary>
      <div style={tipBox}>
        <strong>Preview DDL</strong> generates the SQL statements that would be created from this mapping and does not change the database. <strong>Apply DDL</strong> executes those statements on the selected connector, so use it after reviewing the preview.
      </div>
      <textarea value={ddlText} onChange={(event) => setDdlText(event.target.value)} style={ddlTextarea} />
      <div style={rowActions}>
        <button type="button" style={secondaryButton} onClick={() => void runAction("DDL preview", () => api.previewConnectorDdl(appCode, connector.id, parseJsonObject(ddlText, "DDL config")))}>
          Preview DDL
        </button>
        <button type="button" style={primaryButton} onClick={() => {
          const ok = window.confirm("Apply this DDL to the connected database?");
          if (ok) void runAction("DDL apply", () => api.applyConnectorDdl(appCode, connector.id, parseJsonObject(ddlText, "DDL config")));
        }}>
          Apply DDL
        </button>
      </div>
    </details>
  );
}

function SchemaExplorer({
  connectorId,
  columns,
  expandedTables,
  setExpandedTables,
}: {
  connectorId: string;
  columns: DatabaseSchemaColumn[];
  expandedTables: Record<string, boolean>;
  setExpandedTables: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const tables = groupSchemaColumns(columns);
  return (
    <section style={schemaPanel}>
      <h4 style={schemaTitle}>Database schema</h4>
      <div style={schemaList}>
        {tables.map((table) => {
          const key = `${connectorId}:${table.key}`;
          const expanded = expandedTables[key] === true;
          return (
            <div key={table.key} style={tableBlock}>
              <button
                type="button"
                style={tableHeader}
                onClick={() => setExpandedTables((current) => ({ ...current, [key]: !expanded }))}
              >
                <span>{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                <span style={tableName}>{table.label}</span>
                <span style={tableCount}>{table.columns.length} columns</span>
              </button>
              {expanded ? (
                <table style={columnsTable}>
                  <thead>
                    <tr>
                      <th style={th}>Column</th>
                      <th style={th}>Type</th>
                      <th style={th}>Nullable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((column) => (
                      <tr key={`${table.key}:${column.column}`}>
                        <td style={td}>{column.column}</td>
                        <td style={td}>{column.dataType}</td>
                        <td style={td}>{column.nullable ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldLabel}>
      {label}
      <input style={input} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={fieldLabel}>
      {label}
      <input style={input} type="password" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={toggleField}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metric}>
      <span style={metricValue}>{value}</span>
      <span style={metricLabel}>{label}</span>
    </div>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return <span style={{ ...stepPill, ...(active ? stepPillActive : null) }}>{label}</span>;
}

function defaultConnectorForm(kind: ConnectorKind): ConnectorForm {
  return {
    name: "",
    host: "localhost",
    port: defaultPort(kind),
    database: "target_db",
    username: "target_user",
    schema: kind === "postgresql" ? "public" : "",
    ssl: false,
    trustServerCertificate: true,
    connectionString: "",
    password: "",
    baseUrl: "https://api.example.com",
    testPath: "/",
    authMode: "none",
    apiKeyName: "X-API-Key",
    apiKeyLocation: "header",
    apiKey: "",
    bearerToken: "",
    basicUsername: "",
    basicPassword: "",
    tokenUrl: "",
    clientId: "",
    clientSecret: "",
    scope: "",
    defaultHeaders: [],
  };
}

function buildRestAuth(form: ConnectorForm) {
  if (form.authMode === "none") return { mode: "none" };
  if (form.authMode === "api_key") {
    return compactRecord({ mode: "api_key", name: form.apiKeyName.trim() || "X-API-Key", location: form.apiKeyLocation });
  }
  if (form.authMode === "oauth2_client_credentials") {
    return compactRecord({ mode: "oauth2_client_credentials", tokenUrl: form.tokenUrl.trim(), scope: form.scope.trim() });
  }
  return { mode: form.authMode };
}

function connectorTypeTitle(kind: ConnectorKind) {
  if (kind === "postgresql") return "PostgreSQL";
  if (kind === "mysql") return "MySQL";
  if (kind === "sqlserver") return "MS SQL Server";
  return "REST API";
}

function defaultPort(kind: ConnectorKind) {
  if (kind === "mysql") return "3306";
  if (kind === "sqlserver") return "1433";
  if (kind === "postgresql") return "5432";
  return "";
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  );
}

function headersToRecord(rows: HeaderRow[]) {
  const headers = Object.fromEntries(rows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value]));
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeSchemaColumns(value: unknown[]): DatabaseSchemaColumn[] {
  return value.filter(isRecord).map((column) => ({
    schema: typeof column.schema === "string" ? column.schema : null,
    table: String(column.table ?? ""),
    column: String(column.column ?? ""),
    dataType: String(column.dataType ?? ""),
    nullable: column.nullable === true,
  })).filter((column) => column.table && column.column);
}

function groupSchemaColumns(columns: DatabaseSchemaColumn[]) {
  const grouped = new Map<string, { key: string; label: string; columns: DatabaseSchemaColumn[] }>();
  columns.forEach((column) => {
    const label = column.schema ? `${column.schema}.${column.table}` : column.table;
    const key = label;
    const existing = grouped.get(key) ?? { key, label, columns: [] };
    existing.columns.push(column);
    grouped.set(key, existing);
  });
  return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function connectorSummary(connector: ConnectorDto) {
  if (connector.type === "rest_api") {
    const baseUrl = typeof connector.configJson?.baseUrl === "string" ? connector.configJson.baseUrl : "REST API";
    return `${baseUrl} | secrets: ${connector.hasSecrets ? "stored" : "none"}`;
  }
  const host = typeof connector.configJson?.host === "string" ? connector.configJson.host : "database";
  const database = typeof connector.configJson?.database === "string" ? connector.configJson.database : "";
  return `${connector.provider ?? "database"} | ${[host, database].filter(Boolean).join(" / ")} | secrets: ${connector.hasSecrets ? "stored" : "none"}`;
}

function connectorTypeLabel(connector: ConnectorDto) {
  if (connector.type === "rest_api") return "REST API";
  if (connector.provider === "postgresql") return "PostgreSQL";
  if (connector.provider === "mysql") return "MySQL";
  if (connector.provider === "sqlserver") return "MS SQL Server";
  return "Database";
}

function formatConfigValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

const page: React.CSSProperties = { padding: 24, fontFamily: "system-ui", color: "#111827", background: "#fff", display: "grid", gap: 20 };
const hero: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 };
const heroActions: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const eyebrow: React.CSSProperties = { fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1, color: "#667085", fontWeight: 800 };
const title: React.CSSProperties = { margin: "6px 0 0", fontSize: 32, lineHeight: 1.1 };
const subtitle: React.CSSProperties = { margin: "8px 0 0", color: "#667085", maxWidth: 660 };
const summaryStrip: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 };
const metric: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: 14, display: "grid", gap: 4, background: "#fcfcfd" };
const metricValue: React.CSSProperties = { fontSize: 24, fontWeight: 900 };
const metricLabel: React.CSSProperties = { color: "#667085", fontSize: 13, fontWeight: 700 };
const wizardPanel: React.CSSProperties = { border: "1px solid #b2ccff", borderRadius: 8, padding: 18, display: "grid", gap: 18, background: "#f8fbff" };
const wizardHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" };
const panelTitle: React.CSSProperties = { margin: 0, fontSize: 20 };
const stepLine: React.CSSProperties = { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" };
const stepPill: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 999, padding: "6px 10px", color: "#667085", background: "#fff", fontWeight: 800, fontSize: 12 };
const stepPillActive: React.CSSProperties = { borderColor: "#175cd3", color: "#175cd3", background: "#eff6ff" };
const typeGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 };
const typeCard: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: 16, background: "#fff", textAlign: "left", cursor: "pointer", display: "grid", gap: 10 };
const selectedTypeCard: React.CSSProperties = { borderColor: "#175cd3", boxShadow: "0 0 0 3px rgba(47, 111, 237, 0.12)" };
const typeIcon: React.CSSProperties = { width: 42, height: 42, borderRadius: 8, background: "#f2f4f7", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const typeCardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 900 };
const typeCardText: React.CSSProperties = { color: "#667085", fontSize: 13, lineHeight: 1.4 };
const wizardFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
const configGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.7fr)", gap: 16 };
const configSection: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", padding: 16, display: "grid", gap: 14 };
const configAside: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", padding: 16, display: "grid", gap: 10, alignContent: "start" };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 15, color: "#344054" };
const fieldGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
const fieldLabel: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 800, fontSize: 13, color: "#344054" };
const input: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: "10px 12px", font: "inherit", background: "#fff", color: "#111827", minWidth: 0 };
const toggleField: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, fontWeight: 800, color: "#344054", fontSize: 13, paddingTop: 26 };
const headerEditor: React.CSSProperties = { display: "grid", gap: 8 };
const headerRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto", gap: 8 };
const jsonPreview: React.CSSProperties = { margin: 0, padding: 12, borderRadius: 8, background: "#0f172a", color: "#e2e8f0", overflow: "auto", fontSize: 12, maxHeight: 430 };
const resultBox: React.CSSProperties = { margin: 0, padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e4e7ec", overflow: "auto", fontSize: 12 };
const listSection: React.CSSProperties = { display: "grid", gap: 12 };
const sectionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const connectorListRow: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, padding: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 12, alignItems: "center", background: "#fcfcfd" };
const connectorListMain: React.CSSProperties = { border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", textAlign: "left", cursor: "pointer", minWidth: 0 };
const connectorMeta: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", minWidth: 0 };
const connectorIcon: React.CSSProperties = { width: 44, height: 44, borderRadius: 8, background: "#eef4ff", color: "#175cd3", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" };
const connectorName: React.CSSProperties = { margin: 0, fontSize: 18 };
const connectorDetail: React.CSSProperties = { margin: "4px 0 0", color: "#667085", fontSize: 13 };
const typeBadge: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 999, padding: "6px 10px", background: "#fff", color: "#344054", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" };
const rowActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
const configSummary: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 };
const configItem: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, padding: "9px 10px", display: "grid", gap: 3, background: "#fff" };
const configKey: React.CSSProperties = { color: "#667085", fontSize: 11, fontWeight: 900, textTransform: "uppercase" };
const configValue: React.CSSProperties = { color: "#344054", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const toolPanel: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, padding: 12, background: "#fff" };
const toolSummary: React.CSSProperties = { cursor: "pointer", fontWeight: 900, color: "#344054" };
const tipBox: React.CSSProperties = { marginTop: 12, border: "1px solid #fedf89", borderRadius: 8, background: "#fffcf5", padding: 12, color: "#7a2e0e", fontSize: 13, lineHeight: 1.45 };
const ddlTextarea: React.CSSProperties = { ...input, minHeight: 170, marginTop: 12, width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
const schemaPanel: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, background: "#fff", padding: 12, display: "grid", gap: 10 };
const schemaTitle: React.CSSProperties = { margin: 0, fontSize: 15 };
const schemaList: React.CSSProperties = { display: "grid", gap: 8 };
const tableBlock: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, overflow: "hidden" };
const tableHeader: React.CSSProperties = { width: "100%", border: 0, background: "#f8fafc", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", textAlign: "left" };
const tableName: React.CSSProperties = { fontWeight: 900, color: "#344054", flex: 1 };
const tableCount: React.CSSProperties = { color: "#667085", fontSize: 12, fontWeight: 800 };
const columnsTable: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "#fff" };
const th: React.CSSProperties = { textAlign: "left", color: "#667085", fontSize: 12, padding: "9px 12px", borderBottom: "1px solid #e4e7ec" };
const td: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid #f2f4f7", fontSize: 13, color: "#344054" };
const emptyState: React.CSSProperties = { border: "1px dashed #d0d5dd", borderRadius: 8, padding: 18, display: "flex", gap: 12, alignItems: "center", background: "#fcfcfd" };
const emptyIcon: React.CSSProperties = { width: 42, height: 42, borderRadius: 8, background: "#eef4ff", color: "#175cd3", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const detailsWindow: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", padding: 18, display: "grid", gap: 16, boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)" };
const detailsHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", borderBottom: "1px solid #e4e7ec", paddingBottom: 14 };
const detailsTitle: React.CSSProperties = { margin: 0, fontSize: 22 };
const detailsActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const detailsBody: React.CSSProperties = { display: "grid", gap: 14 };
const detailsSection: React.CSSProperties = { border: "1px solid #e4e7ec", borderRadius: 8, padding: 14, display: "grid", gap: 12, background: "#fff" };
const statusText: React.CSSProperties = { margin: 0, color: "#475467" };
const statusInline: React.CSSProperties = { color: "#475467", fontSize: 13, fontWeight: 700 };
const smallText: React.CSSProperties = { margin: 0, color: "#667085", fontSize: 13, lineHeight: 1.45 };
const mutedText: React.CSSProperties = { margin: 0, color: "#667085", fontSize: 13 };
const errorText: React.CSSProperties = { color: "#b42318", margin: 0 };
const primaryButton: React.CSSProperties = { border: 0, borderRadius: 8, background: "#0b2a66", color: "#fff", padding: "10px 12px", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" };
const secondaryButton: React.CSSProperties = { border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", color: "#111827", padding: "10px 12px", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" };
const dangerButton: React.CSSProperties = { ...secondaryButton, color: "#b42318", border: "1px solid #f0c7c2" };
const secondaryLink: React.CSSProperties = { ...secondaryButton };
const iconButton: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", color: "#344054", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const textButton: React.CSSProperties = { border: 0, background: "transparent", color: "#175cd3", fontWeight: 900, cursor: "pointer" };
const iconSvg: React.CSSProperties = { width: 20, height: 20, display: "block" };

function DatabaseIcon() {
  return <svg viewBox="0 0 24 24" style={iconSvg} aria-hidden><ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" stroke="currentColor" strokeWidth="2" fill="none" /></svg>;
}

function RestIcon() {
  return <svg viewBox="0 0 24 24" style={iconSvg} aria-hidden><path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z" stroke="currentColor" strokeWidth="2" fill="none" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 20 20" style={iconSvg} aria-hidden><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" style={iconSvg} aria-hidden><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function TrashIcon() {
  return <svg viewBox="0 0 20 20" style={iconSvg} aria-hidden><path d="M3 5h14M7 5V3h6v2M6 5l1 12h6l1-12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronRightIcon() {
  return <svg viewBox="0 0 20 20" style={iconSvg} aria-hidden><path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronDownIcon() {
  return <svg viewBox="0 0 20 20" style={iconSvg} aria-hidden><path d="m4 7 6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ArrowRightIcon() {
  return <svg viewBox="0 0 20 20" style={iconSvg} aria-hidden><path d="M4 10h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="m11 5 5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
}
