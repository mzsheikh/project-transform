/* eslint-disable @typescript-eslint/no-explicit-any */
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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // IMPORTANT: remove cache: "no-store" for React Query usage
  });

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
