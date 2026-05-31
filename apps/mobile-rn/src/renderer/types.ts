import type { SubmissionDataValue } from "@transform/contracts/submission-types";
import type { ControlNode } from "@transform/contracts/form-types";

export type FormState = Record<string, SubmissionDataValue>;
export type VariableMap = Record<string, unknown>;
export type RendererVariables = {
  form?: VariableMap;
  global?: VariableMap;
};

export type SetValue = (key: string, value: SubmissionDataValue) => void;
export type ActionExecutionContext = {
  itemData?: Record<string, unknown>;
  rowIndex?: number;
  rowScopeKey?: string;
  rowVariables?: VariableMap;
};
export type ExecuteButtonActions = (node: ControlNode, context?: ActionExecutionContext) => Promise<void> | void;
