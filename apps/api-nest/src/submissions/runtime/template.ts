export type TemplateContext = {
  submissionId: string;
  appCode: string;
  formKey: string;
  formVersion: number;
  data: Record<string, unknown>;
};

export function renderTemplate(value: string | undefined, context: TemplateContext, fallback = "") {
  const template = value ?? fallback;
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, token: string) => {
    const resolved = token.startsWith("data.") ? readPath(context.data, token.slice(5)) : readPath(context, token);
    if (resolved === null || resolved === undefined) return "";
    if (typeof resolved === "object") return JSON.stringify(resolved);
    return String(resolved);
  });
}

export function renderJsonTemplate(value: unknown, context: TemplateContext): unknown {
  if (typeof value === "string") return renderTemplate(value, context);
  if (Array.isArray(value)) return value.map((item) => renderJsonTemplate(item, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        renderJsonTemplate(item, context),
      ]),
    );
  }
  return value;
}

export function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  let current = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });
}

export function readPath(source: unknown, path: string): unknown {
  if (!path) return source;
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}
