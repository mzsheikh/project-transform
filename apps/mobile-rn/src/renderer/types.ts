import type { SubmissionDataValue } from "@contracts/submission-types";

export type FormState = Record<string, SubmissionDataValue>;

export type SetValue = (key: string, value: SubmissionDataValue) => void;
