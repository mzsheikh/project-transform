import React, { useState } from "react";
import { Pressable, Text } from "react-native";

import type { ButtonProps, ControlNode } from "@transform/contracts/form-types";

import { FieldShell } from "./FieldShell";
import { styles } from "../renderer-styles";

export function ButtonControl({
  node,
  onPress,
  error,
}: {
  node: ControlNode;
  onPress?: (node: ControlNode) => Promise<void> | void;
  error?: string;
}) {
  const [running, setRunning] = useState(false);
  const props = (node.props ?? {}) as ButtonProps;
  const disabled = !!props.disabled || !!props.readOnly || running;
  const label = typeof props.text === "string" && props.text.trim()
    ? props.text
    : node.label ?? "Button";

  async function handlePress() {
    if (!onPress || disabled) return;
    setRunning(true);
    try {
      await onPress(node);
    } finally {
      setRunning(false);
    }
  }

  const variantStyle =
    props.variant === "danger"
      ? styles.buttonDanger
      : props.variant === "secondary"
        ? styles.buttonSecondary
        : styles.buttonPrimary;
  const textStyle = props.variant === "secondary" ? styles.buttonSecondaryText : styles.buttonText;

  return (
    <FieldShell label={node.label} error={error}>
      <Pressable
        style={[variantStyle, disabled ? styles.buttonDisabled : null]}
        disabled={disabled}
        onPress={() => void handlePress()}
      >
        <Text style={textStyle}>{running ? "Working..." : label}</Text>
      </Pressable>
    </FieldShell>
  );
}
