import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { FormDefinition } from "@transform/contracts/form-types";
import { api, type BootstrapFormItem } from "../api/client";
import { FormRenderer } from "../renderer/FormRenderer";
import type { FormState } from "../renderer/types";
import { deleteDraft, listDrafts, saveDraft, type SavedDraft } from "../storage/drafts";

type Tab = "forms" | "drafts" | "settings";

type Stage =
  | { kind: "enterAppCode" }
  | { kind: "loadingBootstrap" }
  | { kind: "home"; appCode: string; forms: BootstrapFormItem[]; drafts: SavedDraft[]; activeTab: Tab }
  | { kind: "loadingForm"; appCode: string; forms: BootstrapFormItem[]; drafts: SavedDraft[]; activeTab: Tab; formKey: string }
  | {
      kind: "renderForm";
      appCode: string;
      formKey: string;
      form: FormDefinition;
      forms: BootstrapFormItem[];
      drafts: SavedDraft[];
      draftId?: string;
      initialData?: FormState;
    };

export function AppBootstrapScreen() {
  const [appCodeInput, setAppCodeInput] = useState("DEMO01");
  const [stage, setStage] = useState<Stage>({ kind: "enterAppCode" });
  const [error, setError] = useState<string>("");
  const [refreshingForms, setRefreshingForms] = useState(false);
  const [refreshingDrafts, setRefreshingDrafts] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(undefined);

  const title = useMemo(() => {
    switch (stage.kind) {
      case "enterAppCode":
        return "Enter App Code";
      case "loadingBootstrap":
        return "Loading...";
      case "home":
        return stage.appCode;
      case "loadingForm":
        return "Loading form...";
      case "renderForm":
        return stage.form.title ?? stage.formKey;
    }
  }, [stage]);

  async function loadBootstrap() {
    const appCode = appCodeInput.trim().toUpperCase();
    if (!appCode) return;

    setError("");
    setStage({ kind: "loadingBootstrap" });

    try {
      const boot = await api.bootstrap(appCode);
      const drafts = await listDrafts(boot.app.appCode);
      setStage({ kind: "home", appCode: boot.app.appCode, forms: boot.forms, drafts, activeTab: "forms" });
    } catch (e: any) {
      setError(e.message ?? "Failed to bootstrap");
      setStage({ kind: "enterAppCode" });
    }
  }

  async function refreshDrafts(appCode: string) {
    setRefreshingDrafts(true);
    try {
      const drafts = await listDrafts(appCode);
      setStage((current) => {
        if (current.kind === "home" || current.kind === "loadingForm") return { ...current, drafts };
        if (current.kind === "renderForm") return { ...current, drafts };
        return current;
      });
    } finally {
      setRefreshingDrafts(false);
    }
  }

  async function openForm(appCode: string, formKey: string, forms: BootstrapFormItem[], drafts: SavedDraft[], activeTab: Tab) {
    setError("");
    setCurrentDraftId(undefined);
    setStage({ kind: "loadingForm", appCode, formKey, forms, drafts, activeTab });

    try {
      const form = await api.latestForm(appCode, formKey);
      setStage({ kind: "renderForm", appCode, formKey, form, forms, drafts });
    } catch (e: any) {
      setError(e.message ?? "Failed to load form");
      setStage({ kind: "home", appCode, forms, drafts, activeTab });
    }
  }

  async function openDraft(appCode: string, draft: SavedDraft, forms: BootstrapFormItem[], drafts: SavedDraft[]) {
    setError("");
    setCurrentDraftId(draft.id);
    setStage({ kind: "loadingForm", appCode, formKey: draft.formKey, forms, drafts, activeTab: "drafts" });

    try {
      const form = await api.latestForm(appCode, draft.formKey);
      setStage({
        kind: "renderForm",
        appCode,
        formKey: draft.formKey,
        form,
        forms,
        drafts,
        draftId: draft.id,
        initialData: draft.data,
      });
    } catch (e: any) {
      setError(e.message ?? "Failed to load draft form");
      setStage({ kind: "home", appCode, forms, drafts, activeTab: "drafts" });
    }
  }

  async function refreshForms(appCode: string) {
    setError("");
    setRefreshingForms(true);

    try {
      const boot = await api.bootstrap(appCode);
      const drafts = await listDrafts(boot.app.appCode);
      setStage((current) => {
        if (current.kind === "home") {
          return { ...current, appCode: boot.app.appCode, forms: boot.forms, drafts };
        }
        if (current.kind === "loadingForm") {
          return { ...current, forms: boot.forms, drafts };
        }
        return current;
      });
    } catch (e: any) {
      setError(e.message ?? "Failed to refresh forms");
    } finally {
      setRefreshingForms(false);
    }
  }

  function goHome(nextDrafts?: SavedDraft[]) {
    if (stage.kind !== "renderForm") return;
    setStage({
      kind: "home",
      appCode: stage.appCode,
      forms: stage.forms,
      drafts: nextDrafts ?? stage.drafts,
      activeTab: "forms",
    });
  }

  if (stage.kind === "enterAppCode" || stage.kind === "loadingBootstrap") {
    const loading = stage.kind === "loadingBootstrap";
    return (
      <SafeAreaView style={styles.safeScreen}>
        <View style={styles.container}>
          <Text style={styles.h1}>{title}</Text>

          <View style={{ gap: 10 }}>
            <TextInput
              value={appCodeInput}
              onChangeText={setAppCodeInput}
              autoCapitalize="characters"
              placeholder="e.g. DEMO01"
              style={styles.input}
            />

            <Pressable style={styles.primaryBtn} onPress={loadBootstrap} disabled={loading}>
              {loading ? <ActivityIndicator /> : <Text style={styles.primaryBtnText}>Continue</Text>}
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (stage.kind === "home" || stage.kind === "loadingForm") {
    const loading = stage.kind === "loadingForm";
    const appCode = stage.appCode;
    const forms = stage.forms;
    const drafts = stage.drafts;
    const activeTab = stage.activeTab;

    return (
      <SafeAreaView style={styles.safeScreen}>
        <View style={styles.container}>
          <View style={styles.formsHeader}>
            <Text style={styles.h1}>{title}</Text>
            {activeTab === "forms" ? (
              <Pressable
                style={[styles.iconBtn, refreshingForms ? styles.disabledBtn : null]}
                onPress={() => void refreshForms(appCode)}
                disabled={refreshingForms}
                accessibilityRole="button"
                accessibilityLabel="Refresh forms"
              >
                {refreshingForms ? <ActivityIndicator size="small" /> : <Text style={styles.iconBtnText}>Refresh</Text>}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.tabs}>
            <TabButton label="Forms" active={activeTab === "forms"} onPress={() => setStage({ kind: "home", appCode, forms, drafts, activeTab: "forms" })} />
            <TabButton label="Drafts" active={activeTab === "drafts"} onPress={() => {
              setStage({ kind: "home", appCode, forms, drafts, activeTab: "drafts" });
              void refreshDrafts(appCode);
            }} />
            <TabButton label="Settings" active={activeTab === "settings"} onPress={() => setStage({ kind: "home", appCode, forms, drafts, activeTab: "settings" })} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {activeTab === "forms" ? (
            <FlatList
              data={forms}
              keyExtractor={(item) => item.formKey}
              contentContainerStyle={{ paddingTop: 12, gap: 10 }}
              refreshing={refreshingForms}
              onRefresh={() => void refreshForms(appCode)}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.card, loading ? { opacity: 0.6 } : null]}
                  disabled={loading}
                  onPress={() => openForm(appCode, item.formKey, forms, drafts, activeTab)}
                >
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {item.formKey} • v{item.version}
                  </Text>
                  {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ opacity: 0.7 }}>
                  No published forms yet. Publish at least one form from the Admin UI.
                </Text>
              }
            />
          ) : null}

          {activeTab === "drafts" ? (
            <FlatList
              data={drafts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 12, gap: 10 }}
              refreshing={refreshingDrafts}
              onRefresh={() => void refreshDrafts(appCode)}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.card, loading ? { opacity: 0.6 } : null]}
                  disabled={loading}
                  onPress={() => openDraft(appCode, item, forms, drafts)}
                >
                  <View style={styles.draftCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.formTitle}</Text>
                      <Text style={styles.cardMeta}>
                        {item.formKey} • v{item.formVersion} • {formatDate(item.updatedAt)}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.deleteDraftBtn}
                      onPress={async (event) => {
                        event.stopPropagation();
                        await deleteDraft(appCode, item.id);
                        await refreshDrafts(appCode);
                      }}
                    >
                      <Text style={styles.deleteDraftText}>Delete</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ opacity: 0.7 }}>No saved drafts yet.</Text>}
            />
          ) : null}

          {activeTab === "settings" ? (
            <View style={styles.settingsCard}>
              <Text style={styles.cardTitle}>App Code</Text>
              <Text style={styles.cardMeta}>{appCode}</Text>
              <Pressable
                style={[styles.secondaryBtn, { marginTop: 12 }]}
                onPress={() => {
                  setError("");
                  setStage({ kind: "enterAppCode" });
                }}
              >
                <Text style={styles.secondaryBtnText}>Change App Code</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.full}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.topBar}>
          <Pressable style={styles.secondaryBtn} onPress={() => goHome()}>
            <Text style={styles.secondaryBtnText}>Back to forms</Text>
          </Pressable>

          <Text style={styles.topBarTitle}>{stage.appCode}</Text>
        </View>
      </SafeAreaView>

      <FormRenderer
        key={`${stage.formKey}:${stage.draftId ?? "new"}`}
        form={stage.form}
        initialData={stage.initialData}
        onSaveDraft={async (data) => {
          const draft = await saveDraft({
            appCode: stage.appCode,
            formKey: stage.formKey,
            formTitle: stage.form.title ?? stage.formKey,
            formVersion: stage.form.version,
            data,
            draftId: currentDraftId ?? stage.draftId,
          });
          setCurrentDraftId(draft.id);
          const drafts = await listDrafts(stage.appCode);
          setStage((current) => (current.kind === "renderForm" ? { ...current, drafts, draftId: draft.id } : current));
          Alert.alert("Draft saved", "Your form draft has been saved on this device.");
        }}
        onSubmit={(data) => {
          console.log("submit:", { appCode: stage.appCode, formKey: stage.formKey, data });
        }}
      />
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabBtn, active ? styles.tabBtnActive : null]} onPress={onPress}>
      <Text style={[styles.tabBtnText, active ? styles.tabBtnTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  safeScreen: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { fontSize: 22, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  formsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },

  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { fontWeight: "700" },
  iconBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: "#fff",
  },
  iconBtnText: { fontWeight: "700" },
  disabledBtn: { opacity: 0.6 },

  tabs: { flexDirection: "row", gap: 8, borderBottomWidth: 1, borderColor: "#eee", paddingBottom: 8 },
  tabBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  tabBtnActive: { backgroundColor: "#111" },
  tabBtnText: { fontWeight: "700", color: "#111" },
  tabBtnTextActive: { color: "#fff" },

  error: { color: "#b00020" },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { opacity: 0.7, fontSize: 12 },
  cardDesc: { opacity: 0.85, marginTop: 4 },
  draftCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  deleteDraftBtn: { borderWidth: 1, borderColor: "#b00020", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  deleteDraftText: { color: "#b00020", fontWeight: "700" },
  settingsCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, gap: 4 },

  safeTop: { backgroundColor: "#fff" },
  topBar: { padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", gap: 10, alignItems: "center" },
  topBarTitle: { fontWeight: "700", marginLeft: "auto" },
});
