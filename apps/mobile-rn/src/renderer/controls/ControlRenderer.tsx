import React from "react";

import type { ControlNode, ControlType } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { SetValue } from "../types";

import { DateControl } from "./DateControl";
import { DropdownControl } from "./DropdownControl";
import { FileControl } from "./FileControl";
import { ImageControl } from "./ImageControl";
import { MultiSelectControl } from "./MultiSelectControl";
import { NumberControl } from "./NumberControl";
import { SignatureControl } from "./SignatureControl";
import { SwitchControl } from "./SwitchControl";
import { TextControl } from "./TextControl";
import { UnsupportedControl } from "./UnsupportedControl";
import { ButtonControl } from "./ButtonControl";

export type ControlRendererProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  setValue: SetValue;
  onButtonPress?: (node: ControlNode) => Promise<void> | void;
  error?: string;
};

export function ControlRenderer({ node, value, setValue, onButtonPress, error }: ControlRendererProps) {
  const controlType: ControlType = node.controlType;

  switch (controlType) {
    case "text":
      return <TextControl node={node} value={value} setValue={setValue} error={error} />;
    case "number":
      return <NumberControl node={node} value={value} setValue={setValue} error={error} />;
    case "switch":
      return <SwitchControl node={node} value={value} setValue={setValue} error={error} />;
    case "dropdown":
      return <DropdownControl node={node} value={value} setValue={setValue} error={error} />;
    case "multiselect":
      return <MultiSelectControl node={node} value={value} setValue={setValue} error={error} />;
    case "date":
      return <DateControl node={node} value={value} setValue={setValue} error={error} />;
    case "signature":
      return <SignatureControl node={node} value={value} setValue={setValue} error={error} />;
    case "image":
      return <ImageControl node={node} value={value} setValue={setValue} error={error} />;
    case "file":
      return <FileControl node={node} value={value} setValue={setValue} error={error} />;
    case "button":
      return <ButtonControl node={node} onPress={onButtonPress} error={error} />;
    default:
      return <UnsupportedControl node={node} value={value} setValue={setValue} error={error} />;
  }
}
