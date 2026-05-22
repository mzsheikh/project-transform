import React from "react";
import { TextInput } from "react-native";

import type { ControlNode } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { getBoolProp, getStringProp } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type TextControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function TextControl({ node, value, setValue, error }: TextControlProps) {
  const disabled = getBoolProp(node.props, "disabled") === true;
  const readOnly = getBoolProp(node.props, "readOnly") === true;
  return (
    <FieldShell label={node.label} error={error}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, disabled || readOnly ? styles.inputDisabled : null]}
        value={typeof value === "string" ? value : ""}
        placeholder={getStringProp(node.props, "placeholder")}
        editable={!disabled && !readOnly}
        onChangeText={(t) => setValue(node.key, t)}
      />
    </FieldShell>
  );
}
