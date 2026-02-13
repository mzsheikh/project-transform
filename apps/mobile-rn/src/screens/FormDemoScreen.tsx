import React from "react";
import { Alert, View, StyleSheet } from "react-native";

import type { FormDefinition } from "@transform/contracts/form-types";
import type { SubmissionPayload } from "@transform/contracts/submission-types";

import { FormRenderer } from "../renderer/FormRenderer";

import demoFormJson from "../forms/demoForm.json";

export function FormDemoScreen() {
  const form = demoFormJson as unknown as FormDefinition;

  return (
    <View style={styles.container}>
      <FormRenderer
        form={form}
        onSaveDraft={(data) => {
          Alert.alert("Draft saved", JSON.stringify(data, null, 2).slice(0, 2000));
        }}
        onSubmit={(data) => {
          // Build a realistic submission payload (what you’ll POST to NestJS later)
          const payload: SubmissionPayload = {
            appCode: "DEMO01",
            formKey: form.formKey,
            formVersion: form.version,
            submissionId: cryptoLikeId(),
            status: "draft",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            data,
          };

          Alert.alert("Submitted (local demo)", JSON.stringify(payload, null, 2).slice(0, 2000));
          console.log("SubmissionPayload:", payload);
        }}
      />
    </View>
  );
}

// Tiny uuid-like generator so you don’t need deps yet
function cryptoLikeId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
