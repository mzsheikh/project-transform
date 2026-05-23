// packages/contracts/form-validators.ts

import type {
  ControlNode,
  FormDefinition,
  LayoutNode,
  MultiSelectProps,
  Node,
  NumberProps,
  TextProps,
  FileProps,
  ValidationRules,
} from "./form-types";
import type { SubmissionDataValue } from "./submission-types";
import {
  evaluateCalculatedFormData,
  resolveControlState,
  resolveDynamicValue,
} from "./expressions";

export type ValidationError = { key: string; message: string };

export function validateFormData(
  form: FormDefinition,
  data: Record<string, SubmissionDataValue>
): ValidationError[] {
  const calculated = evaluateCalculatedFormData(form, data);
  const errors: ValidationError[] = calculated.errors.map((error) => ({
    key: error.key ?? error.path,
    message: error.message,
  }));
  validateNode(form.root, calculated.data, calculated.data, "", errors);
  return errors;
}

function validateNode(
  node: Node,
  rootData: Record<string, SubmissionDataValue>,
  data: Record<string, SubmissionDataValue>,
  prefix: string,
  errors: ValidationError[]
) {
  if (node.type === "control") {
    if (node.controlType === "button") return;
    const props = (node.props ?? {}) as Record<string, unknown>;
    const state = resolveControlState(node, { rootData, itemData: data });
    const errorKey = prefix ? `${prefix}.${node.key}` : node.key;
    for (const error of state.errors) {
      errors.push({ key: errorKey, message: error.message });
    }
    if (!state.visible) return;
    if (state.disabled && props.value === undefined) return;

    const validation = resolveValidation(node, rootData, data, errorKey, errors);
    const effectiveNode: ControlNode = {
      ...node,
      props: state.props as ControlNode["props"],
      validation,
    };
    const value = data[node.key];
    const messages = validateControlValue(effectiveNode, value);
    for (const message of messages) errors.push({ key: errorKey, message });
    return;
  }

  if (node.layoutType === "repeater") {
    validateRepeater(node, rootData, data, prefix, errors);
    return;
  }

  node.children.forEach((child) => validateNode(child, rootData, data, prefix, errors));
}

function validateRepeater(
  node: LayoutNode,
  rootData: Record<string, SubmissionDataValue>,
  data: Record<string, SubmissionDataValue>,
  prefix: string,
  errors: ValidationError[]
) {
  const key = node.key ?? node.id;
  const value = data[key];
  const items = Array.isArray(value) ? value.filter(isRecordValue) : [];
  const props = node.props as { minItems?: number; maxItems?: number } | undefined;
  const minItems = props?.minItems;
  const maxItems = props?.maxItems;
  const errorKey = prefix ? `${prefix}.${key}` : key;

  if (minItems !== undefined && items.length < minItems) {
    errors.push({ key: errorKey, message: `Add at least ${minItems} item${minItems === 1 ? "" : "s"}.` });
  }
  if (maxItems !== undefined && items.length > maxItems) {
    errors.push({ key: errorKey, message: `Add no more than ${maxItems} item${maxItems === 1 ? "" : "s"}.` });
  }

  items.forEach((item, index) => {
    const childPrefix = `${errorKey}.${index}`;
    node.children.forEach((child) => validateNode(child, rootData, item, childPrefix, errors));
  });
}

export function validateControlValue(node: ControlNode, value: SubmissionDataValue): string[] {
  const errors: string[] = [];

  if (node.controlType === "button") return errors;

  if (node.validation?.required === true && isEmptyValue(value)) {
    errors.push("This field is required.");
    return errors;
  }

  switch (node.controlType) {
    case "text": {
      if (typeof value !== "string") return errors;
      const props = node.props as TextProps | undefined;
      const minLength = numberValue(node.validation?.minLength);
      const maxLength = numberValue(node.validation?.maxLength) ?? numberValue(props?.maxLength);
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
      const min = numberValue(node.validation?.min) ?? numberValue(props?.min);
      const max = numberValue(node.validation?.max) ?? numberValue(props?.max);
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
      const maxItems = numberValue(node.validation?.maxItems) ?? numberValue(props?.maxSelected);
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
      const maxItems = numberValue(node.validation?.maxItems) ?? numberValue(props?.maxFiles);
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

function resolveValidation(
  node: ControlNode,
  rootData: Record<string, SubmissionDataValue>,
  data: Record<string, SubmissionDataValue>,
  errorKey: string,
  errors: ValidationError[],
): ValidationRules | undefined {
  if (!node.validation) return undefined;
  const resolved = resolveDynamicValue(node.validation, { rootData, itemData: data }, `controls.${node.key}.validation`);
  for (const error of resolved.errors) {
    errors.push({ key: errorKey, message: error.message });
  }
  return resolved.value && typeof resolved.value === "object" && !Array.isArray(resolved.value)
    ? (resolved.value as ValidationRules)
    : undefined;
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

function isRecordValue(value: unknown): value is Record<string, SubmissionDataValue> {
  return !!value && typeof value === "object" && !Array.isArray(value) && !("fileId" in (value as Record<string, unknown>));
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
