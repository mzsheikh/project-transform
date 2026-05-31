/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ConnectorDto,
  ConnectorInput,
  FormDatabaseMappingDto,
  FormDatabaseMappingInput,
  FormDatabaseMappingSaveResult,
  FormSubmitActionDto,
  FormSubmitActionInput,
} from "@transform/contracts/action-types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export type AppDto = {
  appCode: string;
  name: string;
  settings: any;
  createdAt: string;
};

export type FormDto = {
  id: string;
  appCode: string;
  formKey: string;
  version: number;
  status: "draft" | "published" | "archived";
  title: string;
  description?: string | null;
  schemaJson: any;
  createdAt: string;
};

export type DataSourcePreviewDto = {
  key: string;
  fetchedAt: string;
  cacheTtlSeconds: number;
  rows: Record<string, unknown>[];
};

async function req<T>(path: string, init?: RequestInit, retryOnUnauthorized = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // IMPORTANT: remove cache: "no-store" for React Query usage
  });

  if (res.status === 401 && retryOnUnauthorized && !path.startsWith("/auth/")) {
    await req<{ ok: boolean }>("/auth/refresh", { method: "POST" }, false);
    return req<T>(path, init, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  listApps: () => req<AppDto[]>("/apps"),
  createApp: (body: { appCode: string; name: string }) =>
    req<AppDto>("/apps", { method: "POST", body: JSON.stringify(body) }),

  listForms: (appCode: string) => req<FormDto[]>(`/apps/${appCode}/forms`),

  createDraftForm: (
    appCode: string,
    body: {
      formKey: string;
      title: string;
      description?: string;
      schemaJson: any;
    }
  ) =>
    req<FormDto>(`/apps/${appCode}/forms`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateDraftForm: (
    appCode: string,
    formKey: string,
    body: { title?: string; description?: string; schemaJson?: any }
  ) =>
    req<FormDto>(`/apps/${appCode}/forms/${formKey}/draft`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  publishForm: (appCode: string, formKey: string) =>
    req<FormDto>(`/apps/${appCode}/forms/${formKey}/publish`, {
      method: "POST",
    }),

  deleteForm: (appCode: string, formKey: string) =>
    req<{ deleted: number }>(`/apps/${appCode}/forms/${formKey}`, {
      method: "DELETE",
    }),

  previewDataSource: (
    appCode: string,
    formKey: string,
    body: { source: Record<string, unknown>; data?: Record<string, unknown> },
  ) =>
    req<DataSourcePreviewDto>(`/apps/${appCode}/forms/${formKey}/datasets/preview`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listConnectors: (appCode: string) =>
    req<ConnectorDto[]>(`/apps/${appCode}/connectors`),

  createConnector: (appCode: string, body: ConnectorInput) =>
    req<ConnectorDto>(`/apps/${appCode}/connectors`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  testConnectorInput: (appCode: string, body: ConnectorInput) =>
    req<{ ok: boolean; result: Record<string, unknown> }>(`/apps/${appCode}/connectors/test-config`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateConnector: (appCode: string, connectorId: string, body: Partial<ConnectorInput>) =>
    req<ConnectorDto>(`/apps/${appCode}/connectors/${connectorId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  testConnectorUpdate: (appCode: string, connectorId: string, body: Partial<ConnectorInput>) =>
    req<{ ok: boolean; result: Record<string, unknown> }>(`/apps/${appCode}/connectors/${connectorId}/test-config`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteConnector: (appCode: string, connectorId: string) =>
    req<{ deleted: boolean }>(`/apps/${appCode}/connectors/${connectorId}`, {
      method: "DELETE",
    }),

  testConnector: (appCode: string, connectorId: string) =>
    req<{ ok: boolean; result: Record<string, unknown> }>(
      `/apps/${appCode}/connectors/${connectorId}/test`,
      { method: "POST" },
    ),

  inspectConnectorSchema: (appCode: string, connectorId: string) =>
    req<{ columns: unknown[] }>(`/apps/${appCode}/connectors/${connectorId}/schema`),

  listConnectorMappings: (appCode: string, connectorId: string) =>
    req<FormDatabaseMappingDto[]>(`/apps/${appCode}/connectors/${connectorId}/mappings`),

  generateConnectorMapping: (appCode: string, connectorId: string, body: { formKey: string }) =>
    req<Omit<FormDatabaseMappingDto, "id" | "createdAt" | "updatedAt">>(
      `/apps/${appCode}/connectors/${connectorId}/mappings/generate`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  saveConnectorMapping: (appCode: string, connectorId: string, body: FormDatabaseMappingInput) =>
    req<FormDatabaseMappingSaveResult>(`/apps/${appCode}/connectors/${connectorId}/mappings`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getConnectorMapping: (appCode: string, connectorId: string, mappingId: string) =>
    req<FormDatabaseMappingDto>(`/apps/${appCode}/connectors/${connectorId}/mappings/${mappingId}`),

  previewConnectorDdl: (appCode: string, connectorId: string, config: Record<string, unknown>) =>
    req<{ statements: string[] }>(`/apps/${appCode}/connectors/${connectorId}/ddl/preview`, {
      method: "POST",
      body: JSON.stringify({ config }),
    }),

  applyConnectorDdl: (appCode: string, connectorId: string, config: Record<string, unknown>) =>
    req<{ applied: boolean; statements: string[] }>(`/apps/${appCode}/connectors/${connectorId}/ddl/apply`, {
      method: "POST",
      body: JSON.stringify({ config }),
    }),

  listSubmitActions: (appCode: string, formKey: string) =>
    req<FormSubmitActionDto[]>(`/apps/${appCode}/forms/${formKey}/submit-actions`),

  createSubmitAction: (appCode: string, formKey: string, body: FormSubmitActionInput) =>
    req<FormSubmitActionDto>(`/apps/${appCode}/forms/${formKey}/submit-actions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateSubmitAction: (
    appCode: string,
    formKey: string,
    actionId: string,
    body: Partial<FormSubmitActionInput>,
  ) =>
    req<FormSubmitActionDto>(`/apps/${appCode}/forms/${formKey}/submit-actions/${actionId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteSubmitAction: (appCode: string, formKey: string, actionId: string) =>
    req<{ deleted: boolean }>(`/apps/${appCode}/forms/${formKey}/submit-actions/${actionId}`, {
      method: "DELETE",
    }),

  login: (body: { email: string; password: string }) =>
    req<{ ok: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () =>
    req<{ id: string; email: string; role: "viewer" | "editor" | "admin" }>(
      "/auth/me"
    ),

  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  refresh: () => req<{ ok: boolean }>("/auth/refresh", { method: "POST" }),
};
