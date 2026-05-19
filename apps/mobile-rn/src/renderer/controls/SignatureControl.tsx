import React, { useRef, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, SafeAreaView, Text, View } from "react-native";
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
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const current = isFileRef(value) ? value : null;
  const signatureUri = current?.localUri ?? current?.remoteUrl;

  function handleOK(signature: string) {
    const file: FileRefLocal = {
      fileId: cryptoLikeId(),
      name: "signature.png",
      mime: "image/png",
      size: 0,
      localUri: signature,
    };
    setValue(node.key, file);
    setPendingClear(false);
    setModalVisible(false);
  }

  function handleClear() {
    setValue(node.key, null);
  }

  function handleOpenDialog() {
    setPendingClear(false);
    setModalVisible(true);
  }

  function handleDone() {
    if (pendingClear) {
      setValue(node.key, null);
      setPendingClear(false);
      setModalVisible(false);
      return;
    }

    signatureRef.current?.readSignature();
  }

  function handleClearDialog() {
    setPendingClear(true);
    signatureRef.current?.clearSignature();
  }

  function handleCancel() {
    setPendingClear(false);
    setModalVisible(false);
  }

  return (
    <FieldShell label={node.label} error={error}>
      {Platform.OS === "web" ? (
        <View style={styles.signatureFallback}>
          <Text>Signature capture is not supported on web yet.</Text>
        </View>
      ) : (
        <View style={styles.signatureField}>
          <Pressable style={styles.buttonSecondary} onPress={handleOpenDialog}>
            <Text style={styles.buttonSecondaryText}>{signatureUri ? "Edit Signature" : "Add Signature"}</Text>
          </Pressable>

          {signatureUri ? (
            <View style={styles.signaturePreviewFrame}>
              <Image
                source={{ uri: signatureUri }}
                style={styles.signaturePreview}
                resizeMode="contain"
                accessibilityLabel="Captured signature"
              />
            </View>
          ) : (
            <View style={styles.signatureEmptyFrame}>
              <Text style={styles.signatureHint}>No signature added</Text>
            </View>
          )}

          {signatureUri ? (
            <Pressable style={styles.signatureClearBtn} onPress={handleClear}>
              <Text style={styles.buttonSecondaryText}>Clear</Text>
            </Pressable>
          ) : null}

          <Modal visible={modalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleCancel}>
            <SafeAreaView style={styles.signatureModal}>
              <View style={styles.signatureModalHeader}>
                <Text style={styles.signatureModalTitle}>{node.label ?? "Signature"}</Text>
              </View>

              <View style={styles.signatureCanvasFrame}>
                <SignatureScreen
                  ref={signatureRef}
                  dataURL={signatureUri}
                  onOK={handleOK}
                  onEmpty={() => Alert.alert("Signature required", "Please sign before tapping Done.")}
                  descriptionText=""
                  autoClear={false}
                  webStyle=".m-signature-pad--footer {display: none;} .m-signature-pad {box-shadow: none; border: 0;} body,html {height: 100%; margin: 0;}"
                />
              </View>

              <View style={styles.signatureModalActions}>
                <Pressable style={styles.signatureCancelBtn} onPress={handleCancel}>
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.signatureDialogClearBtn} onPress={handleClearDialog}>
                  <Text style={styles.buttonSecondaryText}>Clear Signature</Text>
                </Pressable>
                <Pressable style={styles.signatureDoneBtn} onPress={handleDone}>
                  <Text style={styles.buttonText}>Done</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Modal>
        </View>
      )}
    </FieldShell>
  );
}
