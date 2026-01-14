import React from "react";
import { Switch } from "react-native";

import type { ControlNode } from "@contracts/form-types";
import type { SubmissionDataValue } from "@contracts/submission-types";

import type { SetValue } from "../types";
import { getBoolProp } from "../renderer-utils";
import { FieldShell } from "./FieldShell";

export type SwitchControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function SwitchControl({ node, value, setValue, error }: SwitchControlProps) {
  return (
    <FieldShell label={node.label} error={error} inline>
      <Switch
        value={typeof value === "boolean" ? value : Boolean(getBoolProp(node.props, "defaultValue"))}
        onValueChange={(v) => setValue(node.key, v)}
      />
    </FieldShell>
  );
}
