import React from "react";
import { TextInput } from "react-native";

import type { ControlNode } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { getStringProp } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type NumberControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function NumberControl({ node, value, setValue, error }: NumberControlProps) {
  return (
    <FieldShell label={node.label} error={error}>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={typeof value === "number" ? String(value) : ""}
        keyboardType="numeric"
        placeholder={getStringProp(node.props, "placeholder")}
        onChangeText={(t) => {
          const n = t.trim() === "" ? null : Number(t);
          setValue(node.key, Number.isFinite(n as number) ? (n as number) : null);
        }}
      />
    </FieldShell>
  );
}
