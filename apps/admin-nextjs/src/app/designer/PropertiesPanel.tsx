/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import type { Node } from "@transform/contracts/form-types";
import { isControl, isLayout } from "./types";

function mergeProps(onChange: (patch: any) => void, node: any, next: Record<string, any>) {
  onChange({ props: { ...(node.props ?? {}), ...next } });
}

function setProps(onChange: (patch: any) => void, node: any, path: string, value: unknown) {
  const props = { ...(node.props ?? {}) } as Record<string, any>;

  if (path === "trackColor.true") {
    props.trackColor = { ...(props.trackColor ?? {}), true: value };
  } else if (path === "trackColor.false") {
    props.trackColor = { ...(props.trackColor ?? {}), false: value };
  } else if (path === "style.width" || path === "style.padding" || path === "style.margin" || path === "style.borderRadius" || path === "style.fontSize") {
    const [root, leaf] = path.split(".");
    const nextStyle = { ...(props.style ?? {}), [leaf]: value };
    (props as any)[root] = nextStyle;
  } else {
    (props as any)[path] = value;
  }

  onChange({ props });
}

function setBool(onChange: (patch: any) => void, node: any, path: string, value: string) {
  setProps(onChange, node, path, value === "true");
}

function numberOrUndefined(value: string): number | undefined {
  if (value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function optionsTextToValue(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, value] = line.split("=");
      return { label: (label ?? "").trim(), value: (value ?? "").trim() };
    })
    .filter((o) => o.label && o.value);
}

function valueToOptionsText(options: Array<{ label: string; value: string }>) {
  return options.map((o) => `${o.label}=${o.value}`).join("\n");
}

function sectionTitle(title: string, subtitle?: string) {
  return (
    <div style={{ marginTop: 6, marginBottom: 2, fontSize: 11, opacity: 0.7, fontWeight: 800 }}>
      {title}
      {subtitle ? <span style={{ opacity: 0.75, fontWeight: 600 }}> — {subtitle}</span> : null}
    </div>
  );
}

function boolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={inline}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function textField({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number";
  multiline?: boolean;
}) {
  const props = multiline ? { ...input, height: 92 } : input;
  const element = multiline ? (
    <textarea style={props} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input style={input} type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  );
  return (
    <label style={labelStyle}>
      {label}
      {element}
    </label>
  );
}

function selectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label style={labelStyle}>
      {label}
      <select style={input} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

function numberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        style={input}
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(numberOrUndefined(e.target.value))}
      />
    </label>
  );
}

export function PropertiesPanel({
  node,
  onChange,
}: {
  node: Node | null;
  onChange: (patch: Partial<any>) => void;
}) {
  if (!node) {
    return (
      <div style={panel}>
        <div style={panelHeader}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Properties</h3>
          <div style={panelHint}>Select a layout or field to edit its configuration.</div>
        </div>
        <div style={{ color: "#667085" }}>Select a node…</div>
      </div>
    );
  }

  if (isLayout(node)) {
    return (
      <div style={panel}>
        <div style={panelHeader}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Properties</h3>
          <div style={panelHint}>Layout: {node.layoutType}</div>
        </div>
        {node.layoutType === "section" ? (
          <label style={labelStyle}>
            Section Label
            <input style={input} value={(node as any).label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
          </label>
        ) : null}
      </div>
    );
  }

  if (!isControl(node)) {
    return null;
  }

  const props = (node.props ?? {}) as Record<string, any>;

  return (
    <div style={panel}>
      <div style={panelHeader}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Properties</h3>
        <div style={panelHint}>Control: {node.controlType}</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={labelStyle}>
          Label
          <input style={input} value={node.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
        </label>

        <label style={labelStyle}>
          Key
          <input style={input} value={node.key} onChange={(e) => onChange({ key: e.target.value })} />
        </label>

        {boolField({
          label: "Required",
          value: !!node.validation?.required,
          onChange: (required) => onChange({ validation: { ...(node.validation ?? {}), required } }),
        })}

        {sectionTitle("Base Control Props")}

        {textField({
          label: "Placeholder",
          value: props?.placeholder ?? "",
          onChange: (placeholder) => mergeProps(onChange, node, { placeholder }),
        })}

        {textField({
          label: "Help Text",
          value: props?.helpText ?? "",
          onChange: (helpText) => mergeProps(onChange, node, { helpText }),
        })}

        {textField({
          label: "Error Message",
          value: props?.errorMessage ?? "",
          onChange: (errorMessage) => mergeProps(onChange, node, { errorMessage }),
          multiline: true,
        })}

        <label style={labelStyle}>
          Accessibility Label
          <input
            style={input}
            value={props?.accessibilityLabel ?? ""}
            onChange={(e) => onChange({ props: { ...(node.props ?? {}), accessibilityLabel: e.target.value } })}
          />
        </label>

        {boolField({
          label: "Disabled",
          value: !!props?.disabled,
          onChange: (disabled) => setBool(onChange, node, "disabled", String(disabled)),
        })}

        {boolField({
          label: "Read Only",
          value: !!props?.readOnly,
          onChange: (readOnly) => setBool(onChange, node, "readOnly", String(readOnly)),
        })}

        {boolField({
          label: "Accessible",
          value: props?.accessible ?? true,
          onChange: (accessible) => setBool(onChange, node, "accessible", String(accessible)),
        })}

        {boolField({
          label: "Auto Focus",
          value: !!props?.autoFocus,
          onChange: (autoFocus) => setBool(onChange, node, "autoFocus", String(autoFocus)),
        })}

        {textField({
          label: "Test ID",
          value: props?.testID ?? "",
          onChange: (testID) => mergeProps(onChange, node, { testID }),
        })}

        {textField({
          label: "Default Value (string)",
          value: props?.defaultValue ?? "",
          onChange: (defaultValue) => mergeProps(onChange, node, { defaultValue }),
          multiline: true,
        })}

        {sectionTitle("Style")}

        {textField({
          label: "Width",
          value: props?.style?.width ?? "",
          onChange: (width) => setProps(onChange, node, "style.width", width),
        })}

        {numberField({
          label: "Padding",
          value: props?.style?.padding,
          onChange: (padding) => setProps(onChange, node, "style.padding", padding),
        })}

        {numberField({
          label: "Margin",
          value: props?.style?.margin,
          onChange: (margin) => setProps(onChange, node, "style.margin", margin),
        })}

        {numberField({
          label: "Border Radius",
          value: props?.style?.borderRadius,
          onChange: (borderRadius) => setProps(onChange, node, "style.borderRadius", borderRadius),
        })}

        {numberField({
          label: "Font Size",
          value: props?.style?.fontSize,
          onChange: (fontSize) => setProps(onChange, node, "style.fontSize", fontSize),
        })}

        {textField({
          label: "Text Color",
          value: props?.style?.color ?? "",
          onChange: (color) => setProps(onChange, node, "style.color", color),
        })}

        {textField({
          label: "Background Color",
          value: props?.style?.backgroundColor ?? "",
          onChange: (backgroundColor) => setProps(onChange, node, "style.backgroundColor", backgroundColor),
        })}

        {node.controlType === "text" ? (
          <>
            {sectionTitle("Text Control")}
            {selectField({
              label: "Keyboard Type",
              value: props?.keyboardType ?? "default",
              onChange: (v) => setProps(onChange, node, "keyboardType", v),
              options: ["default", "email-address", "numeric", "phone-pad", "url", "decimal", "number-pad", "ascii-capable", "visible-password", "web-search"],
            })}

            {selectField({
              label: "Auto Cap",
              value: props?.autoCapitalize ?? "none",
              onChange: (v) => setProps(onChange, node, "autoCapitalize", v),
              options: ["none", "sentences", "words", "characters"],
            })}

            {boolField({
              label: "Auto Correct",
              value: !!props?.autoCorrect,
              onChange: (autoCorrect) => setBool(onChange, node, "autoCorrect", String(autoCorrect)),
            })}

            {boolField({
              label: "Secure Text Entry",
              value: !!props?.secureTextEntry,
              onChange: (secureTextEntry) => setBool(onChange, node, "secureTextEntry", String(secureTextEntry)),
            })}

            {boolField({
              label: "Multiline",
              value: !!props?.multiline,
              onChange: (multiline) => setBool(onChange, node, "multiline", String(multiline)),
            })}

            {selectField({
              label: "Text Align",
              value: props?.textAlign ?? "left",
              onChange: (v) => setProps(onChange, node, "textAlign", v),
              options: ["left", "center", "right", "auto"],
            })}

            {selectField({
              label: "Return Key",
              value: props?.returnKeyType ?? "done",
              onChange: (v) => setProps(onChange, node, "returnKeyType", v),
              options: ["done", "next", "search", "go", "send"],
            })}

            {numberField({
              label: "Text Min Length",
              value: props?.minLength,
              onChange: (minLength) => setProps(onChange, node, "minLength", minLength),
            })}

            {numberField({
              label: "Text Max Length",
              value: props?.maxLength,
              onChange: (maxLength) => setProps(onChange, node, "maxLength", maxLength),
            })}
          </>
        ) : null}

        {node.controlType === "number" ? (
          <>
            {sectionTitle("Number Control")}
            {selectField({
              label: "Keyboard Type",
              value: props?.keyboardType ?? "decimal-pad",
              onChange: (v) => setProps(onChange, node, "keyboardType", v),
              options: ["number-pad", "decimal-pad", "numeric"],
            })}

            {numberField({
              label: "Min",
              value: props?.min,
              onChange: (min) => setProps(onChange, node, "min", min),
            })}

            {numberField({
              label: "Max",
              value: props?.max,
              onChange: (max) => setProps(onChange, node, "max", max),
            })}

            {numberField({
              label: "Step",
              value: props?.step,
              onChange: (step) => setProps(onChange, node, "step", step),
            })}

            {numberField({
              label: "Precision",
              value: props?.precision,
              onChange: (precision) => setProps(onChange, node, "precision", precision),
            })}

            {boolField({
              label: "Integer Only",
              value: !!props?.integerOnly,
              onChange: (integerOnly) => setProps(onChange, node, "integerOnly", integerOnly),
            })}

            {boolField({
              label: "Allow Negative",
              value: !!props?.allowNegative,
              onChange: (allowNegative) => setProps(onChange, node, "allowNegative", allowNegative),
            })}

            {selectField({
              label: "Number Format",
              value: props?.format ?? "decimal",
              onChange: (format) => setProps(onChange, node, "format", format),
              options: ["decimal", "currency"],
            })}
          </>
        ) : null}

        {node.controlType === "switch" ? (
          <>
            {sectionTitle("Switch Control")}
            {textField({
              label: "Track Color (false)",
              value: props?.trackColor?.false ?? "",
              onChange: (v) => setProps(onChange, node, "trackColor.false", v),
            })}
            {textField({
              label: "Track Color (true)",
              value: props?.trackColor?.true ?? "",
              onChange: (v) => setProps(onChange, node, "trackColor.true", v),
            })}
            {textField({
              label: "Thumb Color",
              value: props?.thumbColor ?? "",
              onChange: (v) => setProps(onChange, node, "thumbColor", v),
            })}
            {textField({
              label: "iOS Background Color",
              value: props?.ios_backgroundColor ?? "",
              onChange: (v) => setProps(onChange, node, "ios_backgroundColor", v),
            })}
            {textField({
              label: "On Tint Color",
              value: props?.onTintColor ?? "",
              onChange: (v) => setProps(onChange, node, "onTintColor", v),
            })}
          </>
        ) : null}

        {(node.controlType === "dropdown" || node.controlType === "multiselect") ? (
          <>
            {sectionTitle("Select Control")}
            {boolField({
              label: "Searchable",
              value: !!props?.searchable,
              onChange: (searchable) => setProps(onChange, node, "searchable", searchable),
            })}
            {selectField({
              label: "Mode",
              value: props?.mode ?? "default",
              onChange: (mode) => setProps(onChange, node, "mode", mode),
              options: ["default", "modal", "dropdown"],
            })}
            {boolField({
              label: "Clearable",
              value: !!props?.clearable,
              onChange: (clearable) => setProps(onChange, node, "clearable", clearable),
            })}
            {boolField({
              label: "Close After Select",
              value: !!props?.closeAfterSelect,
              onChange: (closeAfterSelect) => setProps(onChange, node, "closeAfterSelect", closeAfterSelect),
            })}
            {boolField({
              label: "Show Search Input",
              value: !!props?.showSearchInput,
              onChange: (showSearchInput) => setProps(onChange, node, "showSearchInput", showSearchInput),
            })}
            {boolField({
              label: "Disabled",
              value: !!props?.disabled,
              onChange: (disabled) => setProps(onChange, node, "disabled", disabled),
            })}
            {node.controlType === "multiselect" ? (
              <>
                {numberField({
                  label: "Min Selected",
                  value: props?.minSelected,
                  onChange: (minSelected) => setProps(onChange, node, "minSelected", minSelected),
                })}
                {numberField({
                  label: "Max Selected",
                  value: props?.maxSelected,
                  onChange: (maxSelected) => setProps(onChange, node, "maxSelected", maxSelected),
                })}
                {selectField({
                  label: "Chip Style",
                  value: props?.chipStyle ?? "outlined",
                  onChange: (chipStyle) => setProps(onChange, node, "chipStyle", chipStyle),
                  options: ["outlined", "filled", "compact"],
                })}
              </>
            ) : null}

            <label style={labelStyle}>
              Options
              <textarea
                style={{ ...input, height: 120 }}
                value={valueToOptionsText((props?.options ?? []) as Array<{ label: string; value: string }>)}
                onChange={(e) => setProps(onChange, node, "options", optionsTextToValue(e.target.value))}
              />
            </label>
          </>
        ) : null}

        {node.controlType === "date" ? (
          <>
            {sectionTitle("Date/Time Control")}
            {selectField({
              label: "Mode",
              value: props?.mode ?? "date",
              onChange: (mode) => setProps(onChange, node, "mode", mode),
              options: ["date", "time", "datetime"],
            })}
            {selectField({
              label: "Display",
              value: props?.display ?? "default",
              onChange: (display) => setProps(onChange, node, "display", display),
              options: ["default", "spinner", "calendar", "clock"],
            })}
            {textField({
              label: "Locale",
              value: props?.locale ?? "",
              onChange: (locale) => setProps(onChange, node, "locale", locale),
            })}
            {textField({
              label: "Timezone",
              value: props?.timezone ?? "",
              onChange: (timezone) => setProps(onChange, node, "timezone", timezone),
            })}
            {numberField({
              label: "Minute Interval",
              value: props?.minuteInterval,
              onChange: (minuteInterval) => setProps(onChange, node, "minuteInterval", minuteInterval),
            })}
            {numberField({
              label: "Min Timezone Offset (minutes)",
              value: props?.timeZoneOffsetInMinutes,
              onChange: (timeZoneOffsetInMinutes) => setProps(onChange, node, "timeZoneOffsetInMinutes", timeZoneOffsetInMinutes),
            })}
            {boolField({
              label: "Show 24 Hours",
              value: !!props?.show24Hours,
              onChange: (show24Hours) => setProps(onChange, node, "show24Hours", show24Hours),
            })}
            {textField({
              label: "Minimum Date",
              value: props?.minimumDate ?? "",
              onChange: (minimumDate) => setProps(onChange, node, "minimumDate", minimumDate),
            })}
            {textField({
              label: "Maximum Date",
              value: props?.maximumDate ?? "",
              onChange: (maximumDate) => setProps(onChange, node, "maximumDate", maximumDate),
            })}
          </>
        ) : null}

        {node.controlType === "signature" ? (
          <>
            {sectionTitle("Signature Control")}
            {selectField({
              label: "Image Type",
              value: props?.imageType ?? "png",
              onChange: (imageType) => setProps(onChange, node, "imageType", imageType),
              options: ["png", "jpg"],
            })}
            {numberField({ label: "Pen Width", value: props?.penWidth, onChange: (penWidth) => setProps(onChange, node, "penWidth", penWidth) })}
            {numberField({ label: "Width", value: props?.width, onChange: (width) => setProps(onChange, node, "width", width) })}
            {numberField({ label: "Height", value: props?.height, onChange: (height) => setProps(onChange, node, "height", height) })}
            {numberField({ label: "Quality", value: props?.quality, onChange: (quality) => setProps(onChange, node, "quality", quality) })}
            {textField({ label: "Pen Color", value: props?.penColor ?? "", onChange: (penColor) => setProps(onChange, node, "penColor", penColor) })}
            {textField({ label: "Background Color", value: props?.backgroundColor ?? "", onChange: (backgroundColor) => setProps(onChange, node, "backgroundColor", backgroundColor) })}
            {boolField({ label: "Show Clear", value: !!props?.showClear, onChange: (showClear) => setProps(onChange, node, "showClear", showClear) })}
          </>
        ) : null}

        {node.controlType === "file" ? (
          <>
            {sectionTitle("File Control")}
            {boolField({
              label: "Multiple",
              value: !!props?.multiple,
              onChange: (multiple) => setProps(onChange, node, "multiple", multiple),
            })}
            {selectField({
              label: "Capture",
              value: String(props?.capture ?? ""),
              onChange: (capture) => setProps(onChange, node, "capture", capture || false),
              options: ["", "user", "environment"],
            })}
            {numberField({
              label: "Max Files",
              value: props?.maxFiles,
              onChange: (maxFiles) => setProps(onChange, node, "maxFiles", maxFiles),
            })}
            {numberField({
              label: "Max Size MB",
              value: props?.maxSizeMB,
              onChange: (maxSizeMB) => setProps(onChange, node, "maxSizeMB", maxSizeMB),
            })}
            {numberField({
              label: "Max Width",
              value: props?.maxWidth,
              onChange: (maxWidth) => setProps(onChange, node, "maxWidth", maxWidth),
            })}
            {numberField({
              label: "Max Height",
              value: props?.maxHeight,
              onChange: (maxHeight) => setProps(onChange, node, "maxHeight", maxHeight),
            })}
            {numberField({
              label: "Max Duration Seconds",
              value: props?.maxDurationSeconds,
              onChange: (maxDurationSeconds) => setProps(onChange, node, "maxDurationSeconds", maxDurationSeconds),
            })}
            {textField({
              label: "Storage",
              value: props?.storage ?? "",
              onChange: (storage) => setProps(onChange, node, "storage", storage),
            })}
            {textField({
              label: "Upload Endpoint",
              value: props?.uploadEndpoint ?? "",
              onChange: (uploadEndpoint) => setProps(onChange, node, "uploadEndpoint", uploadEndpoint),
            })}
            {boolField({
              label: "Auto Upload",
              value: !!props?.autoUpload,
              onChange: (autoUpload) => setProps(onChange, node, "autoUpload", autoUpload),
            })}
            <label style={labelStyle}>
              Allowed MIME Types
              <textarea
                style={{ ...input, height: 90 }}
                value={(props?.allowedMimeTypes ?? []).join("\n")}
                onChange={(e) =>
                  setProps(
                    onChange,
                    node,
                    "allowedMimeTypes",
                    e.target.value
                      .split("\n")
                      .map((v) => v.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
          </>
        ) : null}

        <label style={labelStyle}>
          Props JSON (advanced)
          <textarea
            style={{ ...input, height: 120, fontFamily: "monospace", whiteSpace: "pre" }}
            value={JSON.stringify(props ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const nextProps = JSON.parse(e.target.value);
                onChange({ props: nextProps });
              } catch {
                return;
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid #d0d5dd",
  borderRadius: 20,
  padding: 14,
  background: "#fff",
  color: "#111",
  boxShadow: "0 10px 30px rgba(16, 24, 40, 0.04)",
};

const panelHeader: React.CSSProperties = {
  marginBottom: 12,
};

const panelHint: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#667085",
};

const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontWeight: 600, color: "#344054", fontSize: 13 };
const inline: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", fontWeight: 600, color: "#344054", fontSize: 13 };
const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #d0d5dd",
  fontFamily: "system-ui",
  fontSize: 13,
};
