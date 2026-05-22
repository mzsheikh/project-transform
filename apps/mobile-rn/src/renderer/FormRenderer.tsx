import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

import type { FormDefinition } from "@transform/contracts/form-types";

import type { SubmissionDataValue } from "@transform/contracts/submission-types";
import { evaluateCalculatedFormData } from "@transform/contracts/expressions";
import { findControlNode, validateControlValue, validateFormData } from "@transform/contracts/form-validators";

import { NodeRenderer } from "./NodeRenderer";
import { styles } from "./renderer-styles";
import type { FormState } from "./types";

export type FormRendererProps = {
  form: FormDefinition;
  initialData?: FormState;

  // Called when user taps Save Draft / Submit
  onSaveDraft?: (data: FormState) => void;
  onSubmit?: (data: FormState) => void;

  // Optional: if you want to persist state as user types
  onChange?: (data: FormState) => void;
};

type ValidationError = { key: string; message: string };

export function FormRenderer({
  form,
  initialData,
  onSaveDraft,
  onSubmit,
  onChange,
}: FormRendererProps) {
  const [data, setData] = useState<FormState>(initialData ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expressionErrors, setExpressionErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const calculated = evaluateCalculatedFormData(form, data);
    const nextExpressionErrors: Record<string, string> = {};
    for (const error of calculated.errors) {
      nextExpressionErrors[error.key ?? error.path] = error.message;
    }
    setExpressionErrors(nextExpressionErrors);

    if (JSON.stringify(calculated.data) !== JSON.stringify(data)) {
      const next = calculated.data as FormState;
      setData(next);
      onChange?.(next);
    }
  }, [form, data, onChange]);

  function setValue(key: string, value: SubmissionDataValue) {
    setData((prev) => {
      const next = { ...prev, [key]: value };
      onChange?.(next);
      return next;
    });

    // Inline validation: update the error for the field being edited
    setErrors((prev) => {
      const control = findControlNode(form, key);
      if (!control) return prev;
      const messages = validateControlValue(control, value);
      if (messages.length === 0) {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: messages[0] };
    });
  }

  function validate(): ValidationError[] {
    return validateFormData(form, data);
  }

  function handleSaveDraft() {
    // drafts typically allow incomplete data
    onSaveDraft?.(data);
  }

  function handleSubmit() {
    const errs = validate();
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      for (const e of errs) map[e.key] = e.message;
      setErrors(map);
      return;
    }
    onSubmit?.(data);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{form.title}</Text>
      {form.description ? <Text style={styles.description}>{form.description}</Text> : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <NodeRenderer node={form.root} data={data} rootData={data} setValue={setValue} errors={{ ...errors, ...expressionErrors }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.buttonPrimary} onPress={handleSaveDraft}>
          <Text style={styles.buttonText}>Save Draft</Text>
        </Pressable>

        <Pressable style={styles.buttonPrimary} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Submit</Text>
        </Pressable>
      </View>
    </View>
  );
}
