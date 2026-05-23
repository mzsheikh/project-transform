// packages/contracts/src/form-types.ts

import type { SubmissionDataValue } from "./submission-types";

export type SchemaVersion = "1.0" | "1.1" | "1.2";
export type ExpressionString = `=${string}`;
export type DynamicValue<T> = T | ExpressionString;

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
export type LayoutType = "form" | "stack" | "row" | "section" | "repeater";

export interface LayoutNode extends BaseNode {
  type: "layout";
  layoutType: LayoutType;
  key?: string; // used by repeatable layouts to bind array data
  props?: LayoutProps;
  children: Node[];
}

export type LayoutProps =
  | { gap?: number } // stack
  | { gap?: number; wrap?: boolean } // row
  | { collapsible?: boolean; defaultCollapsed?: boolean } // section
  | RepeatSectionProps;

export interface RepeatSectionProps {
  minItems?: number;
  maxItems?: number;
  defaultItems?: number;
  addButtonLabel?: string;
  removeButtonLabel?: string;
}

/** Controls */
export type ControlType =
  | "text"
  | "number"
  | "switch"
  | "dropdown"
  | "multiselect"
  | "date"
  | "signature"
  | "image"
  | "file"
  | "button";

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
  | ImageProps
  | FileProps
  | ButtonProps;

export interface BaseControlProps {
  [key: string]: unknown;
  placeholder?: DynamicValue<string>;
  required?: DynamicValue<boolean>;
  enabled?: DynamicValue<boolean>;
  disabled?: DynamicValue<boolean>;
  readOnly?: DynamicValue<boolean>;
  visible?: DynamicValue<boolean>;
  visibleWhen?: DynamicValue<boolean>;
  helpText?: DynamicValue<string>;
  errorMessage?: DynamicValue<string>;
  defaultValue?: DynamicValue<SubmissionDataValue>;
  value?: DynamicValue<SubmissionDataValue>;
  autoFocus?: DynamicValue<boolean>;
  accessibilityLabel?: DynamicValue<string>;
  accessible?: DynamicValue<boolean>;
  testID?: string;
  style?: ControlStyleProps;
}

export interface ControlStyleProps {
  [key: string]: unknown;
  width?: DynamicValue<number | string>;
  padding?: DynamicValue<number>;
  margin?: DynamicValue<number>;
  borderRadius?: DynamicValue<number>;
  fontSize?: DynamicValue<number>;
  color?: DynamicValue<string>;
  backgroundColor?: DynamicValue<string>;
}

export interface RNOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface ValidationRules {
  required?: DynamicValue<boolean>;

  // string / number bounds (optional, per control)
  minLength?: DynamicValue<number>;
  maxLength?: DynamicValue<number>;
  min?: DynamicValue<number>;
  max?: DynamicValue<number>;

  // arrays
  maxItems?: DynamicValue<number>;
}

/** --- Individual control props --- */
export interface TextProps extends BaseControlProps {
  /** React Native TextInput */
  keyboardType?:
    | "default"
    | "email-address"
    | "numeric"
    | "phone-pad"
    | "url"
    | "decimal"
    | "number-pad"
    | "ascii-capable"
    | "visible-password"
    | "web-search";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  autoComplete?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  textAlign?: "left" | "center" | "right" | "auto";
  returnKeyType?: "done" | "next" | "search" | "go" | "send";
  blurOnSubmit?: boolean;
  maxLength?: DynamicValue<number>;
  /** legacy maxLength kept for compatibility */
  // keep in control props for validation usage and compatibility with previous schema
  minLength?: DynamicValue<number>;
}

export interface NumberProps extends BaseControlProps {
  /** React Native TextInput for numeric entry */
  keyboardType?: "number-pad" | "decimal-pad" | "numeric";
  integerOnly?: DynamicValue<boolean>;
  precision?: DynamicValue<number>;
  allowNegative?: DynamicValue<boolean>;
  format?: "decimal" | "currency";
  min?: DynamicValue<number>;
  max?: DynamicValue<number>;
  step?: DynamicValue<number>;
}

export interface SwitchProps extends BaseControlProps {
  defaultValue?: DynamicValue<boolean>;
  trackColor?: {
    true: string;
    false: string;
  };
  thumbColor?: string;
  ios_backgroundColor?: string;
  onTintColor?: string;
}

export interface OptionItem extends RNOption {
  label: string;
  value: string;
}

export interface DropdownProps extends BaseControlProps {
  options: RNOption[];
  searchable?: boolean;
  mode?: "default" | "modal" | "dropdown";
  clearable?: boolean;
  closeAfterSelect?: boolean;
  showSearchInput?: boolean;
  disabled?: DynamicValue<boolean>;
}

export interface MultiSelectProps extends BaseControlProps {
  options: RNOption[];
  searchable?: boolean;
  mode?: "default" | "modal" | "dropdown";
  clearable?: boolean;
  closeAfterSelect?: boolean;
  showSearchInput?: boolean;
  minSelected?: DynamicValue<number>;
  maxSelected?: DynamicValue<number>;
  disabled?: DynamicValue<boolean>;
  chipStyle?: "outlined" | "filled" | "compact";
}

export interface DateProps extends BaseControlProps {
  mode?: "date" | "time" | "datetime";
  display?: "default" | "spinner" | "calendar" | "clock";
  minimumDate?: DynamicValue<string>;
  maximumDate?: DynamicValue<string>;
  minuteInterval?: 1 | 5 | 10 | 15 | 30;
  locale?: string;
  timezone?: string;
  show24Hours?: boolean;
  timeZoneOffsetInMinutes?: number;
}

export interface SignatureProps extends BaseControlProps {
  imageType?: "png" | "jpg";
  penColor?: string;
  penWidth?: DynamicValue<number>;
  width?: DynamicValue<number>;
  height?: DynamicValue<number>;
  backgroundColor?: DynamicValue<string>;
  quality?: DynamicValue<number>;
  showClear?: DynamicValue<boolean>;
}

export interface ImageProps extends BaseControlProps {
  buttonLabel?: DynamicValue<string>;
  allowCamera?: DynamicValue<boolean>;
  allowGallery?: DynamicValue<boolean>;
  allowsEditing?: DynamicValue<boolean>;
  quality?: DynamicValue<number>;
}

export interface FileProps extends BaseControlProps {
  accept?: string[]; // e.g. ["image/*", "application/pdf"]
  maxFiles?: DynamicValue<number>;
  maxSizeMB?: DynamicValue<number>;
  multiple?: DynamicValue<boolean>;
  capture?: "user" | "environment" | false;
  maxWidth?: DynamicValue<number>;
  maxHeight?: DynamicValue<number>;
  maxDurationSeconds?: DynamicValue<number>;
  storage?: "local" | "cloud";
  uploadEndpoint?: string;
  autoUpload?: DynamicValue<boolean>;
  allowedMimeTypes?: string[];
}

export type ButtonActionType = "save_draft" | "submit";

export type ButtonAction =
  | {
      id: string;
      type: "save_draft";
      enabled?: DynamicValue<boolean>;
    }
  | {
      id: string;
      type: "submit";
      enabled?: DynamicValue<boolean>;
      clearDraftOnSuccess?: boolean;
    };

export interface ButtonProps extends BaseControlProps {
  text?: DynamicValue<string>;
  variant?: "primary" | "secondary" | "danger";
  actions: ButtonAction[];
}

export type SharedControlProps = BaseControlProps;
