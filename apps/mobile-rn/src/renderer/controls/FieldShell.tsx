import React from "react";
import { View, Text } from "react-native";

import { styles } from "../renderer-styles";

export type FieldShellProps = {
  label?: string;
  error?: string;
  inline?: boolean;
  children: React.ReactNode;
};

export function FieldShell({ label, error, inline, children }: FieldShellProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={inline ? styles.inlineRow : undefined}>{children}</View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
