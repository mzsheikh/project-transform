import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DataSourceDatasetMap, FormDefinition } from "@transform/contracts/form-types";
import { resolveDynamicValue } from "@transform/contracts/expressions";
import type { FormState } from "../renderer/types";

const DATASETS_PREFIX = "transform-mobile-datasets";

export type DatasetFetchResponse = {
  formKey: string;
  formVersion: number;
  datasets: Record<string, {
    rows: Record<string, unknown>[];
    fetchedAt: string;
    cacheTtlSeconds: number;
  }>;
};

export function rowsFromDatasetResponse(response: DatasetFetchResponse | null | undefined): DataSourceDatasetMap {
  if (!response) return {};
  return Object.fromEntries(
    Object.entries(response.datasets ?? {}).map(([key, dataset]) => [key, Array.isArray(dataset.rows) ? dataset.rows : []]),
  );
}

export async function getCachedDatasets(
  appCode: string,
  form: FormDefinition,
  data: FormState,
): Promise<DatasetFetchResponse | null> {
  const raw = await AsyncStorage.getItem(datasetCacheKey(appCode, form, data));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isDatasetFetchResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveCachedDatasets(
  appCode: string,
  form: FormDefinition,
  data: FormState,
  response: DatasetFetchResponse,
): Promise<void> {
  await AsyncStorage.setItem(datasetCacheKey(appCode, form, data), JSON.stringify(response));
}

function datasetCacheKey(appCode: string, form: FormDefinition, data: FormState): string {
  return `${DATASETS_PREFIX}:${appCode}:${form.formKey}:${form.version}:${paramHash(form, data)}`;
}

function paramHash(form: FormDefinition, data: FormState): string {
  const params = (form.dataSources ?? []).map((source) => {
    const resolved = resolveDynamicValue(source.params ?? {}, { rootData: data }, `dataSources.${source.key}.params`);
    return {
      key: source.key,
      params: resolved.errors.length > 0 ? {} : resolved.value,
    };
  });
  return hashString(stableJson(params));
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function isDatasetFetchResponse(value: unknown): value is DatasetFetchResponse {
  return !!value && typeof value === "object" && "datasets" in (value as Record<string, unknown>);
}
