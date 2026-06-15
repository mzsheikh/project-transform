import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { ControlNode } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { getBoolProp, getOptions } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export function SegmentedControl({
  node,
  value,
  setValue,
  error,
}: {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
}) {
  const disabled = getBoolProp(node.props, "disabled") === true || getBoolProp(node.props, "readOnly") === true;
  const allowDeselect = getBoolProp(node.props, "allowDeselect") === true;
  const selectedValue = typeof value === "string" ? value : "";

  return (
    <FieldShell label={node.label} error={error}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.segmentedGroup}>
          {getOptions(node.props).map((option, index, options) => {
            const selected = selectedValue === option.value;
            const optionDisabled = disabled || !!option.disabled;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.segmentedItem,
                  index > 0 ? styles.segmentedItemDivider : null,
                  index === 0 ? styles.segmentedItemFirst : null,
                  index === options.length - 1 ? styles.segmentedItemLast : null,
                  selected ? styles.segmentedItemSelected : null,
                  optionDisabled ? styles.buttonDisabled : null,
                ]}
                disabled={optionDisabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: optionDisabled }}
                onPress={() => setValue(node.key, selected && allowDeselect ? "" : option.value)}
              >
                <Text style={[styles.segmentedItemText, selected ? styles.segmentedItemTextSelected : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </FieldShell>
  );
}
