import React from "react";
import { Switch } from "react-native";

import type { ControlNode } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

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
  const disabled = getBoolProp(node.props, "disabled") === true || getBoolProp(node.props, "readOnly") === true;
  return (
    <FieldShell label={node.label} error={error} inline>
      <Switch
        value={typeof value === "boolean" ? value : Boolean(getBoolProp(node.props, "defaultValue"))}
        onValueChange={(v) => setValue(node.key, v)}
        disabled={disabled}
      />
    </FieldShell>
  );
}
