import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import type { ControlNode, DateProps } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { getBoolProp } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type DateControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function DateControl({ node, value, setValue, error }: DateControlProps) {
  const [show, setShow] = useState(false);
  const props = node.props as DateProps | undefined;
  const mode = props?.mode === "datetime" ? "datetime" : "date";
  const dateValue = typeof value === "string" && value ? new Date(value) : new Date();
  const disabled = getBoolProp(node.props, "disabled") === true || getBoolProp(node.props, "readOnly") === true;

  function handleChange(_event: unknown, selected?: Date) {
    setShow(false);
    if (!selected) return;
    if (mode === "datetime") {
      setValue(node.key, selected.toISOString());
      return;
    }
    const isoDate = selected.toISOString().split("T")[0];
    setValue(node.key, isoDate);
  }

  return (
    <FieldShell label={node.label} error={error}>
      {Platform.OS === "web" ? (
        <TextInput
          style={[styles.input, error ? styles.inputError : null, disabled ? styles.inputDisabled : null]}
          value={typeof value === "string" ? value : ""}
          placeholder={mode === "datetime" ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD"}
          editable={!disabled}
          onChangeText={(t) => setValue(node.key, t)}
          {...({ type: mode === "datetime" ? "datetime-local" : "date" } as any)}
        />
      ) : (
        <View>
          <Pressable style={[styles.select, disabled ? styles.buttonDisabled : null]} disabled={disabled} onPress={() => setShow(true)}>
            <Text>{typeof value === "string" && value ? value : "Select date"}</Text>
          </Pressable>
          {show ? (
            <DateTimePicker value={dateValue} mode={mode} display="default" onChange={handleChange} />
          ) : null}
        </View>
      )}
    </FieldShell>
  );
}
