import AsyncStorage from "@react-native-async-storage/async-storage";

const VARIABLES_PREFIX = "transform-mobile-global-variables";

export async function loadGlobalVariables(appCode: string): Promise<Record<string, unknown>> {
  const raw = await AsyncStorage.getItem(globalVariablesKey(appCode));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function saveGlobalVariables(appCode: string, variables: Record<string, unknown>): Promise<void> {
  await AsyncStorage.setItem(globalVariablesKey(appCode), JSON.stringify(variables));
}

function globalVariablesKey(appCode: string) {
  return `${VARIABLES_PREFIX}:${appCode}`;
}
