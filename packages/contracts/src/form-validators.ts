// packages/contracts/form-validators.ts

import type {
  ControlNode,
  DataSourceDatasetMap,
  FormDefinition,
  LayoutNode,
  MultiSelectProps,
  Node,
  NumberProps,
  OptionItem,
  TextProps,
  FileProps,
  ValidationRules,
} from "./form-types";
import type { SubmissionDataValue } from "./submission-types";
import {
  evaluateCalculatedFormData,
  isExpressionString,
  resolveControlState,
  resolveDynamicValue,
} from "./expressions";
import type { ExpressionVariableState } from "./expressions";

export type ValidationError = { key: string; message: string };

export function validateFormData(
  form: FormDefinition,
  data: Record<string, SubmissionDataValue>,
  datasets: DataSourceDatasetMap = {},
  variables: ExpressionVariableState = {},
): ValidationError[] {
  const calculated = evaluateCalculatedFormData(form, data, datasets, variables);
  const errors: ValidationError[] = calculated.errors.map((error) => ({
    key: error.key ?? error.path,
    message: error.message,
  }));
  validateNode(form.root, calculated.data, calculated.data, "", errors, datasets, variables);
  return errors;
}

function validateNode(
  node: Node,
  rootData: Record<string, SubmissionDataValue>,
  data: Record<string, SubmissionDataValue>,
  prefix: string,
  errors: ValidationError[],
  datasets: DataSourceDatasetMap,
  variables: ExpressionVariableState,
  rowIndex?: number,
) {
  if (node.type === "control") {
    if (node.controlType === "button" || isListViewControlType(node.controlType)) return;
    const props = (node.props ?? {}) as Record<string, unknown>;
    const state = resolveControlState(node, { rootData, itemData: data, rowIndex, datasets, variables });
    const errorKey = prefix ? `${prefix}.${node.key}` : node.key;
    for (const error of state.errors) {
      errors.push({ key: errorKey, message: error.message });
    }
    if (!state.visible) return;
    if (state.disabled && props.value === undefined) return;

    const validation = resolveValidation(node, rootData, data, errorKey, errors, datasets, variables, rowIndex);
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
    validateRepeater(node, rootData, data, prefix, errors, datasets, variables);
    return;
  }

  node.children.forEach((child) => validateNode(child, rootData, data, prefix, errors, datasets, variables, rowIndex));
}

function validateRepeater(
  node: LayoutNode,
  rootData: Record<string, SubmissionDataValue>,
  data: Record<string, SubmissionDataValue>,
  prefix: string,
  errors: ValidationError[],
  datasets: DataSourceDatasetMap,
  variables: ExpressionVariableState,
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
    node.children.forEach((child) => validateNode(child, rootData, item, childPrefix, errors, datasets, variables, index));
  });
}

export function validateControlValue(node: ControlNode, value: SubmissionDataValue): string[] {
  const errors: string[] = [];

  if (node.controlType === "button" || isListViewControlType(node.controlType)) return errors;

  if (node.validation?.required === true && isEmptyValue(value)) {
    errors.push("This field is required.");
    return errors;
  }

  switch (node.controlType) {
    case "dropdown":
    case "segmented": {
      const message = validateSingleOptionMembership(node.props, value);
      if (message) errors.push(message);
      return errors;
    }

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
      if (!isEmptyValue(value)) {
        if (!Array.isArray(value)) {
          errors.push("Select only available options.");
          return errors;
        }
        const message = validateMultiOptionMembership(node.props, value);
        if (message) errors.push(message);
      }
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
  datasets: DataSourceDatasetMap,
  variables: ExpressionVariableState,
  rowIndex?: number,
): ValidationRules | undefined {
  if (!node.validation) return undefined;
  const resolved = resolveDynamicValue(
    node.validation,
    { rootData, itemData: data, rowIndex, datasets, variables },
    `controls.${node.key}.validation`,
  );
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

export function getResolvedControlOptions(props: unknown): OptionItem[] {
  return readResolvedOptions(props).options;
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

function validateSingleOptionMembership(props: unknown, value: SubmissionDataValue): string | undefined {
  if (isEmptyValue(value)) return undefined;
  if (typeof value !== "string") return "Select an available option.";

  const resolution = readResolvedOptions(props);
  if (!resolution.resolved) return undefined;
  return selectableOptionValues(resolution.options).has(value) ? undefined : "Select an available option.";
}

function validateMultiOptionMembership(props: unknown, value: unknown[]): string | undefined {
  if (!value.every((item) => typeof item === "string")) return "Select only available options.";

  const resolution = readResolvedOptions(props);
  if (!resolution.resolved) return undefined;
  const available = selectableOptionValues(resolution.options);
  return value.every((item) => available.has(item)) ? undefined : "Select only available options.";
}

function readResolvedOptions(props: unknown): { resolved: boolean; options: OptionItem[] } {
  if (!isRecord(props)) return { resolved: true, options: [] };
  const rawOptions = props.options;
  if (isExpressionString(rawOptions)) return { resolved: false, options: [] };
  return { resolved: true, options: normalizeOptions(rawOptions) };
}

function normalizeOptions(value: unknown): OptionItem[] {
  if (!Array.isArray(value)) return [];
  const options: OptionItem[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const optionValue = optionText(item.value);
    if (optionValue === undefined) continue;
    const label = optionText(item.label) ?? optionValue;
    options.push({
      label,
      value: optionValue,
      ...(item.disabled === true ? { disabled: true } : {}),
    });
  }
  return options;
}

function selectableOptionValues(options: OptionItem[]): Set<string> {
  const values = new Set<string>();
  for (const option of options) {
    if (option.disabled !== true) values.add(option.value);
  }
  return values;
}

function optionText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isListViewControlType(controlType: unknown): boolean {
  return controlType === "listview" || controlType === "listView" || controlType === "list_view";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
