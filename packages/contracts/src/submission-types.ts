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

export type SubmissionDataValue =
  | string
  | number
  | boolean
  | string[]              // multiselect
  | null
  | FileRefLocal
  | FileRefLocal[];

export interface SubmissionPayload {
  appCode: string;
  formKey: string;
  formVersion: number;
  submissionId: string;   // uuid
  status: SubmissionStatus;
  createdAt: string;      // ISO string
  updatedAt: string;      // ISO string

  data: Record<string, SubmissionDataValue>;
}