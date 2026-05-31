import { API_BASE_URL } from "../config";
import type { FormDefinition } from "@transform/contracts/form-types";
import type { SubmissionAcceptedResponse } from "@transform/contracts/action-types";
import type { SubmissionPayload } from "@transform/contracts/submission-types";
import type { FormState, RendererVariables } from "../renderer/types";
import type { DatasetFetchResponse } from "../storage/datasets";

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
    credentials: "include",
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

  submitForm: (payload: SubmissionPayload) =>
    req<SubmissionAcceptedResponse>(
      `/apps/${encodeURIComponent(payload.appCode)}/forms/${encodeURIComponent(payload.formKey)}/submissions`,
      {
        method: "POST",
        body: JSON.stringify({
          submissionId: payload.submissionId,
          formVersion: payload.formVersion,
          triggerKey: payload.triggerKey,
          variables: payload.variables,
          data: payload.data,
          createdAt: payload.createdAt,
          updatedAt: payload.updatedAt,
        }),
      },
    ),

  fetchDatasets: (appCode: string, form: FormDefinition, data: FormState, variables?: RendererVariables) =>
    req<DatasetFetchResponse>(
      `/apps/${encodeURIComponent(appCode)}/forms/${encodeURIComponent(form.formKey)}/datasets`,
      {
        method: "POST",
        body: JSON.stringify({
          formVersion: form.version,
          data,
          variables,
        }),
      },
    ),
};
