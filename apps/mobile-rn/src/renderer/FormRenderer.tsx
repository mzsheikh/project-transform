import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

import type { ButtonAction, ControlNode, DataSourceDatasetMap, FormDefinition, Node } from "@transform/contracts/form-types";

import type { SubmissionDataValue } from "@transform/contracts/submission-types";
import { evaluateCalculatedFormData, resolveDynamicValue } from "@transform/contracts/expressions";
import { findControlNode, validateControlValue, validateFormData } from "@transform/contracts/form-validators";

import { NodeRenderer } from "./NodeRenderer";
import { styles } from "./renderer-styles";
import type { ActionExecutionContext, FormState, RendererVariables } from "./types";

export type FormRendererProps = {
  form: FormDefinition;
  initialData?: FormState;
  datasets?: DataSourceDatasetMap;
  variables?: RendererVariables;

  // Called when user taps Save Draft / Submit
  onSaveDraft?: (data: FormState) => void | Promise<void>;
  onSubmit?: (data: FormState, options?: { triggerKey?: string; clearDraftOnSuccess?: boolean; variables?: RendererVariables }) => void | Promise<void>;
  onVariablesChange?: (variables: RendererVariables) => void | Promise<void>;
  onOpenForm?: (request: { appCode?: string; formKey: string; initialData?: FormState }) => void | Promise<void>;

  // Optional: if you want to persist state as user types
  onChange?: (data: FormState) => void;
};

export function FormRenderer({
  form,
  initialData,
  datasets = {},
  variables,
  onSaveDraft,
  onSubmit,
  onVariablesChange,
  onOpenForm,
  onChange,
}: FormRendererProps) {
  const [data, setData] = useState<FormState>(initialData ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expressionErrors, setExpressionErrors] = useState<Record<string, string>>({});
  const [formVariables, setFormVariables] = useState<Record<string, unknown>>(variables?.form ?? {});
  const [globalVariables, setGlobalVariables] = useState<Record<string, unknown>>(variables?.global ?? {});
  const [rowVariablesByKey, setRowVariablesByKey] = useState<Record<string, Record<string, unknown>>>({});
  const rendererVariables = useMemo<RendererVariables>(
    () => ({ form: formVariables, global: globalVariables }),
    [formVariables, globalVariables],
  );

  useEffect(() => {
    setGlobalVariables(variables?.global ?? {});
  }, [variables?.global]);

  useEffect(() => {
    const calculated = evaluateCalculatedFormData(form, data, datasets, rendererVariables);
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
  }, [form, data, datasets, rendererVariables, onChange]);

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

  async function handleSaveDraft() {
    // drafts typically allow incomplete data
    await onSaveDraft?.(data);
  }

  async function handleSubmit(
    options?: { triggerKey?: string; clearDraftOnSuccess?: boolean },
    variableSnapshot: RendererVariables = rendererVariables,
  ): Promise<boolean> {
    const errs = validateFormData(form, data, datasets, variableSnapshot);
    if (errs.length > 0) {
      const map: Record<string, string> = {};
      for (const e of errs) map[e.key] = e.message;
      setErrors(map);
      return false;
    }
    await onSubmit?.(data, { ...options, variables: variableSnapshot });
    return true;
  }

  async function executeButtonActions(node: ControlNode, context?: ActionExecutionContext) {
    const actions = Array.isArray(node.props?.actions) ? (node.props.actions as ButtonAction[]) : [];
    let submitted = false;
    let currentFormVariables = formVariables;
    let currentGlobalVariables = globalVariables;
    const rowVariables = context?.rowScopeKey
      ? { ...(rowVariablesByKey[context.rowScopeKey] ?? {}) }
      : (context?.rowVariables ?? {});

    const commitVariables = async (next: RendererVariables) => {
      if (next.form) setFormVariables(next.form);
      if (next.global) setGlobalVariables(next.global);
      await onVariablesChange?.(next);
    };

    for (const action of actions) {
      try {
        if (!action) continue;
        const actionContext = {
          rootData: data,
          itemData: context?.itemData ?? data,
          rowIndex: context?.rowIndex,
          datasets,
          variables: { row: rowVariables, form: currentFormVariables, global: currentGlobalVariables },
        };
        const enabled = resolveDynamicValue(action.enabled ?? true, actionContext, `controls.${node.key}.props.actions.${action.id}.enabled`);
        if (enabled.errors.length > 0) throw new Error(enabled.errors[0].message);
        if (enabled.value === false) continue;

        const actionType = String(action.type);
        if (action.type === "save_draft") {
          await handleSaveDraft();
        }
        if (action.type === "set_variable") {
          const keyResult = resolveDynamicValue(action.key, actionContext, `controls.${node.key}.props.actions.${action.id}.key`);
          if (keyResult.errors.length > 0) throw new Error(keyResult.errors[0].message);
          const variableKey = String(keyResult.value ?? "").trim();
          if (!variableKey) throw new Error("Set variable action requires a variable key.");
          const valueResult = resolveDynamicValue(action.value ?? null, actionContext, `controls.${node.key}.props.actions.${action.id}.value`);
          if (valueResult.errors.length > 0) throw new Error(valueResult.errors[0].message);
          const scope = action.scope ?? "form";
          if (scope === "row") {
            rowVariables[variableKey] = valueResult.value;
            if (context?.rowScopeKey) {
              setRowVariablesByKey((prev) => ({ ...prev, [context.rowScopeKey as string]: { ...rowVariables } }));
            }
          } else if (scope === "global") {
            currentGlobalVariables = { ...currentGlobalVariables, [variableKey]: valueResult.value };
            await commitVariables({ form: currentFormVariables, global: currentGlobalVariables });
          } else {
            currentFormVariables = { ...currentFormVariables, [variableKey]: valueResult.value };
            await commitVariables({ form: currentFormVariables, global: currentGlobalVariables });
          }
        }
        if (action.type === "open_form") {
          const formKeyResult = resolveDynamicValue(action.formKey, actionContext, `controls.${node.key}.props.actions.${action.id}.formKey`);
          if (formKeyResult.errors.length > 0) throw new Error(formKeyResult.errors[0].message);
          const targetFormKey = String(formKeyResult.value ?? "").trim();
          if (!targetFormKey) throw new Error("Open form action requires a form key.");
          const appCodeResult = resolveDynamicValue(action.appCode ?? "", actionContext, `controls.${node.key}.props.actions.${action.id}.appCode`);
          if (appCodeResult.errors.length > 0) throw new Error(appCodeResult.errors[0].message);
          const initialDataResult = resolveDynamicValue(action.initialData ?? {}, actionContext, `controls.${node.key}.props.actions.${action.id}.initialData`);
          if (initialDataResult.errors.length > 0) throw new Error(initialDataResult.errors[0].message);
          await onOpenForm?.({
            appCode: String(appCodeResult.value ?? "").trim() || undefined,
            formKey: targetFormKey,
            initialData: isRecord(initialDataResult.value) ? (initialDataResult.value as FormState) : undefined,
          });
          return;
        }
        if ((isServerButtonActionType(actionType) || actionType === "submit") && !submitted) {
          const clearDraftOnSuccess = "clearDraftOnSuccess" in action
            ? action.clearDraftOnSuccess !== false
            : true;
          submitted = await handleSubmit(
            {
              triggerKey: node.key,
              clearDraftOnSuccess,
            },
            { form: currentFormVariables, global: currentGlobalVariables },
          );
          if (!submitted) return;
        }
      } catch (error) {
        setExpressionErrors((prev) => ({
          ...prev,
          [node.key]: error instanceof Error ? error.message : "Action failed.",
        }));
        return;
      }
    }
  }

  const showLegacyFooter = form.schemaVersion !== "1.2" && form.schemaVersion !== "1.3" && !hasButtonControls(form.root);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{form.title}</Text>
      {form.description ? <Text style={styles.description}>{form.description}</Text> : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <NodeRenderer node={form.root} data={data} rootData={data} datasets={datasets} variables={rendererVariables} rowVariablesByKey={rowVariablesByKey} setValue={setValue} errors={{ ...errors, ...expressionErrors }} onButtonPress={executeButtonActions} />
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
