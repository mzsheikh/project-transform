import React from "react";
import { Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import type { ControlNode } from "@contracts/form-types";
import type { FileRefLocal, SubmissionDataValue } from "@contracts/submission-types";

import type { SetValue } from "../types";
import { cryptoLikeId } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type FileControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function FileControl({ node, value, setValue, error }: FileControlProps) {
  const current = Array.isArray(value) ? (value as FileRefLocal[]) : [];

  async function handlePick() {
    const props = node.props as { accept?: string[]; maxFiles?: number } | undefined;
    const result = await DocumentPicker.getDocumentAsync({
      type: props?.accept ?? "*/*",
      multiple: (props?.maxFiles ?? 0) !== 1,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const assets = result.assets ?? [];
    if (assets.length === 0) return;

    const picked = assets.map((asset) => ({
      fileId: cryptoLikeId(),
      name: asset.name ?? "file",
      mime: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? 0,
      localUri: asset.uri,
    }));

    const next = [...current, ...picked];
    const max = props?.maxFiles;
    setValue(node.key, typeof max === "number" ? next.slice(0, max) : next);
  }

  return (
    <FieldShell label={node.label} error={error}>
      <View>
        <Pressable style={styles.buttonSecondary} onPress={handlePick}>
          <Text style={styles.buttonText}>Add File</Text>
        </Pressable>
        {current.length > 0 ? (
          <Text style={styles.fileHint}>{`Attached: ${current.length}`}</Text>
        ) : null}
      </View>
    </FieldShell>
  );
}
