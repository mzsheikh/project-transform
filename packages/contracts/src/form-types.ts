// packages/contracts/src/form-types.ts

export type SchemaVersion = "1.0";

export type FormStatus = "draft" | "published" | "archived";

export interface FormDefinition {
  schemaVersion: SchemaVersion;
  formKey: string;          // stable key across versions
  title: string;
  description?: string;
  version: number;          // increments when published
  status: FormStatus;

  theme?: {
    primaryColor?: string;
  };

  settings?: {
    allowDrafts?: boolean;
    allowSubmit?: boolean;
    allowEditAfterSubmit?: boolean;
  };

  root: LayoutNode;         // always a layout node
}

/** Common base for all nodes in the tree */
export interface BaseNode {
  id: string;               // unique within the form (designer uses this)
  label?: string;

  // reserved for v2 (conditional logic)
  visibleWhen?: Condition | null;
  requiredWhen?: Condition | null;
}

/** Conditions (placeholder for later) */
export type Condition =
  | { op: "eq"; key: string; value: unknown }
  | { op: "neq"; key: string; value: unknown }
  | { op: "in"; key: string; values: unknown[] }
  | { op: "and"; conditions: Condition[] }
  | { op: "or"; conditions: Condition[] };

export type Node = LayoutNode | ControlNode;

/** Layouts */
export type LayoutType = "stack" | "row" | "section";

export interface LayoutNode extends BaseNode {
  type: "layout";
  layoutType: LayoutType;
  props?: LayoutProps;
  children: Node[];
}

export type LayoutProps =
  | { gap?: number } // stack
  | { gap?: number; wrap?: boolean } // row
  | { collapsible?: boolean; defaultCollapsed?: boolean }; // section

/** Controls */
export type ControlType =
  | "text"
  | "number"
  | "switch"
  | "dropdown"
  | "multiselect"
  | "date"
  | "signature"
  | "file";

export interface ControlNode extends BaseNode {
  type: "control";
  controlType: ControlType;
  key: string; // stable data-binding key used in submission payload
  props?: ControlProps;
  validation?: ValidationRules;
}

export type ControlProps =
  | TextProps
  | NumberProps
  | SwitchProps
  | DropdownProps
  | MultiSelectProps
  | DateProps
  | SignatureProps
  | FileProps;

export interface ValidationRules {
  required?: boolean;

  // string / number bounds (optional, per control)
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;

  // arrays
  maxItems?: number;
}

/** --- Individual control props --- */
export interface TextProps {
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}

export interface NumberProps {
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface SwitchProps {
  defaultValue?: boolean;
}

export interface OptionItem {
  label: string;
  value: string;
}

export interface DropdownProps {
  options: OptionItem[];
}

export interface MultiSelectProps {
  options: OptionItem[];
  maxSelected?: number;
}

export interface DateProps {
  mode?: "date" | "datetime";
}

export interface SignatureProps {
  format?: "png" | "jpg";
}

export interface FileProps {
  accept?: string[];     // e.g. ["image/*", "application/pdf"]
  maxFiles?: number;
  maxSizeMB?: number;
}