import React from "react";
import { View } from "react-native";
import { Picker } from "@react-native-picker/picker";

import type { ControlNode } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { getBoolProp, getOptions } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type DropdownControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function DropdownControl({ node, value, setValue, error }: DropdownControlProps) {
  const disabled = getBoolProp(node.props, "disabled") === true || getBoolProp(node.props, "readOnly") === true;
  return (
    <FieldShell label={node.label} error={error}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={typeof value === "string" ? value : ""}
          onValueChange={(v) => setValue(node.key, String(v))}
          style={styles.picker}
          enabled={!disabled}
        >
          <Picker.Item label="Select..." value="" />
          {getOptions(node.props).map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} enabled={!opt.disabled && !disabled} />
          ))}
        </Picker>
      </View>
    </FieldShell>
  );
}
