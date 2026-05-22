/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import type { Node } from "@transform/contracts/form-types";
import { validateExpressionSyntax } from "@transform/contracts/expressions";
import { ExpressionInput, type ExpressionFieldInfo } from "./ExpressionInput";
import { isControl, isLayout } from "./types";

type Tab = "general" | "validation" | "advanced";

function setProps(onChange: (patch: any) => void, node: any, path: string, value: unknown) {
  const props = { ...(node.props ?? {}) } as Record<string, any>;
  if (path.startsWith("style.")) {
    const [, leaf] = path.split(".");
    props.style = { ...(props.style ?? {}), [leaf]: value };
  } else if (path === "trackColor.true" || path === "trackColor.false") {
    const [, leaf] = path.split(".");
    props.trackColor = { ...(props.trackColor ?? {}), [leaf]: value };
  } else {
    props[path] = value;
  }
  onChange({ props });
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

export function PropertiesPanel({
  node,
  onChange,
  onClose,
  expressionFields = [],
}: {
  node: Node | null;
  onChange: (patch: Partial<any>) => void;
  onClose?: () => void;
  expressionFields?: ExpressionFieldInfo[];
}) {
  const [tab, setTab] = useState<Tab>("general");
  const [visibilityOpen, setVisibilityOpen] = useState(false);

  if (!node) {
    return (
      <aside style={panel}>
        <PanelHeader title="Properties" hint="Select a layout or field to edit its configuration." onClose={onClose} />
        <div style={emptyPanel}>Select a node...</div>
      </aside>
    );
  }

  if (isLayout(node)) {
    const props = (node.props ?? {}) as Record<string, any>;
    return (
      <aside style={panel}>
        <PanelHeader title="Properties" hint={`Layout: ${node.layoutType}`} onClose={onClose} />
        <div style={formGrid}>
          <TextField label="Label" value={(node as any).label ?? ""} onChange={(label) => onChange({ label })} />
          {node.layoutType === "repeater" ? (
            <>
              <TextField label="Key" value={(node as any).key ?? ""} onChange={(key) => onChange({ key })} />
              <SectionTitle title="Repeat Section" />
              <NumberField label="Min Items" value={props.minItems} onChange={(minItems) => setProps(onChange, node, "minItems", minItems)} />
              <NumberField label="Max Items" value={props.maxItems} onChange={(maxItems) => setProps(onChange, node, "maxItems", maxItems)} />
              <NumberField label="Default Items" value={props.defaultItems} onChange={(defaultItems) => setProps(onChange, node, "defaultItems", defaultItems)} />
              <TextField label="Add Button Label" value={props.addButtonLabel ?? ""} onChange={(addButtonLabel) => setProps(onChange, node, "addButtonLabel", addButtonLabel)} />
              <TextField label="Remove Button Label" value={props.removeButtonLabel ?? ""} onChange={(removeButtonLabel) => setProps(onChange, node, "removeButtonLabel", removeButtonLabel)} />
            </>
          ) : null}
        </div>
      </aside>
    );
  }

  if (!isControl(node)) return null;
  const props = (node.props ?? {}) as Record<string, any>;

  return (
    <aside style={panel}>
      <PanelHeader title="Properties" hint={`Control: ${node.controlType}`} onClose={onClose} />

      <div style={tabs}>
        <TabButton label="General" active={tab === "general"} onClick={() => setTab("general")} />
        <TabButton label="Validation" active={tab === "validation"} onClick={() => setTab("validation")} />
        <TabButton label="Advanced" active={tab === "advanced"} onClick={() => setTab("advanced")} />
      </div>

      <div style={formGrid}>
        {tab === "general" ? (
          <>
            <TextField label="Label" value={node.label ?? ""} onChange={(label) => onChange({ label })} />
            <TextField label="Key" value={node.key} onChange={(key) => onChange({ key })} />
            <BoolField label="Required" value={node.validation?.required ?? false} expressionFields={expressionFields} onChange={(required) => onChange({ validation: { ...(node.validation ?? {}), required } })} />
            <SectionTitle title="Base Control Props" />
            <TextField label="Placeholder" value={props.placeholder ?? ""} enableExpressions expressionFields={expressionFields} onChange={(placeholder) => setProps(onChange, node, "placeholder", placeholder)} />
            <TextField label="Help Text" value={props.helpText ?? ""} enableExpressions expressionFields={expressionFields} onChange={(helpText) => setProps(onChange, node, "helpText", helpText)} />
            <TextField label="Default Value" value={props.defaultValue ?? ""} enableExpressions expressionFields={expressionFields} onChange={(defaultValue) => setProps(onChange, node, "defaultValue", defaultValue)} />
            <TextField label="Value" value={props.value ?? ""} enableExpressions expressionFields={expressionFields} onChange={(value) => setProps(onChange, node, "value", value)} />
            <TextField label="Error Message" value={props.errorMessage ?? ""} enableExpressions expressionFields={expressionFields} onChange={(errorMessage) => setProps(onChange, node, "errorMessage", errorMessage)} />
          </>
        ) : null}

        {tab === "validation" ? (
          <>
            <BoolField label="Required" value={node.validation?.required ?? false} expressionFields={expressionFields} onChange={(required) => onChange({ validation: { ...(node.validation ?? {}), required } })} />
            {node.controlType === "text" ? (
              <>
                <NumberField label="Min Length" value={props.minLength} expressionFields={expressionFields} onChange={(minLength) => setProps(onChange, node, "minLength", minLength)} />
                <NumberField label="Max Length" value={props.maxLength} expressionFields={expressionFields} onChange={(maxLength) => setProps(onChange, node, "maxLength", maxLength)} />
              </>
            ) : null}
            {node.controlType === "number" ? (
              <>
                <NumberField label="Min" value={props.min} expressionFields={expressionFields} onChange={(min) => setProps(onChange, node, "min", min)} />
                <NumberField label="Max" value={props.max} expressionFields={expressionFields} onChange={(max) => setProps(onChange, node, "max", max)} />
                <NumberField label="Step" value={props.step} expressionFields={expressionFields} onChange={(step) => setProps(onChange, node, "step", step)} />
                <BoolField label="Integer Only" value={props.integerOnly ?? false} expressionFields={expressionFields} onChange={(integerOnly) => setProps(onChange, node, "integerOnly", integerOnly)} />
                <BoolField label="Allow Negative" value={props.allowNegative ?? false} expressionFields={expressionFields} onChange={(allowNegative) => setProps(onChange, node, "allowNegative", allowNegative)} />
              </>
            ) : null}
            {node.controlType === "multiselect" ? (
              <>
                <NumberField label="Min Selected" value={props.minSelected} expressionFields={expressionFields} onChange={(minSelected) => setProps(onChange, node, "minSelected", minSelected)} />
                <NumberField label="Max Selected" value={props.maxSelected} expressionFields={expressionFields} onChange={(maxSelected) => setProps(onChange, node, "maxSelected", maxSelected)} />
              </>
            ) : null}
            {node.controlType === "date" ? (
              <>
                <TextField label="Minimum Date" value={props.minimumDate ?? ""} enableExpressions expressionFields={expressionFields} onChange={(minimumDate) => setProps(onChange, node, "minimumDate", minimumDate)} />
                <TextField label="Maximum Date" value={props.maximumDate ?? ""} enableExpressions expressionFields={expressionFields} onChange={(maximumDate) => setProps(onChange, node, "maximumDate", maximumDate)} />
              </>
            ) : null}
            {node.controlType === "file" ? (
              <>
                <NumberField label="Max Files" value={props.maxFiles} expressionFields={expressionFields} onChange={(maxFiles) => setProps(onChange, node, "maxFiles", maxFiles)} />
                <NumberField label="Max Size MB" value={props.maxSizeMB} expressionFields={expressionFields} onChange={(maxSizeMB) => setProps(onChange, node, "maxSizeMB", maxSizeMB)} />
              </>
            ) : null}
          </>
        ) : null}

        {tab === "advanced" ? (
          <>
            <SectionTitle title="Advanced Props" />
            <TextField label="Accessibility Label" value={props.accessibilityLabel ?? ""} enableExpressions expressionFields={expressionFields} onChange={(accessibilityLabel) => setProps(onChange, node, "accessibilityLabel", accessibilityLabel)} />
            <BoolField label="Enabled" value={props.enabled ?? true} defaultValue={true} expressionFields={expressionFields} onChange={(enabled) => setProps(onChange, node, "enabled", enabled)} />
            <BoolField label="Disabled" value={props.disabled ?? false} expressionFields={expressionFields} onChange={(disabled) => setProps(onChange, node, "disabled", disabled)} />
            <BoolField label="Read Only" value={props.readOnly ?? false} expressionFields={expressionFields} onChange={(readOnly) => setProps(onChange, node, "readOnly", readOnly)} />
            <BoolField label="Accessible" value={props.accessible ?? true} defaultValue={true} expressionFields={expressionFields} onChange={(accessible) => setProps(onChange, node, "accessible", accessible)} />
            <BoolField label="Auto Focus" value={props.autoFocus ?? false} expressionFields={expressionFields} onChange={(autoFocus) => setProps(onChange, node, "autoFocus", autoFocus)} />
            <TextField label="Test ID" value={props.testID ?? ""} onChange={(testID) => setProps(onChange, node, "testID", testID)} />
            <ControlSpecificFields node={node} props={props} expressionFields={expressionFields} onChange={onChange} />
            <SectionTitle title="Style" />
            <TextField label="Width" value={props.style?.width ?? ""} enableExpressions expressionFields={expressionFields} onChange={(width) => setProps(onChange, node, "style.width", width)} />
            <NumberField label="Padding" value={props.style?.padding} expressionFields={expressionFields} onChange={(padding) => setProps(onChange, node, "style.padding", padding)} />
            <NumberField label="Margin" value={props.style?.margin} expressionFields={expressionFields} onChange={(margin) => setProps(onChange, node, "style.margin", margin)} />
            <NumberField label="Border Radius" value={props.style?.borderRadius} expressionFields={expressionFields} onChange={(borderRadius) => setProps(onChange, node, "style.borderRadius", borderRadius)} />
            <NumberField label="Font Size" value={props.style?.fontSize} expressionFields={expressionFields} onChange={(fontSize) => setProps(onChange, node, "style.fontSize", fontSize)} />
            <TextField label="Text Color" value={props.style?.color ?? ""} enableExpressions expressionFields={expressionFields} onChange={(color) => setProps(onChange, node, "style.color", color)} />
            <TextField label="Background Color" value={props.style?.backgroundColor ?? ""} enableExpressions expressionFields={expressionFields} onChange={(backgroundColor) => setProps(onChange, node, "style.backgroundColor", backgroundColor)} />
            <JsonField value={props} onChange={(nextProps) => onChange({ props: nextProps })} />
          </>
        ) : null}
      </div>

      <button type="button" style={accordionBtn} onClick={() => setVisibilityOpen((v) => !v)}>
        <span>Visibility</span>
        <span>{visibilityOpen ? "⌃" : "⌄"}</span>
      </button>
      {visibilityOpen ? (
        <div style={{ ...formGrid, paddingTop: 14 }}>
          <TextField label="Visible When" value={props.visibleWhen ?? ""} enableExpressions expressionFields={expressionFields} onChange={(visibleWhen) => setProps(onChange, node, "visibleWhen", visibleWhen)} />
        </div>
      ) : null}
    </aside>
  );
}

function ControlSpecificFields({
  node,
  props,
  expressionFields,
  onChange,
}: {
  node: any;
  props: Record<string, any>;
  expressionFields: ExpressionFieldInfo[];
  onChange: (patch: any) => void;
}) {
  if (node.controlType === "text") {
    return (
      <>
        <SectionTitle title="Text Control" />
        <SelectField label="Keyboard Type" value={props.keyboardType ?? "default"} options={["default", "email-address", "numeric", "phone-pad", "url", "decimal-pad", "number-pad"]} onChange={(keyboardType) => setProps(onChange, node, "keyboardType", keyboardType)} />
        <BoolField label="Multiline" value={props.multiline ?? false} expressionFields={expressionFields} onChange={(multiline) => setProps(onChange, node, "multiline", multiline)} />
        <BoolField label="Secure Text Entry" value={props.secureTextEntry ?? false} expressionFields={expressionFields} onChange={(secureTextEntry) => setProps(onChange, node, "secureTextEntry", secureTextEntry)} />
      </>
    );
  }
  if (node.controlType === "dropdown" || node.controlType === "multiselect") {
    const optionsValue = isExpression(props.options)
      ? props.options
      : valueToOptionsText((Array.isArray(props.options) ? props.options : []) as Array<{ label: string; value: string }>);
    return (
      <>
        <SectionTitle title="Select Control" />
        <BoolField label="Searchable" value={props.searchable ?? false} expressionFields={expressionFields} onChange={(searchable) => setProps(onChange, node, "searchable", searchable)} />
        <BoolField label="Clearable" value={props.clearable ?? false} expressionFields={expressionFields} onChange={(clearable) => setProps(onChange, node, "clearable", clearable)} />
        <TextAreaField
          label="Options"
          value={optionsValue}
          enableExpressions
          expressionFields={expressionFields}
          onChange={(text) => setProps(onChange, node, "options", text.trim().startsWith("=") ? text.trim() : optionsTextToValue(text))}
        />
      </>
    );
  }
  if (node.controlType === "date") {
    return (
      <>
        <SectionTitle title="Date/Time Control" />
        <SelectField label="Mode" value={props.mode ?? "date"} options={["date", "time", "datetime"]} onChange={(mode) => setProps(onChange, node, "mode", mode)} />
        <SelectField label="Display" value={props.display ?? "default"} options={["default", "spinner", "calendar", "clock"]} onChange={(display) => setProps(onChange, node, "display", display)} />
      </>
    );
  }
  if (node.controlType === "signature") {
    return (
      <>
        <SectionTitle title="Signature Control" />
        <SelectField label="Image Type" value={props.imageType ?? "png"} options={["png", "jpg"]} onChange={(imageType) => setProps(onChange, node, "imageType", imageType)} />
        <NumberField label="Pen Width" value={props.penWidth} expressionFields={expressionFields} onChange={(penWidth) => setProps(onChange, node, "penWidth", penWidth)} />
        <NumberField label="Height" value={props.height} expressionFields={expressionFields} onChange={(height) => setProps(onChange, node, "height", height)} />
        <TextField label="Pen Color" value={props.penColor ?? ""} enableExpressions expressionFields={expressionFields} onChange={(penColor) => setProps(onChange, node, "penColor", penColor)} />
      </>
    );
  }
  if (node.controlType === "image") {
    return (
      <>
        <SectionTitle title="Image Control" />
        <TextField label="Button Label" value={props.buttonLabel ?? ""} enableExpressions expressionFields={expressionFields} onChange={(buttonLabel) => setProps(onChange, node, "buttonLabel", buttonLabel)} />
        <BoolField label="Allow Camera" value={props.allowCamera ?? true} defaultValue={true} expressionFields={expressionFields} onChange={(allowCamera) => setProps(onChange, node, "allowCamera", allowCamera)} />
        <BoolField label="Allow Gallery" value={props.allowGallery ?? true} defaultValue={true} expressionFields={expressionFields} onChange={(allowGallery) => setProps(onChange, node, "allowGallery", allowGallery)} />
        <BoolField label="Allow Editing" value={props.allowsEditing ?? false} expressionFields={expressionFields} onChange={(allowsEditing) => setProps(onChange, node, "allowsEditing", allowsEditing)} />
        <NumberField label="Quality (0-1)" value={props.quality} expressionFields={expressionFields} onChange={(quality) => setProps(onChange, node, "quality", quality)} />
      </>
    );
  }
  if (node.controlType === "file") {
    return (
      <>
        <SectionTitle title="File Control" />
        <BoolField label="Multiple" value={props.multiple ?? false} expressionFields={expressionFields} onChange={(multiple) => setProps(onChange, node, "multiple", multiple)} />
        <TextAreaField label="Allowed MIME Types" value={(props.allowedMimeTypes ?? []).join("\n")} onChange={(text) => setProps(onChange, node, "allowedMimeTypes", text.split("\n").map((v) => v.trim()).filter(Boolean))} />
      </>
    );
  }
  return null;
}

function PanelHeader({ title, hint, onClose }: { title: string; hint: string; onClose?: () => void }) {
  return (
    <div style={panelHeader}>
      <div>
        <h3 style={panelTitle}>{title}</h3>
        <div style={panelHint}>{hint}</div>
      </div>
      <button type="button" style={closeBtn} onClick={onClose} aria-label="Close properties">×</button>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" style={{ ...tabBtn, ...(active ? tabBtnActive : null) }} onClick={onClick}>{label}</button>;
}

function SectionTitle({ title }: { title: string }) {
  return <div style={sectionTitle}>{title}</div>;
}

type ExpressionCapableBool = boolean | string | undefined;
type ExpressionCapableNumber = number | string | undefined;

function isExpression(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("=");
}

function BoolField({
  label,
  value,
  defaultValue = false,
  expressionFields = [],
  onChange,
}: {
  label: string;
  value: ExpressionCapableBool;
  defaultValue?: boolean;
  expressionFields?: ExpressionFieldInfo[];
  onChange: (v: boolean | string) => void;
}) {
  const expression = isExpression(value) ? value : "";
  const checked = typeof value === "boolean" ? value : defaultValue;
  return (
    <div style={labelStyle}>
      <label style={inline}>
        <input type="checkbox" checked={checked} disabled={!!expression} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      <ExpressionInput
        style={{ marginTop: 6 }}
        value={expression}
        placeholder="=formula"
        expressionFields={expressionFields}
        onChange={(next) => {
          const trimmed = next.trim();
          onChange(trimmed.startsWith("=") ? trimmed : checked);
        }}
      />
      <FormulaHint value={expression} />
    </div>
  );
}

function TextField({
  label,
  value,
  enableExpressions = false,
  expressionFields = [],
  onChange,
}: {
  label: string;
  value: string | number | undefined;
  enableExpressions?: boolean;
  expressionFields?: ExpressionFieldInfo[];
  onChange: (value: string) => void;
}) {
  const textValue = value ?? "";
  return (
    <label style={labelStyle}>
      {label}
      {enableExpressions ? (
        <ExpressionInput value={textValue} expressionFields={expressionFields} onChange={onChange} />
      ) : (
        <input style={input} value={textValue} onChange={(e) => onChange(e.target.value)} />
      )}
      {enableExpressions ? <FormulaHint value={typeof textValue === "string" ? textValue : ""} /> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  enableExpressions = false,
  expressionFields = [],
  onChange,
}: {
  label: string;
  value: string;
  enableExpressions?: boolean;
  expressionFields?: ExpressionFieldInfo[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={labelStyle}>
      {label}
      {enableExpressions ? (
        <ExpressionInput value={value} multiline rows={5} expressionFields={expressionFields} onChange={onChange} />
      ) : (
        <textarea style={{ ...input, height: 110 }} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {enableExpressions ? <FormulaHint value={value} /> : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  expressionFields = [],
  onChange,
}: {
  label: string;
  value: ExpressionCapableNumber;
  expressionFields?: ExpressionFieldInfo[];
  onChange: (value: number | string | undefined) => void;
}) {
  const expression = isExpression(value) ? value : "";
  return (
    <label style={labelStyle}>
      {label}
      <ExpressionInput
        inputType={expression ? "text" : "number"}
        value={value ?? ""}
        expressionFields={expressionFields}
        onChange={(next) => {
          const trimmed = next.trim();
          onChange(trimmed.startsWith("=") ? trimmed : numberOrUndefined(trimmed));
        }}
      />
      <FormulaHint value={expression} />
    </label>
  );
}

function FormulaHint({ value }: { value: string }) {
  if (!isExpression(value)) return null;
  const issue = validateExpressionSyntax(value)[0];
  return <span style={issue ? formulaError : formulaOk}>{issue ? issue.message : "Formula syntax is valid."}</span>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <select style={input} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function JsonField({ value, onChange }: { value: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  return (
    <label style={labelStyle}>
      Props JSON
      <textarea
        style={{ ...input, height: 130, fontFamily: "monospace", whiteSpace: "pre" }}
        value={JSON.stringify(value, null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            return;
          }
        }}
      />
    </label>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid #dfe6f0",
  borderRadius: 8,
  background: "#fff",
  color: "#111",
  boxShadow: "0 14px 35px rgba(20, 38, 69, 0.04)",
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 12,
  padding: "18px 18px 14px",
};

const panelTitle: React.CSSProperties = { margin: 0, fontSize: 20, color: "#2f3a4a" };
const panelHint: React.CSSProperties = { marginTop: 10, fontSize: 15, color: "#667085" };
const closeBtn: React.CSSProperties = { border: 0, background: "transparent", color: "#667085", fontSize: 30, lineHeight: 1, cursor: "pointer" };
const emptyPanel: React.CSSProperties = { padding: 18, color: "#667085" };

const tabs: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  borderTop: "1px solid #e6ebf2",
  borderBottom: "1px solid #e6ebf2",
};

const tabBtn: React.CSSProperties = {
  border: 0,
  background: "#fff",
  padding: "16px 8px",
  color: "#475467",
  fontWeight: 800,
  cursor: "pointer",
  borderBottom: "3px solid transparent",
};

const tabBtnActive: React.CSSProperties = {
  color: "#175cd3",
  borderBottomColor: "#2f6fed",
};

const formGrid: React.CSSProperties = { display: "grid", gap: 16, padding: 18 };
const sectionTitle: React.CSSProperties = { marginTop: 4, color: "#475467", fontSize: 14, fontWeight: 900 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 8, fontWeight: 800, color: "#344054", fontSize: 13 };
const inline: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", fontWeight: 800, color: "#344054", fontSize: 14 };
const input: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid #dfe6f0",
  fontFamily: "system-ui",
  fontSize: 14,
  color: "#344054",
  background: "#fff",
};
const formulaOk: React.CSSProperties = { color: "#067647", fontSize: 12, fontWeight: 700 };
const formulaError: React.CSSProperties = { color: "#b42318", fontSize: 12, fontWeight: 700 };

const accordionBtn: React.CSSProperties = {
  width: "100%",
  border: 0,
  borderTop: "1px solid #e6ebf2",
  background: "#fff",
  padding: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  fontWeight: 900,
  color: "#344054",
  fontSize: 16,
};
