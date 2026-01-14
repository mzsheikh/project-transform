import { API_BASE_URL } from "../config";
import type { FormDefinition } from "@contracts/form-types";

export type BootstrapFormItem = {
  formKey: string;
  title: string;
  version: number;
  description?: string | null;
};

export type BootstrapResponse = {
  app: { appCode: string; name: string; settings: any };
  forms: BootstrapFormItem[];
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

export const api = {
  bootstrap: (appCode: string) =>
    req<BootstrapResponse>(`/apps/${encodeURIComponent(appCode)}/bootstrap`),

  latestForm: async (appCode: string, formKey: string) => {
    // Nest returns the Form row; schemaJson is what we need to render
    const row = await req<{ schemaJson: FormDefinition }>(
      `/apps/${encodeURIComponent(appCode)}/forms/${encodeURIComponent(formKey)}/latest`,
    );
    return row.schemaJson;
  },
};