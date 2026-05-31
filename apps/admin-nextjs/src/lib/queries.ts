/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { FormDto } from "./api";

// Centralized query keys so caches are shared consistently across pages.
export const qk = {
  apps: () => ["apps"] as const,
  forms: (appCode: string) => ["apps", appCode, "forms"] as const,
  connectors: (appCode: string) => ["apps", appCode, "connectors"] as const,
  connectorMappings: (appCode: string, connectorId: string) =>
    ["apps", appCode, "connectors", connectorId, "mappings"] as const,
  submitActions: (appCode: string, formKey: string) =>
    ["apps", appCode, "forms", formKey, "submitActions"] as const,
  latestPublishedByKey: (appCode: string, formKey: string) =>
    ["apps", appCode, "forms", formKey, "latestPublished"] as const,
    me: () => ["auth", "me"] as const,
};

// App list: used on /apps page.
export function useApps() {
  return useQuery({
    queryKey: qk.apps(), // cache key used to share app list across pages
    queryFn: api.listApps, // fetcher that returns the data for this key
  });
}

// Forms list for a given app; shared with form designer for reuse.
export function useForms(appCode: string) {
  return useQuery({
    queryKey: qk.forms(appCode), // stable key for this app's forms list
    queryFn: () => api.listForms(appCode), // fetch forms for the active app
    enabled: !!appCode, // skip fetch until we have a valid appCode
  });
}

// Draft selector built on top of the forms list cache to avoid extra fetches.
export function useDraftForm(appCode: string, formKey: string) {
  return useQuery({
    queryKey: qk.forms(appCode), // reuse the same cache as list page
    queryFn: () => api.listForms(appCode), // source data for the selector
    enabled: !!appCode && !!formKey, // don't fetch until both params exist
    select: (forms) =>
      // derive a single draft from the cached list without extra network calls
      forms.find(
        (f) => f.formKey === formKey && f.status === "draft" && f.version === 0
      ) ?? null,
  });
}

// Saves the draft schema and refreshes the forms cache.
export function useSaveDraft(appCode: string, formKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { schemaJson: any }) =>
      // write draft updates to the API
      api.updateDraftForm(appCode, formKey, { schemaJson: payload.schemaJson }),
    onSuccess: () => {
      // refresh list cache so UI shows the latest draft
      qc.invalidateQueries({ queryKey: qk.forms(appCode) });
    },
  });
}

// Publishes a form and invalidates list cache so UI reflects the new version.
export function usePublish(appCode: string, formKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.publishForm(appCode, formKey), // publish current draft
    onSuccess: () => {
      // re-fetch list so published version appears
      qc.invalidateQueries({ queryKey: qk.forms(appCode) });
      // if you have bootstrap/latest endpoints in admin too, invalidate them here
    },
  });
}

// Deletes all versions for a formKey and refreshes list cache.
export function useDeleteForm(appCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { formKey: string }) =>
      api.deleteForm(appCode, payload.formKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.forms(appCode) });
    },
  });
}

export function useConnectors(appCode: string) {
  return useQuery({
    queryKey: qk.connectors(appCode),
    queryFn: () => api.listConnectors(appCode),
    enabled: !!appCode,
  });
}

export function useConnectorMappings(appCode: string, connectorId: string) {
  return useQuery({
    queryKey: qk.connectorMappings(appCode, connectorId),
    queryFn: () => api.listConnectorMappings(appCode, connectorId),
    enabled: !!appCode && !!connectorId,
  });
}

export function useSubmitActions(appCode: string, formKey: string) {
  return useQuery({
    queryKey: qk.submitActions(appCode, formKey),
    queryFn: () => api.listSubmitActions(appCode, formKey),
    enabled: !!appCode && !!formKey,
  });
}

// Session fetch used by RequireAuth + login screen redirect logic.
export function useMe() {
  return useQuery({
    queryKey: qk.me(), // session cache key
    queryFn: api.me, // fetch current user from /auth/me
    retry: false, // don't spam /me when unauth
  });
}

// Login mutation: on success, refresh session cache so auth-gated pages render.
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      // perform login and set cookies
      api.login(payload),
    onSuccess: () => {
      // refresh session cache so auth-gated pages render
      qc.invalidateQueries({ queryKey: qk.me() });
    },
  });
}

// Logout mutation: clear session cache to prevent stale redirects.
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(), // clear cookies server-side
    onSettled: () => {
      // clear the cached session regardless of success/failure
      qc.removeQueries({ queryKey: qk.me() });
    },
  });
}
