import type { ControlNode, FormDefinition, LayoutNode, Node } from "../../../../../packages/contracts/src/form-types";
import type { SubmissionDataValue } from "../../../../../packages/contracts/src/submission-types";
import { evaluateCalculatedFormData } from "../../../../../packages/contracts/src/expressions";
import { validateFormData } from "../../../../../packages/contracts/src/form-validators";

type ValidationError = { key: string; message: string };

export function validateSubmissionData(
  schemaJson: unknown,
  data: Record<string, unknown>,
): ValidationError[] {
  return validateAndNormalizeSubmissionData(schemaJson, data).errors;
}

export function validateAndNormalizeSubmissionData(
  schemaJson: unknown,
  data: Record<string, unknown>,
): { data: Record<string, SubmissionDataValue>; errors: ValidationError[] } {
  const form = readFormDefinition(schemaJson);
  if (!form) {
    return {
      data: data as Record<string, SubmissionDataValue>,
      errors: [{ key: "schema", message: "Published form schema is invalid." }],
    };
  }

  const calculated = evaluateCalculatedFormData(form, data);
  const errors: ValidationError[] = calculated.errors.map((error) => ({
    key: error.key ?? error.path,
    message: error.message,
  }));

  errors.push(...compareCalculatedValues(form.root, data, calculated.data, ""));
  errors.push(...validateFormData(form, calculated.data));

  return {
    data: calculated.data,
    errors: dedupeErrors(errors),
  };
}

function compareCalculatedValues(
  node: Node,
  submittedData: Record<string, unknown>,
  calculatedData: Record<string, SubmissionDataValue>,
  prefix: string,
): ValidationError[] {
  if (node.type === "control") {
    if (!hasCalculatedValue(node)) return [];
    if (!Object.prototype.hasOwnProperty.call(submittedData, node.key)) return [];
    const key = prefix ? `${prefix}.${node.key}` : node.key;
    return jsonEqual(submittedData[node.key], calculatedData[node.key])
      ? []
      : [{ key, message: "Submitted calculated value does not match the form expression." }];
  }

  if (node.layoutType === "repeater") {
    return compareRepeaterCalculatedValues(node, submittedData, calculatedData, prefix);
  }

  return node.children.flatMap((child) => compareCalculatedValues(child, submittedData, calculatedData, prefix));
}

function compareRepeaterCalculatedValues(
  node: LayoutNode,
  submittedData: Record<string, unknown>,
  calculatedData: Record<string, SubmissionDataValue>,
  prefix: string,
): ValidationError[] {
  const key = node.key ?? node.id;
  const submittedItems = Array.isArray(submittedData[key]) ? submittedData[key] : [];
  const calculatedItems = Array.isArray(calculatedData[key]) ? calculatedData[key] : [];
  const errorKey = prefix ? `${prefix}.${key}` : key;
  const errors: ValidationError[] = [];

  submittedItems.forEach((submittedItem, index) => {
    const calculatedItem = calculatedItems[index];
    if (!isRecord(submittedItem) || !isRecord(calculatedItem)) return;
    for (const child of node.children) {
      errors.push(
        ...compareCalculatedValues(
          child,
          submittedItem,
          calculatedItem as Record<string, SubmissionDataValue>,
          `${errorKey}.${index}`,
        ),
      );
    }
  });

  return errors;
}

function hasCalculatedValue(node: ControlNode): boolean {
  return isRecord(node.props) && node.props.value !== undefined;
}

function readFormDefinition(schemaJson: unknown): FormDefinition | null {
  if (!isRecord(schemaJson) || !isRecord(schemaJson.root)) return null;
  return schemaJson as unknown as FormDefinition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function dedupeErrors(errors: ValidationError[]): ValidationError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.key}:${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
