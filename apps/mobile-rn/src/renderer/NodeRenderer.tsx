import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";

import type { LayoutNode, Node } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { FormState, SetValue } from "./types";

import { LayoutRenderer } from "./LayoutRenderer";
import { ControlRenderer } from "./controls/ControlRenderer";
import { styles } from "./renderer-styles";

export type NodeRendererProps = {
  node: Node;
  data: FormState;
  setValue: SetValue;
  errors: Record<string, string>;
  errorPrefix?: string;
};

export function NodeRenderer({ node, data, setValue, errors, errorPrefix = "" }: NodeRendererProps) {
  if (node.type === "layout") {
    if (node.layoutType === "repeater") {
      return <RepeatSectionRenderer node={node} data={data} setValue={setValue} errors={errors} errorPrefix={errorPrefix} />;
    }

    return (
      <LayoutRenderer
        node={node}
        renderNode={(child) => (
          <NodeRenderer node={child} data={data} setValue={setValue} errors={errors} errorPrefix={errorPrefix} />
        )}
      />
    );
  }

  return (
    <ControlRenderer
      node={node}
      value={data[node.key]}
      setValue={setValue}
      error={errors[errorPrefix ? `${errorPrefix}.${node.key}` : node.key]}
    />
  );
}

function RepeatSectionRenderer({
  node,
  data,
  setValue,
  errors,
  errorPrefix,
}: {
  node: LayoutNode;
  data: FormState;
  setValue: SetValue;
  errors: Record<string, string>;
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
                <NodeRenderer node={child} data={item} setValue={itemSetValue} errors={errors} errorPrefix={itemPrefix} />
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
