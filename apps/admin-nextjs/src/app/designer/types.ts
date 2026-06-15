import type { FormDefinition, Node, LayoutNode, ControlNode } from "@transform/contracts/form-types";
export type DesignerForm = FormDefinition;

export type Selected =
  | { kind: "none" }
  | { kind: "layout"; node: LayoutNode }
  | { kind: "control"; node: ControlNode };

export type NodeKind = "layout" | "control";
export type LayoutKind = LayoutNode["layoutType"];
export type ControlKind = "text" | "number" | "switch" | "dropdown" | "segmented" | "multiselect" | "date" | "signature" | "image" | "file" | "button" | "listview";

export type ToolboxItem =
  | { kind: "layout"; layoutType: LayoutKind }
  | { kind: "control"; controlType: ControlKind };

export function isLayout(n: Node): n is LayoutNode {
  return n.type === "layout";
}

export function isControl(n: Node): n is ControlNode {
  return n.type === "control";
}
