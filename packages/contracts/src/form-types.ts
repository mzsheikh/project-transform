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
  | "image"
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
  | ImageProps
  | FileProps;

export interface BaseControlProps {
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  helpText?: string;
  errorMessage?: string;
  defaultValue?: unknown;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  accessible?: boolean;
  testID?: string;
  style?: ControlStyleProps;
}

export interface ControlStyleProps {
  width?: number | string;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

export interface RNOption {
  label: string;
  value: string;
  disabled?: boolean;
}

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
  maxLength?: number;
  /** legacy maxLength kept for compatibility */
  // keep in control props for validation usage and compatibility with previous schema
  minLength?: number;
}

export interface NumberProps extends BaseControlProps {
  /** React Native TextInput for numeric entry */
  keyboardType?: "number-pad" | "decimal-pad" | "numeric";
  integerOnly?: boolean;
  precision?: number;
  allowNegative?: boolean;
  format?: "decimal" | "currency";
  min?: number;
  max?: number;
  step?: number;
}

export interface SwitchProps extends BaseControlProps {
  defaultValue?: boolean;
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
  disabled?: boolean;
}

export interface MultiSelectProps extends BaseControlProps {
  options: RNOption[];
  searchable?: boolean;
  mode?: "default" | "modal" | "dropdown";
  clearable?: boolean;
  closeAfterSelect?: boolean;
  showSearchInput?: boolean;
  minSelected?: number;
  maxSelected?: number;
  disabled?: boolean;
  chipStyle?: "outlined" | "filled" | "compact";
}

export interface DateProps extends BaseControlProps {
  mode?: "date" | "time" | "datetime";
  display?: "default" | "spinner" | "calendar" | "clock";
  minimumDate?: string;
  maximumDate?: string;
  minuteInterval?: 1 | 5 | 10 | 15 | 30;
  locale?: string;
  timezone?: string;
  show24Hours?: boolean;
  timeZoneOffsetInMinutes?: number;
}

export interface SignatureProps extends BaseControlProps {
  imageType?: "png" | "jpg";
  penColor?: string;
  penWidth?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  quality?: number;
  showClear?: boolean;
}

export interface ImageProps extends BaseControlProps {
  buttonLabel?: string;
  allowCamera?: boolean;
  allowGallery?: boolean;
  allowsEditing?: boolean;
  quality?: number;
}

export interface FileProps extends BaseControlProps {
  accept?: string[]; // e.g. ["image/*", "application/pdf"]
  maxFiles?: number;
  maxSizeMB?: number;
  multiple?: boolean;
  capture?: "user" | "environment" | false;
  maxWidth?: number;
  maxHeight?: number;
  maxDurationSeconds?: number;
  storage?: "local" | "cloud";
  uploadEndpoint?: string;
  autoUpload?: boolean;
  allowedMimeTypes?: string[];
}

export type SharedControlProps = BaseControlProps;
