type ValidationError = { key: string; message: string };
type FormNode = Record<string, unknown>;

export function validateSubmissionData(
  schemaJson: unknown,
  data: Record<string, unknown>,
): ValidationError[] {
  const root = readRoot(schemaJson);
  if (!root) return [{ key: "schema", message: "Published form schema is invalid." }];
  const errors: ValidationError[] = [];
  validateNode(root, data, "", errors);
  return errors;
}

function validateNode(
  node: FormNode,
  data: Record<string, unknown>,
  prefix: string,
  errors: ValidationError[],
) {
  if (node.type === "control") {
    const key = typeof node.key === "string" ? node.key : "";
    if (!key) return;
    const validation = readRecord(node.validation);
    const props = readRecord(node.props);
    const required = validation.required === true || props.required === true;
    const value = data[key];
    if (required && isEmpty(value)) {
      errors.push({ key: prefix ? `${prefix}.${key}` : key, message: "This field is required." });
    }
    return;
  }

  if (node.type !== "layout") return;
  if (node.layoutType === "repeater") {
    validateRepeater(node, data, prefix, errors);
    return;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    if (isRecord(child)) validateNode(child, data, prefix, errors);
  }
}

function validateRepeater(
  node: FormNode,
  data: Record<string, unknown>,
  prefix: string,
  errors: ValidationError[],
) {
  const key = typeof node.key === "string" ? node.key : typeof node.id === "string" ? node.id : "";
  if (!key) return;
  const value = data[key];
  const items = Array.isArray(value) ? value.filter(isRecord) : [];
  const props = readRecord(node.props);
  const minItems = typeof props.minItems === "number" ? props.minItems : undefined;
  const maxItems = typeof props.maxItems === "number" ? props.maxItems : undefined;
  const errorKey = prefix ? `${prefix}.${key}` : key;

  if (minItems !== undefined && items.length < minItems) {
    errors.push({ key: errorKey, message: `Add at least ${minItems} item${minItems === 1 ? "" : "s"}.` });
  }
  if (maxItems !== undefined && items.length > maxItems) {
    errors.push({ key: errorKey, message: `Add no more than ${maxItems} item${maxItems === 1 ? "" : "s"}.` });
  }

  const children = Array.isArray(node.children) ? node.children : [];
  items.forEach((item, index) => {
    for (const child of children) {
      if (isRecord(child)) validateNode(child, item, `${errorKey}.${index}`, errors);
    }
  });
}

function readRoot(schemaJson: unknown): FormNode | null {
  if (!isRecord(schemaJson)) return null;
  return isRecord(schemaJson.root) ? schemaJson.root : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEmpty(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
