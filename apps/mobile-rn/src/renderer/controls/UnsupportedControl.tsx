import React from "react";
import { Text } from "react-native";

import type { ControlNode } from "@contracts/form-types";
import type { SubmissionDataValue } from "@contracts/submission-types";

import type { SetValue } from "../types";
import { FieldShell } from "./FieldShell";

export type UnsupportedControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function UnsupportedControl({ node, error }: UnsupportedControlProps) {
  return (
    <FieldShell label={node.label} error={error}>
      <Text>Unsupported control: {node.controlType}</Text>
    </FieldShell>
  );
}
