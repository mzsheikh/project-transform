import type { LayoutNode, Node, OptionItem } from "@contracts/form-types";
import type { FileRefLocal, SubmissionDataValue } from "@contracts/submission-types";

export function collectRequiredKeys(root: LayoutNode): string[] {
  const keys: string[] = [];
  walk(root, (n) => {
    if (n.type === "control" && n.validation?.required) keys.push(n.key);
  });
  return keys;

  function walk(node: Node, fn: (n: Node) => void) {
    fn(node);
    if (node.type === "layout") node.children.forEach((c) => walk(c, fn));
  }
}

export function isEmptyValue(v: SubmissionDataValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function getStringProp(props: unknown, key: string): string | undefined {
  if (!props || typeof props !== "object") return undefined;
  const v = (props as any)[key];
  return typeof v === "string" ? v : undefined;
}

export function getBoolProp(props: unknown, key: string): boolean | undefined {
  if (!props || typeof props !== "object") return undefined;
  const v = (props as any)[key];
  return typeof v === "boolean" ? v : undefined;
}

export function getOptions(props: unknown): OptionItem[] {
  if (!props || typeof props !== "object") return [];
  const v = (props as any).options;
  return Array.isArray(v) ? (v as OptionItem[]) : [];
}

export function isFileRef(v: SubmissionDataValue): v is FileRefLocal {
  return !!v && typeof v === "object" && !Array.isArray(v) && "fileId" in (v as any);
}

// Quick uuid-like id for placeholders without adding deps.
// Replace with real uuid lib later if you prefer.
export function cryptoLikeId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
