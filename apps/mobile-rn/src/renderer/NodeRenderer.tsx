import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import type { DataSourceDatasetMap, LayoutNode, Node } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";
import { resolveControlState } from "@transform/contracts/expressions";

import type { ExecuteButtonActions, FormState, SetValue } from "./types";

import { LayoutRenderer } from "./LayoutRenderer";
import { ControlRenderer } from "./controls/ControlRenderer";
import { styles } from "./renderer-styles";

export type NodeRendererProps = {
  node: Node;
  data: FormState;
  rootData?: FormState;
  datasets?: DataSourceDatasetMap;
  setValue: SetValue;
  errors: Record<string, string>;
  onButtonPress?: ExecuteButtonActions;
  errorPrefix?: string;
  rowIndex?: number;
};

export function NodeRenderer({ node, data, rootData = data, datasets = {}, setValue, errors, onButtonPress, errorPrefix = "", rowIndex }: NodeRendererProps) {
  if (node.type === "layout") {
    if (node.layoutType === "repeater") {
      return <RepeatSectionRenderer node={node} data={data} rootData={rootData} datasets={datasets} setValue={setValue} errors={errors} onButtonPress={onButtonPress} errorPrefix={errorPrefix} />;
    }

    return (
      <LayoutRenderer
        node={node}
        renderNode={(child) => (
          <NodeRenderer node={child} data={data} rootData={rootData} datasets={datasets} setValue={setValue} errors={errors} onButtonPress={onButtonPress} errorPrefix={errorPrefix} rowIndex={rowIndex} />
        )}
      />
    );
  }

  const state = resolveControlState(node, { rootData, itemData: data, rowIndex, datasets });
  if (!state.visible) return null;
  const effectiveNode = { ...node, props: state.props };
  const errorKey = errorPrefix ? `${errorPrefix}.${node.key}` : node.key;

  return (
    <ControlRenderer
      node={effectiveNode}
      value={data[node.key]}
      setValue={setValue}
      onButtonPress={onButtonPress}
      error={errors[errorKey] ?? state.errors[0]?.message}
    />
  );
}

function RepeatSectionRenderer({
  node,
  data,
  rootData,
  datasets,
  setValue,
  errors,
  onButtonPress,
  errorPrefix,
}: {
  node: LayoutNode;
  data: FormState;
  rootData: FormState;
  datasets: DataSourceDatasetMap;
  setValue: SetValue;
  errors: Record<string, string>;
  onButtonPress?: ExecuteButtonActions;
  errorPrefix: string;
}) {
  const repeaterKey = node.key ?? node.id;
  const props = (node.props ?? {}) as {
    minItems?: number;
    maxItems?: number;
    defaultItems?: number;
    addButtonLabel?: string;
    removeButtonLabel?: string;
  };
  const minItems = Math.max(0, props.minItems ?? 0);
  const maxItems = props.maxItems;
  const defaultItems = Math.max(minItems, props.defaultItems ?? minItems);
  const current = data[repeaterKey];
  const initializedRef = useRef(false);
  const items = useMemo(() => {
    if (!Array.isArray(current)) return [];
    return current.filter(isRecordValue);
  }, [current]);
  const repeaterErrorKey = errorPrefix ? `${errorPrefix}.${repeaterKey}` : repeaterKey;

  useEffect(() => {
    if (!initializedRef.current && current === undefined && defaultItems > 0) {
      initializedRef.current = true;
      setValue(repeaterKey, Array.from({ length: defaultItems }, () => ({})));
    }
  }, [current, defaultItems, repeaterKey, setValue]);

  function commit(next: Record<string, SubmissionDataValue>[]) {
    setValue(repeaterKey, next);
  }

  function addItem() {
    if (typeof maxItems === "number" && items.length >= maxItems) return;
    commit([...items, {}]);
  }

  function removeItem(index: number) {
    if (items.length <= minItems) return;
    commit(items.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.repeater}>
      {node.label ? <Text style={styles.repeaterTitle}>{node.label}</Text> : null}
      {errors[repeaterErrorKey] ? <Text style={styles.errorText}>{errors[repeaterErrorKey]}</Text> : null}

      {items.map((item, index) => {
        const itemPrefix = `${repeaterErrorKey}.${index}`;
        const itemSetValue: SetValue = (childKey, value) => {
          const next = items.map((existing, i) => (i === index ? { ...existing, [childKey]: value } : existing));
          commit(next);
        };

        return (
          <View key={index} style={styles.repeaterItem}>
            <View style={styles.repeaterItemHeader}>
              <Text style={styles.repeaterItemTitle}>Item {index + 1}</Text>
              <Pressable
                style={[styles.repeaterRemoveBtn, items.length <= minItems ? styles.buttonDisabled : null]}
                disabled={items.length <= minItems}
                onPress={() => removeItem(index)}
              >
                <Text style={styles.buttonSecondaryText}>{props.removeButtonLabel ?? "Remove"}</Text>
              </Pressable>
            </View>

            <LayoutRenderer
              node={{ ...node, layoutType: "stack", children: node.children }}
              renderNode={(child) => (
                <NodeRenderer
                  node={child}
                  data={item}
                  rootData={rootData}
                  datasets={datasets}
                  setValue={itemSetValue}
                  errors={errors}
                  onButtonPress={onButtonPress}
                  errorPrefix={itemPrefix}
                  rowIndex={index}
                />
              )}
            />
          </View>
        );
      })}

      <Pressable
        style={[styles.repeaterAddBtn, typeof maxItems === "number" && items.length >= maxItems ? styles.buttonDisabled : null]}
        disabled={typeof maxItems === "number" && items.length >= maxItems}
        onPress={addItem}
      >
        <Text style={styles.buttonSecondaryText}>{props.addButtonLabel ?? "Add item"}</Text>
      </Pressable>
    </View>
  );
}

function isRecordValue(value: unknown): value is Record<string, SubmissionDataValue> {
  return !!value && typeof value === "object" && !Array.isArray(value) && !("fileId" in (value as Record<string, unknown>));
}
