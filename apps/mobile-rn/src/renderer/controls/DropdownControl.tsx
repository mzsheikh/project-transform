import React from "react";
import { View } from "react-native";
import { Picker } from "@react-native-picker/picker";

import type { ControlNode } from "@contracts/form-types";
import type { SubmissionDataValue } from "@contracts/submission-types";

import type { SetValue } from "../types";
import { getOptions } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type DropdownControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function DropdownControl({ node, value, setValue, error }: DropdownControlProps) {
  return (
    <FieldShell label={node.label} error={error}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={typeof value === "string" ? value : ""}
          onValueChange={(v) => setValue(node.key, String(v))}
          style={styles.picker}
        >
          <Picker.Item label="Select..." value="" />
          {getOptions(node.props).map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </FieldShell>
  );
}
