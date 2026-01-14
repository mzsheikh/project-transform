import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";

import type { FormDefinition } from "@contracts/form-types";
import { api, type BootstrapFormItem } from "../api/client";
import { FormRenderer } from "../renderer/FormRenderer";

type Stage =
  | { kind: "enterAppCode" }
  | { kind: "loadingBootstrap" }
  | { kind: "chooseForm"; appCode: string; forms: BootstrapFormItem[] }
  | { kind: "loadingForm"; appCode: string; formKey: string; forms: BootstrapFormItem[] }
  | { kind: "renderForm"; appCode: string; formKey: string; form: FormDefinition; forms: BootstrapFormItem[] };

export function AppBootstrapScreen() {
  const [appCodeInput, setAppCodeInput] = useState("DEMO01");
  const [stage, setStage] = useState<Stage>({ kind: "enterAppCode" });
  const [error, setError] = useState<string>("");

  const title = useMemo(() => {
    switch (stage.kind) {
      case "enterAppCode":
        return "Enter App Code";
      case "loadingBootstrap":
        return "Loading…";
      case "chooseForm":
        return `Forms (${stage.appCode})`;
      case "loadingForm":
        return `Loading form…`;
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
      setStage({ kind: "chooseForm", appCode: boot.app.appCode, forms: boot.forms });
    } catch (e: any) {
      setError(e.message ?? "Failed to bootstrap");
      setStage({ kind: "enterAppCode" });
    }
  }

  async function openForm(appCode: string, formKey: string, forms: BootstrapFormItem[]) {
    setError("");
    setStage({ kind: "loadingForm", appCode, formKey, forms });

    try {
      const form = await api.latestForm(appCode, formKey);
      setStage({ kind: "renderForm", appCode, formKey, form, forms });
    } catch (e: any) {
      setError(e.message ?? "Failed to load form");
      setStage({ kind: "chooseForm", appCode, forms });
    }
  }

  if (stage.kind === "enterAppCode" || stage.kind === "loadingBootstrap") {
    const loading = stage.kind === "loadingBootstrap";
    return (
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
    );
  }

  if (stage.kind === "chooseForm" || stage.kind === "loadingForm") {
    const loading = stage.kind === "loadingForm";
    const appCode = stage.appCode;
    const forms = stage.forms;

    return (
      <View style={styles.container}>
        <Text style={styles.h1}>{title}</Text>

        <View style={styles.row}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              setError("");
              setStage({ kind: "enterAppCode" });
            }}
          >
            <Text style={styles.secondaryBtnText}>Change App Code</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={forms}
          keyExtractor={(item) => item.formKey}
          contentContainerStyle={{ paddingTop: 12, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, loading ? { opacity: 0.6 } : null]}
              disabled={loading}
              onPress={() => openForm(appCode, item.formKey, forms)}
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
      </View>
    );
  }

  // renderForm
  return (
    <View style={styles.full}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setStage({ kind: "chooseForm", appCode: stage.appCode, forms: stage.forms })}
        >
          <Text style={styles.secondaryBtnText}>Back to forms</Text>
        </Pressable>

        <Text style={styles.topBarTitle}>{stage.appCode}</Text>
      </View>

      <FormRenderer
        form={stage.form}
        onSaveDraft={(data) => {
          console.log("draft:", { appCode: stage.appCode, formKey: stage.formKey, data });
        }}
        onSubmit={(data) => {
          console.log("submit:", { appCode: stage.appCode, formKey: stage.formKey, data });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { fontSize: 22, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },

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

  error: { color: "#b00020" },

  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardMeta: { opacity: 0.7, fontSize: 12 },
  cardDesc: { opacity: 0.85, marginTop: 4 },

  topBar: { padding: 12, paddingTop: 18, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", gap: 10, alignItems: "center" },
  topBarTitle: { fontWeight: "700", marginLeft: "auto" },
});