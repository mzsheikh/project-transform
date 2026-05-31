// packages/contracts/submission-types.ts

export type SubmissionStatus =
  | "draft"
  | "pending_sync"
  | "submitted"
  | "synced"
  | "failed";

export interface FileRefLocal {
  fileId: string;         // uuid generated on client
  name: string;
  mime: string;
  size: number;
  localUri?: string;      // present offline / before upload
  remoteUrl?: string;     // present after upload
}

export type RepeatedItemData = Record<string, SubmissionDataValue>;
export type SubmissionVariableMap = Record<string, unknown>;

export interface SubmissionVariables {
  form?: SubmissionVariableMap;
  global?: SubmissionVariableMap;
}

export type SubmissionDataValue =
  | string
  | number
  | boolean
  | string[]              // multiselect
  | null
  | FileRefLocal
  | FileRefLocal[]
  | RepeatedItemData[];

export interface SubmissionPayload {
  appCode: string;
  formKey: string;
  formVersion: number;
  submissionId: string;   // uuid
  status: SubmissionStatus;
  createdAt: string;      // ISO string
  updatedAt: string;      // ISO string
  triggerKey?: string;
  variables?: SubmissionVariables;

  data: Record<string, SubmissionDataValue>;
}
