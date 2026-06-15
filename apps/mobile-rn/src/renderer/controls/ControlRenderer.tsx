import React from "react";

import type { ControlNode, ControlType, DataSourceDatasetMap } from "@transform/contracts/form-types";
import type { SubmissionDataValue } from "@transform/contracts/submission-types";

import type { ActionExecutionContext, ExecuteButtonActions, RendererVariables, SetValue, VariableMap } from "../types";

import { DateControl } from "./DateControl";
import { DropdownControl } from "./DropdownControl";
import { FileControl } from "./FileControl";
import { ImageControl } from "./ImageControl";
import { MultiSelectControl } from "./MultiSelectControl";
import { NumberControl } from "./NumberControl";
import { SegmentedControl } from "./SegmentedControl";
import { SignatureControl } from "./SignatureControl";
import { SwitchControl } from "./SwitchControl";
import { TextControl } from "./TextControl";
import { UnsupportedControl } from "./UnsupportedControl";
import { ButtonControl } from "./ButtonControl";
import { ListViewControl } from "./ListViewControl";

export type ControlRendererProps = {
  node: ControlNode;
  value: SubmissionDataValue;
  rootData: Record<string, unknown>;
  datasets: DataSourceDatasetMap;
  variables: RendererVariables;
  rowVariablesByKey?: Record<string, VariableMap>;
  actionContext?: ActionExecutionContext;
  setValue: SetValue;
  onButtonPress?: ExecuteButtonActions;
  error?: string;
};

export function ControlRenderer({ node, value, rootData, datasets, variables, rowVariablesByKey = {}, actionContext, setValue, onButtonPress, error }: ControlRendererProps) {
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
    case "segmented":
      return <SegmentedControl node={node} value={value} setValue={setValue} error={error} />;
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
      return <ButtonControl node={node} onPress={onButtonPress ? (pressedNode) => onButtonPress(pressedNode, actionContext) : undefined} error={error} />;
    case "listview":
      return (
        <ListViewControl
          node={node}
          rootData={rootData}
          datasets={datasets}
          variables={variables}
          rowVariablesByKey={rowVariablesByKey}
          onActionPress={onButtonPress}
          error={error}
        />
      );
    default:
      return <UnsupportedControl node={node} value={value} setValue={setValue} error={error} />;
  }
}
