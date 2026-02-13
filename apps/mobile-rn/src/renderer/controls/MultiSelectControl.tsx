import React from "react";
import { Pressable, Text, View } from "react-native";

import type { ControlNode, OptionItem } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { getOptions } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type MultiSelectControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function MultiSelectControl({ node, value, setValue, error }: MultiSelectControlProps) {
  return (
    <FieldShell label={node.label} error={error}>
      <MultiSelectStarter
        options={getOptions(node.props)}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={(arr) => setValue(node.key, arr)}
      />
    </FieldShell>
  );
}

// MultiSelect starter: toggles chips (basic but useful)
function MultiSelectStarter({
  options,
  value,
  onChange,
}: {
  options: OptionItem[];
  value: string[];
  onChange: (arr: string[]) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, active ? styles.chipActive : null]}
            onPress={() => {
              if (active) onChange(value.filter((v) => v !== opt.value));
              else onChange([...value, opt.value]);
            }}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
