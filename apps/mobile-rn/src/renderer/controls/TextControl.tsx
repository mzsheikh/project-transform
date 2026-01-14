import React from "react";
import { TextInput } from "react-native";

import type { ControlNode } from "@contracts/form-types";
import type { SubmissionDataValue } from "@contracts/submission-types";

import type { SetValue } from "../types";
import { getStringProp } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type TextControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function TextControl({ node, value, setValue, error }: TextControlProps) {
  return (
    <FieldShell label={node.label} error={error}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={typeof value === "string" ? value : ""}
        placeholder={getStringProp(node.props, "placeholder")}
        onChangeText={(t) => setValue(node.key, t)}
      />
    </FieldShell>
  );
}
