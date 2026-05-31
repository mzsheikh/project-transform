"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, KeyboardEvent, SyntheticEvent } from "react";

export type ExpressionFieldInfo = {
  key: string;
  label?: string;
  controlType?: string;
  source?: "field" | "dataset";
};

type SuggestionKind = "field" | "dataset" | "function" | "keyword" | "operator";

type ExpressionSuggestion = {
  kind: SuggestionKind;
  label: string;
  insert: string;
  detail: string;
  description: string;
  caretOffset?: number;
};

type ExpressionInputProps = {
  value: string | number | undefined;
  onChange: (value: string) => void;
  expressionFields?: ExpressionFieldInfo[];
  placeholder?: string;
  inputType?: "text" | "number";
  multiline?: boolean;
  rows?: number;
  style?: CSSProperties;
};

const FUNCTION_SUGGESTIONS: ExpressionSuggestion[] = [
  fn("FIELD", "FIELD(\"\")", "FIELD(key)", "Read a field by key string.", -2),
  fn("ROOT", "ROOT(\"\")", "ROOT(key)", "Read a root-level form value.", -2),
  fn("ITEM", "ITEM(\"\")", "ITEM(key)", "Read a value from the current repeater row.", -2),
  fn("ITEMS", "ITEMS(\"\", \"\")", "ITEMS(repeaterKey, fieldKey)", "Read a list of values from repeater rows.", -6),
  fn("ROW", "ROW()", "ROW()", "Current repeater row number."),
  fn("VAR", "VAR(\"\")", "VAR(name)", "Read row, form, then global variable by name.", -2),
  fn("ROWVAR", "ROWVAR(\"\")", "ROWVAR(name)", "Read a current-row variable.", -2),
  fn("FORMVAR", "FORMVAR(\"\")", "FORMVAR(name)", "Read a variable saved for this form session.", -2),
  fn("GLOBALVAR", "GLOBALVAR(\"\")", "GLOBALVAR(name)", "Read a variable shared across app forms.", -2),
  fn("DATA", "DATA(\"\")", "DATA(dataSourceKey)", "Read cached rows from a form data source.", -2),
  fn("FIRST", "FIRST()", "FIRST(list)", "Return the first row or blank.", -1),
  fn("FILTER", "FILTER()", "FILTER(rows, field, value)", "Filter rows where a field equals a value.", -1),
  fn("LOOKUP", "LOOKUP()", "LOOKUP(rows, keyField, keyValue, returnField)", "Find one row and return one field.", -1),
  fn("PLUCK", "PLUCK()", "PLUCK(rows, field)", "Read one field from every row.", -1),
  fn("OPTION_LABEL", "OPTION_LABEL()", "OPTION_LABEL(rows, keyField, keyValue, labelField)", "Resolve a selected value to display text.", -1),
  fn("PATH", "PATH()", "PATH(object, path)", "Read a nested object path safely.", -1),
  fn("SORT", "SORT()", "SORT(rows, field)", "Sort rows by a field.", -1),
  fn("TAKE", "TAKE()", "TAKE(rows, count)", "Return the first N rows.", -1),
  fn("SUM", "SUM()", "SUM(value, ...)", "Add numeric values.", -1),
  fn("AVG", "AVG()", "AVG(value, ...)", "Average numeric values.", -1),
  fn("MIN", "MIN()", "MIN(value, ...)", "Smallest numeric value.", -1),
  fn("MAX", "MAX()", "MAX(value, ...)", "Largest numeric value.", -1),
  fn("ROUND", "ROUND()", "ROUND(value, digits)", "Round a number.", -1),
  fn("FLOOR", "FLOOR()", "FLOOR(value)", "Round down.", -1),
  fn("CEILING", "CEILING()", "CEILING(value)", "Round up.", -1),
  fn("ABS", "ABS()", "ABS(value)", "Absolute value.", -1),
  fn("IF", "IF()", "IF(condition, trueValue, falseValue)", "Choose between two values.", -1),
  fn("IFS", "IFS()", "IFS(condition, value, ...)", "Return the first matching result.", -1),
  fn("IFERROR", "IFERROR()", "IFERROR(value, fallback)", "Fallback when an expression errors.", -1),
  fn("AND", "AND()", "AND(value, ...)", "True when all values are true.", -1),
  fn("OR", "OR()", "OR(value, ...)", "True when any value is true.", -1),
  fn("NOT", "NOT()", "NOT(value)", "Boolean negation.", -1),
  fn("COALESCE", "COALESCE()", "COALESCE(value, ...)", "First non-blank value.", -1),
  fn("ISBLANK", "ISBLANK()", "ISBLANK(value)", "Check for blank values.", -1),
  fn("ISNUMBER", "ISNUMBER()", "ISNUMBER(value)", "Check for numeric values.", -1),
  fn("ISTEXT", "ISTEXT()", "ISTEXT(value)", "Check for text values.", -1),
  fn("ISDATE", "ISDATE()", "ISDATE(value)", "Check for date values.", -1),
  fn("ISBOOLEAN", "ISBOOLEAN()", "ISBOOLEAN(value)", "Check for boolean values.", -1),
  fn("NUMBER", "NUMBER()", "NUMBER(value)", "Convert to number.", -1),
  fn("TEXT", "TEXT()", "TEXT(value)", "Convert to text.", -1),
  fn("BOOLEAN", "BOOLEAN()", "BOOLEAN(value)", "Convert to boolean.", -1),
  fn("CONCAT", "CONCAT()", "CONCAT(value, ...)", "Join values as text.", -1),
  fn("TRIM", "TRIM()", "TRIM(text)", "Trim spaces.", -1),
  fn("UPPER", "UPPER()", "UPPER(text)", "Uppercase text.", -1),
  fn("LOWER", "LOWER()", "LOWER(text)", "Lowercase text.", -1),
  fn("LEN", "LEN()", "LEN(text)", "Text length.", -1),
  fn("LEFT", "LEFT()", "LEFT(text, count)", "First characters.", -1),
  fn("RIGHT", "RIGHT()", "RIGHT(text, count)", "Last characters.", -1),
  fn("CONTAINS", "CONTAINS()", "CONTAINS(text, search)", "Check whether text contains another value.", -1),
  fn("TODAY", "TODAY()", "TODAY()", "Current date as YYYY-MM-DD."),
  fn("DATE", "DATE()", "DATE(year, month, day)", "Build a date.", -1),
  fn("DATEADD", "DATEADD()", "DATEADD(date, amount, unit)", "Add days, months, or years.", -1),
  fn("DATEDIFF", "DATEDIFF()", "DATEDIFF(start, end, unit)", "Difference between dates.", -1),
  fn("YEAR", "YEAR()", "YEAR(date)", "Year number.", -1),
  fn("MONTH", "MONTH()", "MONTH(date)", "Month number.", -1),
  fn("DAY", "DAY()", "DAY(date)", "Day of month.", -1),
  fn("IN", "IN()", "IN(value, option, ...)", "Check value against options.", -1),
  fn("COUNT", "COUNT()", "COUNT(value, ...)", "Count non-blank values.", -1),
  fn("HAS", "HAS()", "HAS(list, value)", "Check whether a list contains a value.", -1),
  fn("HASANY", "HASANY()", "HASANY(list, value, ...)", "Check whether a list contains any value.", -1),
  fn("HASALL", "HASALL()", "HASALL(list, value, ...)", "Check whether a list contains all values.", -1),
  fn("LIST", "LIST()", "LIST(value, ...)", "Build a list.", -1),
  fn("OPTION", "OPTION()", "OPTION(label, value, disabled)", "Build one dropdown option.", -1),
  fn("OPTIONS", "OPTIONS()", "OPTIONS(value, ...)", "Build dropdown or multiselect options.", -1),
];

const KEYWORD_SUGGESTIONS: ExpressionSuggestion[] = [
  keyword("TRUE", "Boolean true."),
  keyword("FALSE", "Boolean false."),
  keyword("NULL", "Blank value."),
  keyword("BLANK", "Blank value."),
];

const OPERATOR_SUGGESTIONS: ExpressionSuggestion[] = [
  operator("AND", "AND ", "Boolean and."),
  operator("OR", "OR ", "Boolean or."),
  operator("NOT", "NOT ", "Boolean not."),
];

export function ExpressionInput({
  value,
  onChange,
  expressionFields = [],
  placeholder,
  inputType = "text",
  multiline = false,
  rows = 4,
  style,
}: ExpressionInputProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const textValue = value === undefined || value === null ? "" : String(value);

  const suggestions = useMemo(
    () => expressionSuggestions(textValue, caret, expressionFields),
    [caret, expressionFields, textValue],
  );
  const showSuggestions = focused && open && textValue.startsWith("=") && suggestions.length > 0;

  function syncCaret(target: HTMLInputElement | HTMLTextAreaElement) {
    setCaret(target.selectionStart ?? target.value.length);
  }

  function updateValue(next: string, target?: HTMLInputElement | HTMLTextAreaElement) {
    onChange(next);
    setOpen(next.startsWith("="));
    setActiveIndex(0);
    if (target) syncCaret(target);
  }

  function applySuggestion(suggestion: ExpressionSuggestion) {
    const range = expressionTokenRange(textValue, caret);
    const next = `${textValue.slice(0, range.start)}${suggestion.insert}${textValue.slice(range.end)}`;
    const nextCaret = range.start + suggestion.insert.length + (suggestion.caretOffset ?? 0);

    onChange(next);
    setOpen(false);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!showSuggestions) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applySuggestion(suggestions[activeIndex] ?? suggestions[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const commonProps = {
    style: { ...inputStyle, ...style },
    value: textValue,
    placeholder,
    onFocus: () => {
      setFocused(true);
      setOpen(textValue.startsWith("="));
    },
    onBlur: () => {
      window.setTimeout(() => setFocused(false), 120);
    },
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateValue(event.target.value, event.target),
    onSelect: (event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => syncCaret(event.currentTarget),
    onKeyDown: handleKeyDown,
  };

  return (
    <div style={inputWrap}>
      {multiline ? (
        <textarea
          {...commonProps}
          ref={(node) => {
            ref.current = node;
          }}
          rows={rows}
        />
      ) : (
        <input
          {...commonProps}
          ref={(node) => {
            ref.current = node;
          }}
          type={inputType}
        />
      )}
      {showSuggestions ? (
        <div style={suggestionPanel}>
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.kind}-${suggestion.insert}-${suggestion.label}`}
              type="button"
              style={{
                ...suggestionItem,
                ...(index === activeIndex ? suggestionItemActive : null),
              }}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
            >
              <span style={suggestionTopLine}>
                <span style={{ ...suggestionKind, ...kindStyle(suggestion.kind) }}>{suggestion.kind}</span>
                <span style={suggestionLabel}>{suggestion.label}</span>
                <span style={suggestionDetail}>{suggestion.detail}</span>
              </span>
              <span style={suggestionDescription}>{suggestion.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function fn(label: string, insert: string, detail: string, description: string, caretOffset = 0): ExpressionSuggestion {
  return { kind: "function", label, insert, detail, description, caretOffset };
}

function keyword(label: string, description: string): ExpressionSuggestion {
  return { kind: "keyword", label, insert: label, detail: label, description };
}

function operator(label: string, insert: string, description: string): ExpressionSuggestion {
  return { kind: "operator", label, insert, detail: label, description };
}

function expressionSuggestions(value: string, caret: number, fields: ExpressionFieldInfo[]): ExpressionSuggestion[] {
  if (!value.startsWith("=")) return [];
  const range = expressionTokenRange(value, caret);
  const query = range.query.toLowerCase();
  const suggestions = [
    ...fieldSuggestions(fields),
    ...FUNCTION_SUGGESTIONS,
    ...KEYWORD_SUGGESTIONS,
    ...OPERATOR_SUGGESTIONS,
  ];

  const filtered = query
    ? suggestions.filter((suggestion) => {
      const haystack = `${suggestion.label} ${suggestion.insert} ${suggestion.detail} ${suggestion.description}`.toLowerCase();
      return haystack.includes(query);
    })
    : suggestions;

  return filtered.slice(0, 12);
}

function expressionTokenRange(value: string, caret: number) {
  let start = Math.max(1, Math.min(caret, value.length));
  while (start > 1 && /[A-Za-z0-9_]/.test(value[start - 1] ?? "")) start -= 1;
  return { start, end: Math.max(1, caret), query: value.slice(start, caret) };
}

function fieldSuggestions(fields: ExpressionFieldInfo[]): ExpressionSuggestion[] {
  const seen = new Set<string>();
  return fields
    .filter((field) => {
      const seenKey = `${field.source ?? "field"}:${field.key}`;
      if (!field.key || seen.has(seenKey)) return false;
      seen.add(seenKey);
      return true;
    })
    .map((field) => {
      if (field.source === "dataset") {
        return {
          kind: "dataset" as const,
          label: field.label ? `${field.key} - ${field.label}` : field.key,
          insert: `DATA("${escapeFormulaText(field.key)}")`,
          detail: "dataset",
          description: "Insert DATA() reference for this form data source.",
        };
      }
      const bareIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/.test(field.key);
      const insert = bareIdentifier ? field.key : `FIELD("${escapeFormulaText(field.key)}")`;
      const label = field.label ? `${field.key} - ${field.label}` : field.key;
      return {
        kind: "field" as const,
        label,
        insert,
        detail: field.controlType ? `${field.controlType} field` : "field",
        description: bareIdentifier ? "Insert field reference." : "Insert FIELD() reference for this key.",
      };
    });
}

function escapeFormulaText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function kindStyle(kind: SuggestionKind): CSSProperties {
  if (kind === "field") return { background: "#eef4ff", color: "#175cd3" };
  if (kind === "dataset") return { background: "#f0f9ff", color: "#026aa2" };
  if (kind === "function") return { background: "#ecfdf3", color: "#067647" };
  if (kind === "keyword") return { background: "#fff6ed", color: "#c4320a" };
  return { background: "#f2f4f7", color: "#475467" };
}

const inputWrap: CSSProperties = {
  position: "relative",
  minWidth: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #dfe6f0",
  fontFamily: "system-ui",
  fontSize: 14,
  color: "#344054",
  background: "#fff",
};

const suggestionPanel: CSSProperties = {
  position: "absolute",
  zIndex: 30,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  maxHeight: 280,
  overflowY: "auto",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  background: "#fff",
  boxShadow: "0 16px 38px rgba(16, 24, 40, 0.16)",
  padding: 6,
};

const suggestionItem: CSSProperties = {
  width: "100%",
  border: 0,
  background: "transparent",
  borderRadius: 6,
  padding: "9px 10px",
  display: "grid",
  gap: 4,
  textAlign: "left",
  cursor: "pointer",
};

const suggestionItemActive: CSSProperties = {
  background: "#f5f8ff",
};

const suggestionTopLine: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const suggestionKind: CSSProperties = {
  borderRadius: 999,
  padding: "2px 7px",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  flex: "0 0 auto",
};

const suggestionLabel: CSSProperties = {
  color: "#344054",
  fontSize: 13,
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const suggestionDetail: CSSProperties = {
  color: "#667085",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const suggestionDescription: CSSProperties = {
  color: "#667085",
  fontSize: 12,
  lineHeight: 1.35,
};
