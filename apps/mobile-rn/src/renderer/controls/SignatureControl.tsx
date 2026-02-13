import React, { useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import SignatureScreen, { type SignatureViewRef } from "react-native-signature-canvas";

import type { ControlNode } from "@transform/contracts/form-types";
import type { FileRefLocal, SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { cryptoLikeId, isFileRef } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

export type SignatureControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function SignatureControl({ node, value, setValue, error }: SignatureControlProps) {
  const signatureRef = useRef<SignatureViewRef>(null);

  function handleOK(signature: string) {
    const file: FileRefLocal = {
      fileId: cryptoLikeId(),
      name: "signature.png",
      mime: "image/png",
      size: 0,
      localUri: signature,
    };
    setValue(node.key, file);
  }

  function handleClear() {
    signatureRef.current?.clearSignature();
    setValue(node.key, null);
  }

  return (
    <FieldShell label={node.label} error={error}>
      {Platform.OS === "web" ? (
        <View style={styles.signatureFallback}>
          <Text>Signature capture is not supported on web yet.</Text>
        </View>
      ) : (
        <View style={styles.signatureBox}>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleOK}
            onEmpty={() => undefined}
            descriptionText=""
            webStyle=".m-signature-pad--footer {display: none;}"
          />
          <View style={styles.signatureFooter}>
            <Pressable style={styles.buttonSecondary} onPress={handleClear}>
              <Text style={styles.buttonText}>Clear</Text>
            </Pressable>
            <Text style={styles.signatureHint}>
              {isFileRef(value) ? "Signature captured" : "Sign above"}
            </Text>
          </View>
        </View>
      )}
    </FieldShell>
  );
}
