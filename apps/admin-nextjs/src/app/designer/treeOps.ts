import type { Node, LayoutNode, ControlNode } from "@transform/contracts/form-types";
import { isLayout, isControl } from "./types";

export function uuidLike(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function findNode(root: LayoutNode, id: string): Node | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    if (child.id === id) return child;
    if (child.type === "layout") {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function updateNode(root: LayoutNode, id: string, updater: (n: Node) => Node): LayoutNode {
  if (root.id === id) return updater(root) as LayoutNode;

  return {
    ...root,
    children: root.children.map((c) => {
      if (c.id === id) return updater(c);
      if (c.type === "layout") return updateNode(c, id, updater);
      return c;
    }),
  };
}

export function removeNode(root: LayoutNode, id: string): LayoutNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((c) => (c.type === "layout" ? removeNode(c, id) : c)),
  };
}

export function addChild(parent: LayoutNode, child: Node): LayoutNode {
  return { ...parent, children: [...parent.children, child] };
}

export function makeLayout(layoutType: "stack" | "row" | "section"): LayoutNode {
  return {
    type: "layout",
    layoutType,
    id: uuidLike(),
    ...(layoutType === "section" ? { label: "Section" } : {}),
    children: [],
  } as any;
}

export function makeControl(controlType: any): ControlNode {
  const base: ControlNode = {
    type: "control",
    controlType,
    id: uuidLike(),
    key: `${controlType}_${Math.random().toString(16).slice(2, 8)}`,
    label: controlType[0].toUpperCase() + controlType.slice(1),
    props: {},
    validation: {},
  } as any;

  if (controlType === "dropdown" || controlType === "multiselect") {
    (base.props as any).options = [
      { label: "Option A", value: "a" },
      { label: "Option B", value: "b" },
    ];
  }

  if (controlType === "text") (base.props as any).placeholder = "Enter text";

  return base;
}

/**
 * Insert a new node under a layout node (by id)
 */
export function insertUnder(root: LayoutNode, parentId: string, node: Node): LayoutNode {
  if (root.id === parentId) return addChild(root, node);

  return {
    ...root,
    children: root.children.map((c) => {
      if (c.type === "layout") return insertUnder(c, parentId, node);
      return c;
    }),
  };
}

/**
 * Enforce unique control keys (simple approach)
 */
export function collectControlKeys(root: LayoutNode): Set<string> {
  const keys = new Set<string>();
  walk(root);
  return keys;

  function walk(n: Node) {
    if (isControl(n)) keys.add(n.key);
    if (isLayout(n)) n.children.forEach(walk);
  }
}