import React from "react";
import { Pressable, Text, View } from "react-native";

import type { ControlNode, DataSourceDatasetMap, ListViewProps } from "@transform/contracts/form-types";
import { resolveDynamicValue } from "@transform/contracts/expressions";

import type { ExecuteButtonActions, RendererVariables, VariableMap } from "../types";
import { FieldShell } from "./FieldShell";
import { styles } from "../renderer-styles";

export function ListViewControl({
  node,
  rootData,
  datasets,
  variables,
  rowVariablesByKey,
  onActionPress,
  error,
}: {
  node: ControlNode;
  rootData: Record<string, unknown>;
  datasets: DataSourceDatasetMap;
  variables: RendererVariables;
  rowVariablesByKey?: Record<string, VariableMap>;
  onActionPress?: ExecuteButtonActions;
  error?: string;
}) {
  const props = (node.props ?? {}) as ListViewProps;
  const baseContext = { rootData, datasets, variables };
  const dataResult = resolveDynamicValue(props.data ?? [], baseContext, `controls.${node.key}.props.data`);
  const rows = Array.isArray(dataResult.value) ? dataResult.value.filter(isRecord) : [];
  const keyField = readText(props.keyField, baseContext, "id") || "id";
  const emptyText = readText(props.emptyText, baseContext, "No records found") || "No records found";
  const actions = Array.isArray(props.actions) ? props.actions : [];
  const disabled = !!props.disabled || !!props.readOnly;
  const firstError = error ?? dataResult.errors[0]?.message;

  return (
    <FieldShell label={node.label} error={firstError}>
      <View style={styles.listView}>
        {rows.length === 0 ? (
          <Text style={styles.listViewEmpty}>{emptyText}</Text>
        ) : rows.map((row, index) => {
          const keyValue = row[keyField];
          const rowKey = typeof keyValue === "string" || typeof keyValue === "number"
            ? String(keyValue)
            : `${node.key}:${index}`;
          const rowScopeKey = `${node.key}:${rowKey}`;
          const rowVariables = rowVariablesByKey?.[rowScopeKey] ?? {};
          const rowContext = {
            rootData,
            itemData: row,
            rowIndex: index,
            datasets,
            variables: { ...variables, row: rowVariables },
          };
          const title = readText(props.title, rowContext, readText(row[keyField], rowContext, `Row ${index + 1}`));
          const subtitle = readText(props.subtitle, rowContext, "");
          const description = readText(props.description, rowContext, "");

          return (
            <Pressable
              key={rowKey}
              style={[styles.listViewItem, disabled ? styles.buttonDisabled : null]}
              disabled={disabled || actions.length === 0}
              onPress={() => void onActionPress?.(node, { itemData: row, rowIndex: index, rowScopeKey, rowVariables })}
            >
              <Text style={styles.listViewTitle}>{title}</Text>
              {subtitle ? <Text style={styles.listViewSubtitle}>{subtitle}</Text> : null}
              {description ? <Text style={styles.listViewDescription}>{description}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </FieldShell>
  );
}

function readText(value: unknown, context: Parameters<typeof resolveDynamicValue>[1], fallback: string) {
  const result = resolveDynamicValue(value, context);
  if (result.errors.length > 0 || result.value === null || result.value === undefined) return fallback;
  if (typeof result.value === "string") return result.value;
  if (typeof result.value === "number" || typeof result.value === "boolean") return String(result.value);
  return JSON.stringify(result.value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
