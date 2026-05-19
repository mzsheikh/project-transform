import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FormState } from "../renderer/types";

const DRAFTS_PREFIX = "transform-mobile-drafts";

export type SavedDraft = {
  id: string;
  appCode: string;
  formKey: string;
  formTitle: string;
  formVersion: number;
  data: FormState;
  createdAt: string;
  updatedAt: string;
};

function draftsKey(appCode: string) {
  return `${DRAFTS_PREFIX}:${appCode}`;
}

export async function listDrafts(appCode: string): Promise<SavedDraft[]> {
  const raw = await AsyncStorage.getItem(draftsKey(appCode));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedDraft)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  } catch {
    return [];
  }
}

export async function saveDraft(input: {
  appCode: string;
  formKey: string;
  formTitle: string;
  formVersion: number;
  data: FormState;
  draftId?: string;
}): Promise<SavedDraft> {
  const now = new Date().toISOString();
  const existing = await listDrafts(input.appCode);
  const draftIndex = input.draftId ? existing.findIndex((draft) => draft.id === input.draftId) : -1;
  const previous = draftIndex >= 0 ? existing[draftIndex] : null;
  const draft: SavedDraft = {
    id: previous?.id ?? makeDraftId(input.appCode, input.formKey),
    appCode: input.appCode,
    formKey: input.formKey,
    formTitle: input.formTitle,
    formVersion: input.formVersion,
    data: input.data,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  const next = draftIndex >= 0 ? existing.map((item, index) => (index === draftIndex ? draft : item)) : [draft, ...existing];
  await AsyncStorage.setItem(draftsKey(input.appCode), JSON.stringify(next));
  return draft;
}

export async function deleteDraft(appCode: string, draftId: string): Promise<void> {
  const existing = await listDrafts(appCode);
  await AsyncStorage.setItem(draftsKey(appCode), JSON.stringify(existing.filter((draft) => draft.id !== draftId)));
}

function makeDraftId(appCode: string, formKey: string) {
  return `${appCode}:${formKey}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function isSavedDraft(value: unknown): value is SavedDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as SavedDraft;
  return (
    typeof draft.id === "string" &&
    typeof draft.appCode === "string" &&
    typeof draft.formKey === "string" &&
    typeof draft.formTitle === "string" &&
    typeof draft.formVersion === "number" &&
    typeof draft.createdAt === "string" &&
    typeof draft.updatedAt === "string" &&
    !!draft.data &&
    typeof draft.data === "object"
  );
}
