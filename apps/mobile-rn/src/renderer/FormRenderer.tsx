import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

import type { ButtonAction, ControlNode, DataSourceDatasetMap, FormDefinition, Node } from "@transform/contracts/form-types";

import type { SubmissionDataValue } from "@transform/contracts/submission-types";
import { evaluateCalculatedFormData } from "@transform/contracts/expressions";
import { findControlNode, validateControlValue, validateFormData } from "@transform/contracts/form-validators";

import { NodeRenderer } from "./NodeRenderer";
import { styles } from "./renderer-styles";
import type { FormState } from "./types";

export type FormRendererProps = {
  form: FormDefinition;
  initialData?: FormState;
  datasets?: DataSourceDatasetMap;

  // Called when user taps Save Draft / Submit
  onSaveDraft?: (data: FormState) => void | Promise<void>;
  onSubmit?: (data: FormState, options?: { triggerKey?: string; clearDraftOnSuccess?: boolean }) => void | Promise<void>;

  // Optional: if you want to persist state as user types
  onChange?: (data: FormState) => void;
};

type ValidationError = { key: string; message: string };

export function FormRenderer({
  form,
  initialData,
  datasets = {},
  onSaveDraft,
  onSubmit,
  onChange,
}: FormRendererProps) {
  const [data, setData] = useState<FormState>(initialData ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expressionErrors, setExpressionErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const calculated = evaluateCalculatedFormData(form, data, datasets);
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
  }, [form, data, datasets, onChange]);

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
    return validateFormData(form, data, datasets);
  }

  async function handleSaveDraft() {
    // drafts typically allow incomplete data
    await onSaveDraft?.(data);
  }

  async function handleSubmit(options?: { triggerKey?: string; clearDraftOnSuccess?: boolean }): Promise<boolean> {
    const errs = validate();
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      for (const e of errs) map[e.key] = e.message;
      setErrors(map);
      return false;
    }
    await onSubmit?.(data, options);
    return true;
  }

  async function executeButtonActions(node: ControlNode) {
    const actions = Array.isArray(node.props?.actions) ? (node.props.actions as ButtonAction[]) : [];
    let submitted = false;
    for (const action of actions) {
      if (!action || action.enabled === false) continue;
      const actionType = String(action.type);
      if (action.type === "save_draft") {
        await handleSaveDraft();
      }
      if ((isServerButtonActionType(actionType) || actionType === "submit") && !submitted) {
        const clearDraftOnSuccess = "clearDraftOnSuccess" in action
          ? action.clearDraftOnSuccess !== false
          : true;
        submitted = await handleSubmit({
          triggerKey: node.key,
          clearDraftOnSuccess,
        });
        if (!submitted) return;
      }
    }
  }

  const showLegacyFooter = form.schemaVersion !== "1.2" && !hasButtonControls(form.root);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{form.title}</Text>
      {form.description ? <Text style={styles.description}>{form.description}</Text> : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <NodeRenderer node={form.root} data={data} rootData={data} datasets={datasets} setValue={setValue} errors={{ ...errors, ...expressionErrors }} onButtonPress={executeButtonActions} />
      </ScrollView>

      {showLegacyFooter ? (
        <View style={styles.footer}>
          <Pressable style={styles.buttonPrimary} onPress={() => void handleSaveDraft()}>
            <Text style={styles.buttonText}>Save Draft</Text>
          </Pressable>

          <Pressable style={styles.buttonPrimary} onPress={() => void handleSubmit()}>
            <Text style={styles.buttonText}>Submit</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function hasButtonControls(node: Node): boolean {
  if (node.type === "control") return node.controlType === "button";
  return node.children.some(hasButtonControls);
}

function isServerButtonActionType(type: string) {
  return type === "email_pdf" || type === "database" || type === "rest_api";
}
