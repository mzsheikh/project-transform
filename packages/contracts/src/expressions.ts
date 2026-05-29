import type {
  ControlNode,
  ControlType,
  DataSourceDatasetMap,
  DataSourceDefinition,
  FormDefinition,
  LayoutNode,
  Node,
} from "./form-types";
import type { SubmissionDataValue } from "./submission-types";

export type ExpressionValue =
  | string
  | number
  | boolean
  | null
  | ExpressionValue[]
  | { [key: string]: ExpressionValue | undefined };

export type ExpressionIssue = {
  code: string;
  message: string;
  path: string;
  expression?: string;
};

export type ExpressionRuntimeError = {
  key?: string;
  path: string;
  message: string;
  expression?: string;
};

export type ExpressionContext = {
  rootData: Record<string, unknown>;
  itemData?: Record<string, unknown>;
  rowIndex?: number;
  today?: Date;
  datasets?: DataSourceDatasetMap;
};

export type ResolvedControlState = {
  props: Record<string, unknown>;
  disabled: boolean;
  readOnly: boolean;
  visible: boolean;
  errors: ExpressionRuntimeError[];
};

type Token =
  | { type: "number"; value: string; pos: number }
  | { type: "string"; value: string; pos: number }
  | { type: "identifier"; value: string; pos: number }
  | { type: "operator"; value: string; pos: number }
  | { type: "paren"; value: "(" | ")"; pos: number }
  | { type: "comma"; value: ","; pos: number }
  | { type: "eof"; value: ""; pos: number };

type AstNode =
  | { kind: "literal"; value: unknown }
  | { kind: "identifier"; name: string }
  | { kind: "unary"; op: string; expr: AstNode }
  | { kind: "binary"; op: string; left: AstNode; right: AstNode }
  | { kind: "call"; name: string; args: AstNode[] };

type Dependency =
  | { key: string; kind: "field" | "root" | "item" }
  | { key: string; kind: "dataset" }
  | { key: string; kind: "repeater" }
  | { key: string; kind: "repeaterField"; repeaterKey: string };

class ExpressionSyntaxError extends Error {}
class ExpressionEvaluationError extends Error {}

export function isExpressionString(value: unknown): value is `=${string}` {
  return typeof value === "string" && value.startsWith("=");
}

export function isEscapedExpressionString(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("'=");
}

export function unescapeExpressionLiteral<T>(value: T): T | string {
  return isEscapedExpressionString(value) ? value.slice(1) : value;
}

export function parseFormula(expression: string): AstNode {
  const source = expression.startsWith("=") ? expression.slice(1) : expression;
  const parser = new Parser(new Lexer(source).scan());
  return parser.parse();
}

export function validateExpressionSyntax(expression: string): ExpressionIssue[] {
  try {
    parseFormula(expression);
    return [];
  } catch (error) {
    return [{
      code: "expression.syntax",
      path: "",
      expression,
      message: error instanceof Error ? error.message : "Expression is invalid.",
    }];
  }
}

export function evaluateExpression(expression: string, context: ExpressionContext): unknown {
  return evaluateAst(parseFormula(expression), context);
}

export function resolveDynamicValue(
  value: unknown,
  context: ExpressionContext,
  path = "props",
): { value: unknown; errors: ExpressionRuntimeError[] } {
  if (isExpressionString(value)) {
    try {
      return { value: evaluateExpression(value, context), errors: [] };
    } catch (error) {
      return {
        value: null,
        errors: [{
          path,
          expression: value,
          message: error instanceof Error ? error.message : "Expression failed.",
        }],
      };
    }
  }

  if (isEscapedExpressionString(value)) {
    return { value: value.slice(1), errors: [] };
  }

  if (Array.isArray(value)) {
    const next: unknown[] = [];
    const errors: ExpressionRuntimeError[] = [];
    value.forEach((item, index) => {
      const resolved = resolveDynamicValue(item, context, `${path}.${index}`);
      next.push(resolved.value);
      errors.push(...resolved.errors);
    });
    return { value: next, errors };
  }

  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    const errors: ExpressionRuntimeError[] = [];
    for (const [key, child] of Object.entries(value)) {
      const resolved = resolveDynamicValue(child, context, `${path}.${key}`);
      next[key] = resolved.value;
      errors.push(...resolved.errors);
    }
    return { value: next, errors };
  }

  return { value, errors: [] };
}

export function resolveControlState(node: ControlNode, context: ExpressionContext): ResolvedControlState {
  const resolved = resolveDynamicValue(node.props ?? {}, context, `controls.${node.key}.props`);
  const props = isRecord(resolved.value) ? resolved.value : {};
  const errors = resolved.errors.map((error) => ({ ...error, key: node.key }));

  const enabled = readBooleanProp(props.enabled, true);
  const disabledByFlag = readBooleanProp(props.disabled, false);
  const disabled = props.enabled !== undefined ? !enabled : disabledByFlag;
  const readOnly = readBooleanProp(props.readOnly, false);
  const visible = readVisibility(props);

  return {
    props: { ...props, disabled, readOnly },
    disabled,
    readOnly,
    visible,
    errors,
  };
}

export function evaluateCalculatedFormData(
  form: FormDefinition,
  inputData: Record<string, unknown>,
  datasets: DataSourceDatasetMap = {},
): { data: Record<string, SubmissionDataValue>; errors: ExpressionRuntimeError[] } {
  const data = cloneRecord(inputData) as Record<string, SubmissionDataValue>;
  const errors: ExpressionRuntimeError[] = [];
  const iterations = Math.max(1, countControls(form.root) + 1);

  for (let i = 0; i < iterations; i += 1) {
    const before = stableJson(data);
    applyNodeExpressions(form.root, data, data, errors, undefined, undefined, datasets);
    if (stableJson(data) === before) break;
  }

  return { data, errors: dedupeRuntimeErrors(errors) };
}

export function validateFormExpressions(form: FormDefinition): ExpressionIssue[] {
  if (!form || !isRecord(form) || !isRecord((form as unknown as Record<string, unknown>).root)) {
    return [{
      code: "expression.invalidSchema",
      path: "root",
      message: "Form schema root is invalid.",
    }];
  }
  const dataSourceIssues = validateDataSources(form.dataSources);
  const registry = buildRegistry(form.root, new Set(readDataSources(form.dataSources).map((source) => source.key)));
  const issues: ExpressionIssue[] = [];
  const valueDependencies = new Map<string, Set<string>>();
  issues.push(...dataSourceIssues);

  readDataSources(form.dataSources).forEach((source, index) => {
    collectExpressionProps(source.params ?? {}, `dataSources.${index}.params`).forEach(({ expression, path }) => {
      let ast: AstNode;
      try {
        ast = parseFormula(expression);
      } catch (error) {
        issues.push({
          code: "expression.syntax",
          path,
          expression,
          message: error instanceof Error ? error.message : "Expression is invalid.",
        });
        return;
      }

      for (const dependency of collectDependencies(ast)) {
        if (!dependencyExists(dependency, registry)) {
          issues.push({
            code: "expression.missingReference",
            path,
            expression,
            message: `Expression references unknown ${dependency.kind} "${dependency.key}".`,
          });
        }
      }
    });
  });

  walkNodes(form.root, (node, path) => {
    if (node.type !== "control") return;
    const props = isRecord(node.props) ? node.props : {};

    if (props.enabled !== undefined && props.disabled !== undefined) {
      issues.push({
        code: "expression.enabledDisabledConflict",
        path: `${path}.props`,
        message: `Control "${node.key}" cannot define both props.enabled and props.disabled.`,
      });
    }

    if (node.controlType === "button") {
      issues.push(...validateButtonActions(props, `${path}.props.actions`, node.key));
    }

    const expressionProps = [
      ...collectExpressionProps(props, `${path}.props`),
      ...collectExpressionProps(node.validation ?? {}, `${path}.validation`),
    ];

    expressionProps.forEach(({ expression, path: expressionPath }) => {
      let ast: AstNode;
      try {
        ast = parseFormula(expression);
      } catch (error) {
        issues.push({
          code: "expression.syntax",
          path: expressionPath,
          expression,
          message: error instanceof Error ? error.message : "Expression is invalid.",
        });
        return;
      }

      const dependencies = collectDependencies(ast);
      for (const dependency of dependencies) {
        if (!dependencyExists(dependency, registry)) {
          issues.push({
            code: "expression.missingReference",
            path: expressionPath,
            expression,
            message: `Expression references unknown ${dependency.kind} "${dependency.key}".`,
          });
        }
      }

      if (expressionPath.endsWith(".value")) {
        const controlDeps = dependencies
          .filter((dependency) => dependency.kind === "field" || dependency.kind === "root" || dependency.kind === "item")
          .map((dependency) => dependency.key);
        valueDependencies.set(node.key, new Set(controlDeps.filter((key) => registry.controlKeys.has(key))));
      }
    });
  });

  for (const cycle of findCycles(valueDependencies)) {
    issues.push({
      code: "expression.valueCycle",
      path: "root",
      message: `Calculated value cycle detected: ${cycle.join(" -> ")}.`,
    });
  }

  return dedupeIssues(issues);
}

function validateDataSources(value: unknown): ExpressionIssue[] {
  const sources = readDataSources(value);
  const issues: ExpressionIssue[] = [];
  const seen = new Set<string>();

  if (value !== undefined && !Array.isArray(value)) {
    return [{
      code: "dataSource.invalidList",
      path: "dataSources",
      message: "Form dataSources must be an array.",
    }];
  }

  sources.forEach((source, index) => {
    const path = `dataSources.${index}`;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(source.key)) {
      issues.push({
        code: "dataSource.invalidKey",
        path: `${path}.key`,
        message: `Data source key "${source.key}" must be a valid expression identifier.`,
      });
    }
    if (seen.has(source.key)) {
      issues.push({
        code: "dataSource.duplicateKey",
        path: `${path}.key`,
        message: `Data source key "${source.key}" is duplicated.`,
      });
    }
    seen.add(source.key);

    if (!source.connectorId || typeof source.connectorId !== "string") {
      issues.push({
        code: "dataSource.missingConnector",
        path: `${path}.connectorId`,
        message: `Data source "${source.key}" must reference a connector.`,
      });
    }

    if (
      source.cacheTtlSeconds !== undefined &&
      (!Number.isFinite(source.cacheTtlSeconds) || source.cacheTtlSeconds < 0)
    ) {
      issues.push({
        code: "dataSource.invalidCacheTtl",
        path: `${path}.cacheTtlSeconds`,
        message: `Data source "${source.key}" cache TTL must be zero or greater.`,
      });
    }

    if (source.type === "database") {
      const query = source.config?.query;
      if (typeof query !== "string" || !query.trim()) {
        issues.push({
          code: "dataSource.missingQuery",
          path: `${path}.config.query`,
          message: `Database data source "${source.key}" must define a query.`,
        });
      } else if (!isReadOnlySql(query)) {
        issues.push({
          code: "dataSource.unsafeQuery",
          path: `${path}.config.query`,
          message: `Database data source "${source.key}" query must be a single read-only SELECT or WITH query.`,
        });
      }
      const limit = source.config?.limit;
      if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0 || limit > 5000)) {
        issues.push({
          code: "dataSource.invalidLimit",
          path: `${path}.config.limit`,
          message: `Database data source "${source.key}" limit must be between 1 and 5000.`,
        });
      }
    } else if (source.type === "rest_api") {
      if (typeof source.config?.pathTemplate !== "string" || !source.config.pathTemplate.trim()) {
        issues.push({
          code: "dataSource.missingPathTemplate",
          path: `${path}.config.pathTemplate`,
          message: `REST data source "${source.key}" must define a pathTemplate.`,
        });
      }
      if (
        source.config?.method !== undefined &&
        !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(source.config.method).toUpperCase())
      ) {
        issues.push({
          code: "dataSource.invalidMethod",
          path: `${path}.config.method`,
          message: `REST data source "${source.key}" method is invalid.`,
        });
      }
    } else {
      issues.push({
        code: "dataSource.invalidType",
        path: `${path}.type`,
        message: "Data source type is invalid.",
      });
    }
  });

  return issues;
}

function readDataSources(value: unknown): DataSourceDefinition[] {
  return Array.isArray(value)
    ? value.filter((source): source is DataSourceDefinition => isRecord(source) && typeof source.key === "string")
    : [];
}

function isReadOnlySql(query: string): boolean {
  const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized || normalized.includes(";") || normalized.includes("--") || normalized.includes("/*")) return false;
  if (!/^(select|with)\b/.test(normalized)) return false;
  return !/\b(insert|update|delete|drop|alter|truncate|create|merge|grant|revoke|call|execute|exec)\b/.test(normalized);
}

function validateButtonActions(
  props: Record<string, unknown>,
  path: string,
  key: string,
): ExpressionIssue[] {
  const actions = props.actions;
  const issues: ExpressionIssue[] = [];

  if (!Array.isArray(actions) || actions.length === 0) {
    return [{
      code: "button.actionsRequired",
      path,
      message: `Button "${key}" must define at least one action.`,
    }];
  }

  let enabledCount = 0;
  actions.forEach((action, index) => {
    if (!isRecord(action)) {
      issues.push({
        code: "button.invalidAction",
        path: `${path}.${index}`,
        message: `Button "${key}" action must be an object.`,
      });
      return;
    }

    if (action.enabled !== false) enabledCount += 1;
    if (
      action.type !== "save_draft" &&
      action.type !== "email_pdf" &&
      action.type !== "database" &&
      action.type !== "rest_api"
    ) {
      issues.push({
        code: "button.invalidActionType",
        path: `${path}.${index}.type`,
        message: `Button "${key}" action type is invalid.`,
      });
    }
  });

  if (enabledCount === 0) {
    issues.push({
      code: "button.enabledActionRequired",
      path,
      message: `Button "${key}" must have at least one enabled action.`,
    });
  }

  return issues;
}

export function formHasExpressions(form: FormDefinition): boolean {
  let found = false;
  if (readDataSources(form.dataSources).some((source, index) => collectExpressionProps(source.params ?? {}, `dataSources.${index}.params`).length > 0)) {
    return true;
  }
  walkNodes(form.root, (node) => {
    if (found || node.type !== "control") return;
    found =
      collectExpressionProps(node.props ?? {}, `controls.${node.key}.props`).length > 0 ||
      collectExpressionProps(node.validation ?? {}, `controls.${node.key}.validation`).length > 0;
  });
  return found;
}

export function collectExpressionDependencies(expression: string): string[] {
  return Array.from(new Set(collectDependencies(parseFormula(expression)).map((dependency) => dependency.key)));
}

function applyNodeExpressions(
  node: Node,
  rootData: Record<string, SubmissionDataValue>,
  scopeData: Record<string, unknown>,
  errors: ExpressionRuntimeError[],
  rowIndex: number | undefined,
  errorPrefix: string | undefined,
  datasets: DataSourceDatasetMap,
) {
  if (node.type === "control") {
    if (node.controlType === "button") return;
    applyControlExpressions(node, rootData, scopeData, errors, rowIndex, errorPrefix, datasets);
    return;
  }

  if (node.layoutType === "repeater") {
    const repeaterKey = node.key ?? node.id;
    const current = rootData[repeaterKey];
    if (!Array.isArray(current)) return;
    current.forEach((item, index) => {
      if (!isRecord(item)) return;
      node.children.forEach((child) => {
        applyNodeExpressions(child, rootData, item, errors, index, errorPrefix ? `${errorPrefix}.${index}` : `${repeaterKey}.${index}`, datasets);
      });
    });
    return;
  }

  node.children.forEach((child) => {
    applyNodeExpressions(child, rootData, scopeData, errors, rowIndex, errorPrefix, datasets);
  });
}

function applyControlExpressions(
  node: ControlNode,
  rootData: Record<string, SubmissionDataValue>,
  scopeData: Record<string, unknown>,
  errors: ExpressionRuntimeError[],
  rowIndex: number | undefined,
  errorPrefix: string | undefined,
  datasets: DataSourceDatasetMap,
) {
  const props = isRecord(node.props) ? node.props : {};
  const context: ExpressionContext = {
    rootData,
    itemData: scopeData,
    rowIndex,
    datasets,
  };
  const target = scopeData as Record<string, unknown>;
  const errorKey = errorPrefix ? `${errorPrefix}.${node.key}` : node.key;

  if (props.value !== undefined) {
    const result = resolveDynamicValue(props.value, context, `controls.${node.key}.props.value`);
    if (result.errors.length > 0) {
      errors.push(...result.errors.map((error) => ({ ...error, key: errorKey })));
      return;
    }
    const coerced = coerceSubmissionValue(node.controlType, result.value);
    if (coerced.ok === false) {
      errors.push({
        key: errorKey,
        path: `controls.${node.key}.props.value`,
        expression: isExpressionString(props.value) ? props.value : undefined,
        message: coerced.message,
      });
      return;
    }
    target[node.key] = coerced.value;
    return;
  }

  if (isEmptyValue(target[node.key]) && props.defaultValue !== undefined) {
    const result = resolveDynamicValue(props.defaultValue, context, `controls.${node.key}.props.defaultValue`);
    if (result.errors.length > 0) {
      errors.push(...result.errors.map((error) => ({ ...error, key: errorKey })));
      return;
    }
    const coerced = coerceSubmissionValue(node.controlType, result.value);
    if (coerced.ok) target[node.key] = coerced.value;
  }
}

function coerceSubmissionValue(
  controlType: ControlType,
  value: unknown,
): { ok: true; value: SubmissionDataValue } | { ok: false; message: string } {
  if (value === null || value === undefined) return { ok: true, value: null };

  switch (controlType) {
    case "text":
    case "date":
    case "dropdown":
    case "signature":
      return typeof value === "string"
        ? { ok: true, value }
        : { ok: false, message: `Calculated value for ${controlType} must be text.` };
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false, message: "Calculated value for number must be numeric." };
    case "switch":
      return typeof value === "boolean"
        ? { ok: true, value }
        : { ok: false, message: "Calculated value for switch must be boolean." };
    case "multiselect":
      return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? { ok: true, value: value as string[] }
        : { ok: false, message: "Calculated value for multiselect must be a text list." };
    case "image":
      return isFileRefLike(value)
        ? { ok: true, value: value as SubmissionDataValue }
        : { ok: false, message: "Calculated value for image must be a file reference." };
    case "file":
      if (isFileRefLike(value)) return { ok: true, value: value as SubmissionDataValue };
      return Array.isArray(value) && value.every(isFileRefLike)
        ? { ok: true, value: value as SubmissionDataValue }
        : { ok: false, message: "Calculated value for file must be a file reference or file list." };
    default:
      return { ok: true, value: value as SubmissionDataValue };
  }
}

class Lexer {
  private pos = 0;

  constructor(private readonly source: string) {}

  scan(): Token[] {
    const tokens: Token[] = [];
    while (!this.done()) {
      const char = this.peek();
      if (/\s/.test(char)) {
        this.pos += 1;
        continue;
      }
      if (isDigit(char) || (char === "." && isDigit(this.peek(1)))) {
        tokens.push(this.scanNumber());
        continue;
      }
      if (char === "\"" || char === "'") {
        tokens.push(this.scanString());
        continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        tokens.push(this.scanIdentifier());
        continue;
      }
      if (char === "(" || char === ")") {
        tokens.push({ type: "paren", value: char, pos: this.pos } as Token);
        this.pos += 1;
        continue;
      }
      if (char === ",") {
        tokens.push({ type: "comma", value: ",", pos: this.pos });
        this.pos += 1;
        continue;
      }
      const two = `${char}${this.peek(1)}`;
      if (["==", "!=", "<>", "<=", ">="].includes(two)) {
        tokens.push({ type: "operator", value: two, pos: this.pos });
        this.pos += 2;
        continue;
      }
      if (["+", "-", "*", "/", "%", "^", "&", "=", "<", ">"].includes(char)) {
        tokens.push({ type: "operator", value: char, pos: this.pos });
        this.pos += 1;
        continue;
      }
      throw new ExpressionSyntaxError(`Unexpected character "${char}" at position ${this.pos + 1}.`);
    }
    tokens.push({ type: "eof", value: "", pos: this.pos });
    return tokens;
  }

  private scanNumber(): Token {
    const start = this.pos;
    while (isDigit(this.peek())) this.pos += 1;
    if (this.peek() === ".") {
      this.pos += 1;
      while (isDigit(this.peek())) this.pos += 1;
    }
    return { type: "number", value: this.source.slice(start, this.pos), pos: start };
  }

  private scanString(): Token {
    const quote = this.peek();
    const start = this.pos;
    this.pos += 1;
    let value = "";
    while (!this.done()) {
      const char = this.peek();
      this.pos += 1;
      if (char === quote) return { type: "string", value, pos: start };
      if (char === "\\") {
        const escaped = this.peek();
        this.pos += 1;
        value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
      } else {
        value += char;
      }
    }
    throw new ExpressionSyntaxError(`Unterminated string at position ${start + 1}.`);
  }

  private scanIdentifier(): Token {
    const start = this.pos;
    while (/[A-Za-z0-9_]/.test(this.peek())) this.pos += 1;
    return { type: "identifier", value: this.source.slice(start, this.pos), pos: start };
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? "";
  }

  private done() {
    return this.pos >= this.source.length;
  }
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): AstNode {
    const expr = this.parseOr();
    if (this.current().type !== "eof") {
      throw new ExpressionSyntaxError(`Unexpected token "${this.current().value}" at position ${this.current().pos + 1}.`);
    }
    return expr;
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (this.matchIdentifier("OR")) {
      left = { kind: "binary", op: "OR", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseComparison();
    while (this.matchIdentifier("AND")) {
      left = { kind: "binary", op: "AND", left, right: this.parseComparison() };
    }
    return left;
  }

  private parseComparison(): AstNode {
    let left = this.parseConcat();
    while (this.isOperator(["=", "==", "!=", "<>", "<", "<=", ">", ">="])) {
      const op = this.advance().value;
      left = { kind: "binary", op, left, right: this.parseConcat() };
    }
    return left;
  }

  private parseConcat(): AstNode {
    let left = this.parseTerm();
    while (this.matchOperator("&")) {
      left = { kind: "binary", op: "&", left, right: this.parseTerm() };
    }
    return left;
  }

  private parseTerm(): AstNode {
    let left = this.parseFactor();
    while (this.isOperator(["+", "-"])) {
      const op = this.advance().value;
      left = { kind: "binary", op, left, right: this.parseFactor() };
    }
    return left;
  }

  private parseFactor(): AstNode {
    let left = this.parsePower();
    while (this.isOperator(["*", "/", "%"])) {
      const op = this.advance().value;
      left = { kind: "binary", op, left, right: this.parsePower() };
    }
    return left;
  }

  private parsePower(): AstNode {
    const left = this.parseUnary();
    if (this.matchOperator("^")) {
      return { kind: "binary", op: "^", left, right: this.parsePower() };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.matchOperator("+")) return { kind: "unary", op: "+", expr: this.parseUnary() };
    if (this.matchOperator("-")) return { kind: "unary", op: "-", expr: this.parseUnary() };
    if (this.matchIdentifier("NOT")) return { kind: "unary", op: "NOT", expr: this.parseUnary() };
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const token = this.advance();
    if (token.type === "number") return { kind: "literal", value: Number(token.value) };
    if (token.type === "string") return { kind: "literal", value: token.value };

    if (token.type === "identifier") {
      const upper = token.value.toUpperCase();
      if (upper === "TRUE") return { kind: "literal", value: true };
      if (upper === "FALSE") return { kind: "literal", value: false };
      if (upper === "NULL" || upper === "BLANK") return { kind: "literal", value: null };
      if (this.matchParen("(")) {
        const args: AstNode[] = [];
        if (!this.matchParen(")")) {
          do {
            args.push(this.parseOr());
          } while (this.matchComma());
          this.consumeParen(")");
        }
        return { kind: "call", name: upper, args };
      }
      return { kind: "identifier", name: token.value };
    }

    if (token.type === "paren" && token.value === "(") {
      const expr = this.parseOr();
      this.consumeParen(")");
      return expr;
    }

    throw new ExpressionSyntaxError(`Unexpected token "${token.value}" at position ${token.pos + 1}.`);
  }

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const token = this.current();
    this.pos += 1;
    return token;
  }

  private matchIdentifier(value: string): boolean {
    const token = this.current();
    if (token.type === "identifier" && token.value.toUpperCase() === value) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private matchOperator(value: string): boolean {
    const token = this.current();
    if (token.type === "operator" && token.value === value) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private matchParen(value: "(" | ")"): boolean {
    const token = this.current();
    if (token.type === "paren" && token.value === value) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private consumeParen(value: "(" | ")") {
    if (!this.matchParen(value)) {
      throw new ExpressionSyntaxError(`Expected "${value}" at position ${this.current().pos + 1}.`);
    }
  }

  private matchComma(): boolean {
    if (this.current().type === "comma") {
      this.pos += 1;
      return true;
    }
    return false;
  }

  private isOperator(values: string[]): boolean {
    const token = this.current();
    return token.type === "operator" && values.includes(token.value);
  }
}

function evaluateAst(node: AstNode, context: ExpressionContext): unknown {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "identifier":
      return resolveIdentifier(node.name, context);
    case "unary": {
      const value = evaluateAst(node.expr, context);
      if (node.op === "+") return toNumber(value);
      if (node.op === "-") return -toNumber(value);
      if (node.op === "NOT") return !toBoolean(value);
      throw new ExpressionEvaluationError(`Unsupported unary operator "${node.op}".`);
    }
    case "binary":
      return evaluateBinary(node, context);
    case "call":
      return evaluateCall(node, context);
    default:
      return null;
  }
}

function evaluateBinary(node: Extract<AstNode, { kind: "binary" }>, context: ExpressionContext): unknown {
  if (node.op === "AND") {
    return toBoolean(evaluateAst(node.left, context)) && toBoolean(evaluateAst(node.right, context));
  }
  if (node.op === "OR") {
    return toBoolean(evaluateAst(node.left, context)) || toBoolean(evaluateAst(node.right, context));
  }

  const left = evaluateAst(node.left, context);
  const right = evaluateAst(node.right, context);

  switch (node.op) {
    case "+":
      return toNumber(left) + toNumber(right);
    case "-":
      return toNumber(left) - toNumber(right);
    case "*":
      return toNumber(left) * toNumber(right);
    case "/": {
      const divisor = toNumber(right);
      if (divisor === 0) throw new ExpressionEvaluationError("Cannot divide by zero.");
      return toNumber(left) / divisor;
    }
    case "%":
      return toNumber(left) % toNumber(right);
    case "^":
      return Math.pow(toNumber(left), toNumber(right));
    case "&":
      return `${toText(left)}${toText(right)}`;
    case "=":
    case "==":
      return compareEqual(left, right);
    case "!=":
    case "<>":
      return !compareEqual(left, right);
    case "<":
      return compareOrder(left, right) < 0;
    case "<=":
      return compareOrder(left, right) <= 0;
    case ">":
      return compareOrder(left, right) > 0;
    case ">=":
      return compareOrder(left, right) >= 0;
    default:
      throw new ExpressionEvaluationError(`Unsupported operator "${node.op}".`);
  }
}

function evaluateCall(node: Extract<AstNode, { kind: "call" }>, context: ExpressionContext): unknown {
  const name = node.name;

  if (name === "IF") {
    requireArgCount(name, node.args, 2, 3);
    return toBoolean(evaluateAst(node.args[0], context))
      ? evaluateAst(node.args[1], context)
      : node.args[2] ? evaluateAst(node.args[2], context) : null;
  }

  if (name === "IFERROR") {
    requireArgCount(name, node.args, 2, 2);
    try {
      return evaluateAst(node.args[0], context);
    } catch {
      return evaluateAst(node.args[1], context);
    }
  }

  if (name === "IFS") {
    if (node.args.length < 2 || node.args.length % 2 !== 0) {
      throw new ExpressionEvaluationError("IFS expects condition/result pairs.");
    }
    for (let i = 0; i < node.args.length; i += 2) {
      if (toBoolean(evaluateAst(node.args[i], context))) return evaluateAst(node.args[i + 1], context);
    }
    return null;
  }

  if (name === "AND") {
    return node.args.every((arg) => toBoolean(evaluateAst(arg, context)));
  }

  if (name === "OR") {
    return node.args.some((arg) => toBoolean(evaluateAst(arg, context)));
  }

  const args = node.args.map((arg) => evaluateAst(arg, context));

  switch (name) {
    case "FIELD":
      requireArgCount(name, node.args, 1, 1);
      return resolveIdentifier(String(args[0] ?? ""), context);
    case "ROOT":
      requireArgCount(name, node.args, 1, 1);
      return context.rootData[String(args[0] ?? "")];
    case "ITEM":
      requireArgCount(name, node.args, 1, 1);
      return context.itemData?.[String(args[0] ?? "")];
    case "ITEMS": {
      requireArgCount(name, node.args, 2, 2);
      const repeaterKey = String(args[0] ?? "");
      const fieldKey = String(args[1] ?? "");
      const items = context.rootData[repeaterKey];
      return Array.isArray(items)
        ? items.map((item) => (isRecord(item) ? item[fieldKey] : null))
        : [];
    }
    case "ROW":
      requireArgCount(name, node.args, 0, 0);
      return typeof context.rowIndex === "number" ? context.rowIndex + 1 : null;
    case "DATA":
      requireArgCount(name, node.args, 1, 1);
      return context.datasets?.[String(args[0] ?? "")] ?? [];
    case "FIRST": {
      requireArgCount(name, node.args, 1, 1);
      const rows = asList(args[0]);
      return rows[0] ?? null;
    }
    case "FILTER": {
      requireArgCount(name, node.args, 3, 3);
      const rows = asRowList(args[0]);
      const field = String(args[1] ?? "");
      const expected = args[2];
      return rows.filter((row) => compareEqual(readPath(row, field), expected));
    }
    case "LOOKUP": {
      requireArgCount(name, node.args, 4, 4);
      const rows = asRowList(args[0]);
      const keyField = String(args[1] ?? "");
      const keyValue = args[2];
      const returnField = String(args[3] ?? "");
      const row = rows.find((item) => compareEqual(readPath(item, keyField), keyValue));
      return row ? readPath(row, returnField) ?? null : null;
    }
    case "PLUCK": {
      requireArgCount(name, node.args, 2, 2);
      const field = String(args[1] ?? "");
      return asRowList(args[0]).map((row) => readPath(row, field) ?? null);
    }
    case "OPTION_LABEL": {
      requireArgCount(name, node.args, 4, 4);
      const rows = asRowList(args[0]);
      const keyField = String(args[1] ?? "");
      const keyValue = args[2];
      const labelField = String(args[3] ?? "");
      const row = rows.find((item) => compareEqual(readPath(item, keyField), keyValue));
      return row ? toText(readPath(row, labelField)) : null;
    }
    case "PATH":
      requireArgCount(name, node.args, 2, 2);
      return readPath(args[0], String(args[1] ?? "")) ?? null;
    case "SORT": {
      requireArgCount(name, node.args, 2, 2);
      const field = String(args[1] ?? "");
      return [...asRowList(args[0])].sort((left, right) => compareOrder(readPath(left, field), readPath(right, field)));
    }
    case "TAKE":
      requireArgCount(name, node.args, 2, 2);
      return asList(args[0]).slice(0, Math.max(0, Math.floor(toNumber(args[1]))));
    case "SUM":
      return flatten(args).reduce<number>((sum, value) => sum + toNumber(value), 0);
    case "AVG": {
      const values = flatten(args);
      return values.length === 0 ? 0 : values.reduce<number>((sum, value) => sum + toNumber(value), 0) / values.length;
    }
    case "MIN": {
      const values = flatten(args).map(toNumber);
      return values.length === 0 ? 0 : Math.min(...values);
    }
    case "MAX": {
      const values = flatten(args).map(toNumber);
      return values.length === 0 ? 0 : Math.max(...values);
    }
    case "ROUND":
      return roundNumber(args[0], args[1]);
    case "FLOOR":
      return Math.floor(toNumber(args[0]));
    case "CEILING":
      return Math.ceil(toNumber(args[0]));
    case "ABS":
      requireArgCount(name, node.args, 1, 1);
      return Math.abs(toNumber(args[0]));
    case "NOT":
      requireArgCount(name, node.args, 1, 1);
      return !toBoolean(args[0]);
    case "COALESCE":
      return args.find((value) => !isBlank(value)) ?? null;
    case "ISBLANK":
      requireArgCount(name, node.args, 1, 1);
      return isBlank(args[0]);
    case "ISNUMBER":
      requireArgCount(name, node.args, 1, 1);
      return typeof args[0] === "number" && Number.isFinite(args[0]);
    case "ISTEXT":
      requireArgCount(name, node.args, 1, 1);
      return typeof args[0] === "string";
    case "ISDATE":
      requireArgCount(name, node.args, 1, 1);
      return parseDate(args[0]) !== null;
    case "ISBOOLEAN":
      requireArgCount(name, node.args, 1, 1);
      return typeof args[0] === "boolean";
    case "NUMBER":
      requireArgCount(name, node.args, 1, 1);
      return toNumber(args[0]);
    case "TEXT":
      requireArgCount(name, node.args, 1, 1);
      return toText(args[0]);
    case "BOOLEAN":
      requireArgCount(name, node.args, 1, 1);
      return toBoolean(args[0]);
    case "CONCAT":
      return args.map(toText).join("");
    case "TRIM":
      requireArgCount(name, node.args, 1, 1);
      return toText(args[0]).trim();
    case "UPPER":
      requireArgCount(name, node.args, 1, 1);
      return toText(args[0]).toUpperCase();
    case "LOWER":
      requireArgCount(name, node.args, 1, 1);
      return toText(args[0]).toLowerCase();
    case "LEN":
      requireArgCount(name, node.args, 1, 1);
      return toText(args[0]).length;
    case "LEFT":
      requireArgCount(name, node.args, 2, 2);
      return toText(args[0]).slice(0, Math.max(0, toNumber(args[1])));
    case "RIGHT": {
      requireArgCount(name, node.args, 2, 2);
      const text = toText(args[0]);
      return text.slice(Math.max(0, text.length - toNumber(args[1])));
    }
    case "CONTAINS":
      requireArgCount(name, node.args, 2, 2);
      return toText(args[0]).includes(toText(args[1]));
    case "TODAY":
      requireArgCount(name, node.args, 0, 0);
      return formatDate(context.today ?? new Date());
    case "DATE":
      requireArgCount(name, node.args, 3, 3);
      return makeDate(toNumber(args[0]), toNumber(args[1]), toNumber(args[2]));
    case "DATEADD":
      requireArgCount(name, node.args, 3, 3);
      return dateAdd(args[0], toNumber(args[1]), toText(args[2]));
    case "DATEDIFF":
      requireArgCount(name, node.args, 3, 3);
      return dateDiff(args[0], args[1], toText(args[2]));
    case "YEAR":
      requireArgCount(name, node.args, 1, 1);
      return getDatePart(args[0], "year");
    case "MONTH":
      requireArgCount(name, node.args, 1, 1);
      return getDatePart(args[0], "month");
    case "DAY":
      requireArgCount(name, node.args, 1, 1);
      return getDatePart(args[0], "day");
    case "IN":
      requireArgCount(name, node.args, 2);
      return flatten(args.slice(1)).some((value) => compareEqual(args[0], value));
    case "COUNT":
      return flatten(args).filter((value) => !isBlank(value)).length;
    case "HAS":
      requireArgCount(name, node.args, 2, 2);
      return flatten([args[0]]).some((value) => compareEqual(value, args[1]));
    case "HASANY":
      requireArgCount(name, node.args, 2);
      return flatten(args.slice(1)).some((needle) => flatten([args[0]]).some((value) => compareEqual(value, needle)));
    case "HASALL":
      requireArgCount(name, node.args, 2);
      return flatten(args.slice(1)).every((needle) => flatten([args[0]]).some((value) => compareEqual(value, needle)));
    case "LIST":
      return args;
    case "OPTION":
      requireArgCount(name, node.args, 2, 3);
      return { label: toText(args[0]), value: toText(args[1]), ...(args[2] === undefined ? {} : { disabled: toBoolean(args[2]) }) };
    case "OPTIONS":
      if (Array.isArray(args[0]) && typeof args[1] === "string" && typeof args[2] === "string") {
        return buildOptionsFromRows(args[0], args[1], args[2], typeof args[3] === "string" ? args[3] : undefined);
      }
      return buildOptions(args);
    default:
      throw new ExpressionEvaluationError(`Unsupported function "${name}".`);
  }
}

function resolveIdentifier(name: string, context: ExpressionContext): unknown {
  if (context.itemData && Object.prototype.hasOwnProperty.call(context.itemData, name)) {
    return context.itemData[name];
  }
  if (Object.prototype.hasOwnProperty.call(context.rootData, name)) return context.rootData[name];
  return null;
}

function collectExpressionProps(value: unknown, path: string): Array<{ path: string; expression: string }> {
  if (isExpressionString(value)) return [{ path, expression: value }];
  if (isEscapedExpressionString(value)) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectExpressionProps(item, `${path}.${index}`));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) => collectExpressionProps(child, `${path}.${key}`));
  }
  return [];
}

function collectDependencies(ast: AstNode): Dependency[] {
  const dependencies: Dependency[] = [];

  function walk(node: AstNode) {
    if (node.kind === "identifier") {
      dependencies.push({ key: node.name, kind: "field" });
      return;
    }
    if (node.kind === "unary") {
      walk(node.expr);
      return;
    }
    if (node.kind === "binary") {
      walk(node.left);
      walk(node.right);
      return;
    }
    if (node.kind === "call") {
      const first = literalString(node.args[0]);
      const second = literalString(node.args[1]);
      if (node.name === "FIELD" && first) dependencies.push({ key: first, kind: "field" });
      else if (node.name === "ROOT" && first) dependencies.push({ key: first, kind: "root" });
      else if (node.name === "ITEM" && first) dependencies.push({ key: first, kind: "item" });
      else if (node.name === "ITEMS" && first && second) {
        dependencies.push({ key: first, kind: "repeater" });
        dependencies.push({ key: second, kind: "repeaterField", repeaterKey: first });
      } else if (node.name === "DATA" && first) {
        dependencies.push({ key: first, kind: "dataset" });
      } else {
        node.args.forEach(walk);
      }
    }
  }

  walk(ast);
  return dependencies;
}

function literalString(node: AstNode | undefined): string | undefined {
  return node?.kind === "literal" && typeof node.value === "string" ? node.value : undefined;
}

function buildRegistry(root: LayoutNode, dataSourceKeys = new Set<string>()) {
  const controlKeys = new Set<string>();
  const repeaterKeys = new Set<string>();
  const repeaterFields = new Map<string, Set<string>>();

  function walk(node: Node, currentRepeaterKey?: string) {
    if (node.type === "control") {
      controlKeys.add(node.key);
      if (currentRepeaterKey) {
        const fields = repeaterFields.get(currentRepeaterKey) ?? new Set<string>();
        fields.add(node.key);
        repeaterFields.set(currentRepeaterKey, fields);
      }
      return;
    }
    const repeaterKey = node.layoutType === "repeater" ? node.key ?? node.id : currentRepeaterKey;
    if (node.layoutType === "repeater") repeaterKeys.add(node.key ?? node.id);
    node.children.forEach((child) => walk(child, repeaterKey));
  }

  walk(root);
  return { controlKeys, repeaterKeys, repeaterFields, dataSourceKeys };
}

function dependencyExists(
  dependency: Dependency,
  registry: ReturnType<typeof buildRegistry>,
): boolean {
  if (dependency.kind === "dataset") return registry.dataSourceKeys.has(dependency.key);
  if (dependency.kind === "repeater") return registry.repeaterKeys.has(dependency.key);
  if (dependency.kind === "repeaterField") {
    return registry.repeaterFields.get(dependency.repeaterKey)?.has(dependency.key) ?? registry.controlKeys.has(dependency.key);
  }
  return registry.controlKeys.has(dependency.key);
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(node: string, stack: string[]) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    for (const dep of graph.get(node) ?? []) {
      if (graph.has(dep)) visit(dep, [...stack, dep]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) visit(node, [node]);
  return cycles;
}

function walkNodes(node: Node, fn: (node: Node, path: string) => void, path = "root") {
  fn(node, path);
  if (node.type === "layout") {
    node.children.forEach((child, index) => walkNodes(child, fn, `${path}.children.${index}`));
  }
}

function countControls(node: Node): number {
  if (node.type === "control") return 1;
  return node.children.reduce((sum, child) => sum + countControls(child), 0);
}

function readBooleanProp(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readVisibility(props: Record<string, unknown>): boolean {
  if (typeof props.visible === "boolean") return props.visible;
  if (typeof props.visibleWhen === "boolean") return props.visibleWhen;
  return true;
}

function toNumber(value: unknown): number {
  if (isBlank(value)) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new ExpressionEvaluationError(`Expected a numeric value, received ${describeValue(value)}.`);
}

function toBoolean(value: unknown): boolean {
  if (isBlank(value)) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0", ""].includes(normalized)) return false;
  }
  throw new ExpressionEvaluationError(`Expected a boolean value, received ${describeValue(value)}.`);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toText).join(", ");
  return JSON.stringify(value);
}

function compareEqual(left: unknown, right: unknown): boolean {
  if (isBlank(left) && isBlank(right)) return true;
  if (typeof left === "number" || typeof right === "number") {
    return toNumber(left) === toNumber(right);
  }
  return toText(left) === toText(right);
}

function compareOrder(left: unknown, right: unknown): number {
  const leftDate = parseDate(left);
  const rightDate = parseDate(right);
  if (leftDate && rightDate) return leftDate.getTime() - rightDate.getTime();
  if (typeof left === "number" || typeof right === "number") return toNumber(left) - toNumber(right);
  return toText(left).localeCompare(toText(right));
}

function flatten(values: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const value of values) {
    if (Array.isArray(value)) out.push(...flatten(value));
    else out.push(value);
  }
  return out;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRowList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, value);
}

function requireArgCount(name: string, args: AstNode[], min: number, max?: number) {
  if (args.length < min || (max !== undefined && args.length > max)) {
    const expected = max === undefined || max !== min ? `${min}${max === undefined ? "+" : `-${max}`}` : `${min}`;
    throw new ExpressionEvaluationError(`${name} expects ${expected} argument${expected === "1" ? "" : "s"}.`);
  }
}

function roundNumber(value: unknown, digitsValue: unknown): number {
  const digits = digitsValue === undefined || isBlank(digitsValue) ? 0 : toNumber(digitsValue);
  const factor = Math.pow(10, digits);
  return Math.round(toNumber(value) * factor) / factor;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function makeDate(year: number, month: number, day: number): string {
  return formatDate(new Date(Date.UTC(year, month - 1, day)));
}

function dateAdd(value: unknown, amount: number, unit: string): string {
  const date = parseDate(value);
  if (!date) throw new ExpressionEvaluationError("DATEADD expects a valid date.");
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("day")) next.setUTCDate(next.getUTCDate() + amount);
  else if (normalized.startsWith("month")) next.setUTCMonth(next.getUTCMonth() + amount);
  else if (normalized.startsWith("year")) next.setUTCFullYear(next.getUTCFullYear() + amount);
  else throw new ExpressionEvaluationError(`Unsupported date unit "${unit}".`);
  return formatDate(next);
}

function dateDiff(startValue: unknown, endValue: unknown, unit: string): number {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end) throw new ExpressionEvaluationError("DATEDIFF expects valid dates.");
  const days = Math.floor((dateOnly(end).getTime() - dateOnly(start).getTime()) / 86400000);
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("day")) return days;
  if (normalized.startsWith("month")) return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (normalized.startsWith("year")) return end.getUTCFullYear() - start.getUTCFullYear();
  throw new ExpressionEvaluationError(`Unsupported date unit "${unit}".`);
}

function getDatePart(value: unknown, part: "year" | "month" | "day"): number {
  const date = parseDate(value);
  if (!date) throw new ExpressionEvaluationError(`Expected a valid date.`);
  if (part === "year") return date.getUTCFullYear();
  if (part === "month") return date.getUTCMonth() + 1;
  return date.getUTCDate();
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildOptions(args: unknown[]): Array<{ label: string; value: string; disabled?: boolean }> {
  if (args.every(isOptionLike)) {
    return args.map((arg) => ({
      label: toText((arg as Record<string, unknown>).label),
      value: toText((arg as Record<string, unknown>).value),
      ...((arg as Record<string, unknown>).disabled === undefined ? {} : { disabled: toBoolean((arg as Record<string, unknown>).disabled) }),
    }));
  }

  const options: Array<{ label: string; value: string; disabled?: boolean }> = [];
  for (let i = 0; i < args.length; i += 2) {
    options.push({ label: toText(args[i]), value: toText(args[i + 1] ?? args[i]) });
  }
  return options;
}

function buildOptionsFromRows(
  value: unknown[],
  labelField: string,
  valueField: string,
  disabledField?: string,
): Array<{ label: string; value: string; disabled?: boolean }> {
  return value.filter(isRecord).map((row) => ({
    label: toText(readPath(row, labelField)),
    value: toText(readPath(row, valueField)),
    ...(disabledField ? { disabled: toBoolean(readPath(row, disabledField)) } : {}),
  }));
}

function isOptionLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && "label" in value && "value" in value;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isEmptyValue(value: unknown): boolean {
  return isBlank(value);
}

function isDigit(value: string): boolean {
  return /^[0-9]$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFileRefLike(value: unknown): boolean {
  return isRecord(value) && typeof value.fileId === "string";
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "blank";
  if (Array.isArray(value)) return "list";
  return typeof value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

function dedupeIssues(issues: ExpressionIssue[]): ExpressionIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.path}:${issue.message}:${issue.expression ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRuntimeErrors(errors: ExpressionRuntimeError[]): ExpressionRuntimeError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.key ?? ""}:${error.path}:${error.message}:${error.expression ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
