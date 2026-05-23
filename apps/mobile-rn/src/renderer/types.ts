import type { SubmissionDataValue } from "@transform/contracts/submission-types";
import type { ControlNode } from "@transform/contracts/form-types";

export type FormState = Record<string, SubmissionDataValue>;

export type SetValue = (key: string, value: SubmissionDataValue) => void;
export type ExecuteButtonActions = (node: ControlNode) => Promise<void> | void;
