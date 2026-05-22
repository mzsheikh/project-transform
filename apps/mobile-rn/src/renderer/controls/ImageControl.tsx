import React, { useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { ControlNode, ImageProps } from "@transform/contracts/form-types";
import type { FileRefLocal, SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";
import { cryptoLikeId, getBoolProp, isFileRef } from "../renderer-utils";
import { styles } from "../renderer-styles";
import { FieldShell } from "./FieldShell";

type ImageSource = "camera" | "gallery";

export type ImageControlProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  error?: string;
};

export function ImageControl({ node, value, setValue, error }: ImageControlProps) {
  const props = (node.props ?? {}) as ImageProps;
  const [menuVisible, setMenuVisible] = useState(false);
  const current = isFileRef(value) ? value : null;
  const buttonLabel = typeof props.buttonLabel === "string" && props.buttonLabel.trim() ? props.buttonLabel.trim() : "Add Image";
  const placeholder = typeof props.placeholder === "string" && props.placeholder.trim() ? props.placeholder.trim() : "No image selected";
  const allowCamera = props.allowCamera !== false;
  const allowGallery = props.allowGallery !== false;
  const disabled = getBoolProp(node.props, "disabled") === true || getBoolProp(node.props, "readOnly") === true;
  const hasSources = (allowCamera || allowGallery) && !disabled;
  const previewUri = current?.localUri ?? current?.remoteUrl;

  async function handleSourcePick(source: ImageSource) {
    if (disabled) return;
    setMenuVisible(false);

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        source === "camera"
          ? "Camera access is required to capture an image."
          : "Photo library access is required to choose an image."
      );
      return;
    }

    const pickerOptions = {
      mediaTypes: ["images"] as ["images"],
      allowsEditing: typeof props.allowsEditing === "boolean" ? props.allowsEditing : false,
      quality: typeof props.quality === "number" ? props.quality : 0.8,
    };

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const file: FileRefLocal = {
      fileId: cryptoLikeId(),
      name: asset.fileName ?? fallbackAssetName(source, asset.mimeType, asset.uri),
      mime: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize ?? 0,
      localUri: asset.uri,
    };

    setValue(node.key, file);
  }

  return (
    <FieldShell label={node.label} error={error}>
      <View style={styles.imageField}>
        <Pressable
          style={[styles.buttonSecondary, !hasSources ? styles.buttonDisabled : undefined]}
          onPress={() => setMenuVisible((currentVisible) => (hasSources ? !currentVisible : currentVisible))}
          disabled={!hasSources}
        >
          <Text style={styles.buttonSecondaryText}>{buttonLabel}</Text>
        </Pressable>

        {menuVisible ? (
          <View style={styles.menuCard}>
            {allowCamera ? (
              <Pressable style={styles.menuItem} onPress={() => void handleSourcePick("camera")}>
                <Text style={styles.menuItemText}>Take image from camera</Text>
              </Pressable>
            ) : null}

            {allowGallery ? (
              <Pressable style={styles.menuItem} onPress={() => void handleSourcePick("gallery")}>
                <Text style={styles.menuItemText}>Pick image from gallery</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={current?.name ?? ""}
          placeholder={placeholder}
          editable={false}
        />

        {previewUri ? (
          <View style={styles.imagePreviewFrame}>
            <Image
              source={{ uri: previewUri }}
              style={styles.imagePreview}
              resizeMode="cover"
              accessibilityLabel={current?.name ? `Selected image ${current.name}` : "Selected image"}
            />
          </View>
        ) : null}
      </View>
    </FieldShell>
  );
}

function fallbackAssetName(source: ImageSource, mimeType?: string | null, uri?: string) {
  const uriName = uri?.split("/").pop()?.split("?")[0];
  if (uriName) {
    return uriName;
  }

  return `${source}-image.${extensionFromMime(mimeType)}`;
}

function extensionFromMime(mimeType?: string | null) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    default:
      return "jpg";
  }
}
