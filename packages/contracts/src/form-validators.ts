// packages/contracts/form-validators.ts

import type {
  ControlNode,
  FormDefinition,
  MultiSelectProps,
  Node,
  NumberProps,
  TextProps,
  FileProps,
} from "./form-types";
import type { SubmissionDataValue } from "./submission-types";

export type ValidationError = { key: string; message: string };

export function validateFormData(
  form: FormDefinition,
  data: Record<string, SubmissionDataValue>
): ValidationError[] {
  const errors: ValidationError[] = [];

  walk(form.root, (node) => {
    if (node.type !== "control") return;
    const value = data[node.key];
    const messages = validateControlValue(node, value);
    for (const message of messages) {
      errors.push({ key: node.key, message });
    }
  });

  return errors;
}

export function validateControlValue(node: ControlNode, value: SubmissionDataValue): string[] {
  const errors: string[] = [];

  if (node.validation?.required && isEmptyValue(value)) {
    errors.push("This field is required.");
    return errors;
  }

  switch (node.controlType) {
    case "text": {
      if (typeof value !== "string") return errors;
      const props = node.props as TextProps | undefined;
      const minLength = node.validation?.minLength;
      const maxLength = node.validation?.maxLength ?? props?.maxLength;
      if (minLength !== undefined && value.length < minLength) {
        errors.push(`Must be at least ${minLength} characters.`);
      }
      if (maxLength !== undefined && value.length > maxLength) {
        errors.push(`Must be at most ${maxLength} characters.`);
      }
      return errors;
    }

    case "number": {
      if (typeof value !== "number") return errors;
      const props = node.props as NumberProps | undefined;
      const min = node.validation?.min ?? props?.min;
      const max = node.validation?.max ?? props?.max;
      if (min !== undefined && value < min) {
        errors.push(`Must be at least ${min}.`);
      }
      if (max !== undefined && value > max) {
        errors.push(`Must be at most ${max}.`);
      }
      return errors;
    }

    case "multiselect": {
      if (!Array.isArray(value)) return errors;
      const props = node.props as MultiSelectProps | undefined;
      const maxItems = node.validation?.maxItems ?? props?.maxSelected;
      if (maxItems !== undefined && value.length > maxItems) {
        errors.push(`Select no more than ${maxItems} items.`);
      }
      return errors;
    }

    case "image": {
      if (Array.isArray(value)) {
        errors.push("Attach only one image.");
      }
      return errors;
    }

    case "file": {
      const props = node.props as FileProps | undefined;
      const maxItems = node.validation?.maxItems ?? props?.maxFiles;
      const count = Array.isArray(value) ? value.length : value ? 1 : 0;
      if (maxItems !== undefined && count > maxItems) {
        errors.push(`Attach no more than ${maxItems} files.`);
      }
      return errors;
    }

    default:
      return errors;
  }
}

export function findControlNode(form: FormDefinition, key: string): ControlNode | undefined {
  let found: ControlNode | undefined;
  walk(form.root, (node) => {
    if (found || node.type !== "control") return;
    if (node.key === key) found = node;
  });
  return found;
}

function walk(node: Node, fn: (n: Node) => void) {
  fn(node);
  if (node.type === "layout") node.children.forEach((c) => walk(c, fn));
}

function isEmptyValue(v: SubmissionDataValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
