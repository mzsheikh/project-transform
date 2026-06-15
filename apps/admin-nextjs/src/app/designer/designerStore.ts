/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { FormDefinition, Node, LayoutNode, ControlNode } from "@transform/contracts/form-types";

type History = {
  past: FormDefinition[];
  future: FormDefinition[];
};

function deepClone<T>(obj: T): T {
  // ts-ignore
  return typeof structuredClone === "function"
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

function pushHistory(current: FormDefinition, history: History, max = 50): History {
  const past = [...history.past, deepClone(current)];
  if (past.length > max) past.shift();
  return { past, future: [] };
}

function findNodeDeep(
  nodes: Node[],
  id: string
): { parent: LayoutNode | null; index: number; node: Node | null } {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.id === id) return { parent: null, index: i, node: n };
    if (n.type === "layout") {
      const child = findNodeDeep(n.children, id);
      if (child.node) return { parent: n, index: child.index, node: child.node };
    }
  }
  return { parent: null, index: -1, node: null };
}

function findNodeWithParent(
  parent: LayoutNode,
  id: string
): { parent: LayoutNode; index: number; node: Node } | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.id === id) return { parent, index: i, node: child };
    if (child.type === "layout") {
      const found = findNodeWithParent(child, id);
      if (found) return found;
    }
  }
  return null;
}

function updateNodeDeep(nodes: Node[], id: string, updater: (node: Node) => Node): Node[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n);
    if (n.type === "layout") {
      return { ...n, children: updateNodeDeep(n.children, id, updater) };
    }
    return n;
  });
}

function removeNodeDeep(nodes: Node[], id: string): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    if (n.id === id) continue;
    if (n.type === "layout") {
      out.push({ ...n, children: removeNodeDeep(n.children, id) });
    } else {
      out.push(n);
    }
  }
  return out;
}

function insertChildToLayout(nodes: Node[], layoutId: string, child: Node, insertIndex?: number): Node[] {
  return nodes.map((n) => {
    if (n.id === layoutId && n.type === "layout") {
      const children = [...n.children];
      const idx =
        insertIndex == null || insertIndex < 0 || insertIndex >= children.length
          ? children.length
          : insertIndex;
      children.splice(idx, 0, child);
      return { ...n, children };
    }
    if (n.type === "layout") {
      return { ...n, children: insertChildToLayout(n.children, layoutId, child, insertIndex) };
    }
    return n;
  });
}

function insertNodeIntoLayout(parent: LayoutNode, layoutId: string, child: Node, insertIndex: number): LayoutNode {
  if (parent.id === layoutId) {
    const children = [...parent.children];
    const idx = Math.max(0, Math.min(insertIndex, children.length));
    children.splice(idx, 0, child);
    return { ...parent, children };
  }

  return {
    ...parent,
    children: parent.children.map((node) => (
      node.type === "layout" ? insertNodeIntoLayout(node, layoutId, child, insertIndex) : node
    )),
  };
}

function containsNode(node: Node, id: string): boolean {
  if (node.id === id) return true;
  if (node.type === "control") return false;
  return node.children.some((child) => containsNode(child, id));
}

function uid(prefix = "n") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function makeTabPage(label: string): LayoutNode {
  return {
    id: uid("tab"),
    type: "layout",
    layoutType: "tab",
    label,
    children: [],
  };
}

function findLayoutById(node: LayoutNode, id: string): LayoutNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    if (child.type !== "layout") continue;
    const found = findLayoutById(child, id);
    if (found) return found;
  }
  return null;
}

function insertionParentFor(root: LayoutNode, requestedParentId: string, child: Node): string | null {
  const requestedParent = findLayoutById(root, requestedParentId);
  if (!requestedParent) return null;

  if (requestedParent.layoutType === "tabs") {
    if (child.type === "layout" && child.layoutType === "tab") return requestedParent.id;
    const firstTab = requestedParent.children.find(
      (node): node is LayoutNode => node.type === "layout" && node.layoutType === "tab",
    );
    return firstTab?.id ?? null;
  }

  if (child.type === "layout" && child.layoutType === "tab") return null;
  return requestedParent.id;
}

function nextControlKey(root: LayoutNode, controlType: ControlNode["controlType"]) {
  const re = new RegExp(`^${controlType}(\\d+)$`);
  let max = 0;

  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.type === "control") {
        const m = re.exec(n.key);
        if (m) {
          const num = Number(m[1]);
          if (Number.isFinite(num) && num > max) max = num;
        }
      } else {
        walk(n.children);
      }
    }
  };

  walk(root.children);
  return `${controlType}${max + 1}`;
}

function nextLayoutKey(root: LayoutNode, layoutType: LayoutNode["layoutType"]) {
  const re = new RegExp(`^${layoutType}(\\d+)$`);
  let max = 0;

  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.type === "layout") {
        if (n.key) {
          const m = re.exec(n.key);
          if (m) {
            const num = Number(m[1]);
            if (Number.isFinite(num) && num > max) max = num;
          }
        }
        walk(n.children);
      }
    }
  };

  walk(root.children);
  return `${layoutType}${max + 1}`;
}

function collectControlKeys(nodes: Node[], keys = new Set<string>()) {
  for (const node of nodes) {
    if (node.type === "control") {
      keys.add(node.key);
    } else {
      collectControlKeys(node.children, keys);
    }
  }
  return keys;
}

function nextAvailableControlKey(usedKeys: Set<string>, controlType: ControlNode["controlType"]) {
  let i = 1;
  let key = `${controlType}${i}`;
  while (usedKeys.has(key)) {
    i += 1;
    key = `${controlType}${i}`;
  }
  usedKeys.add(key);
  return key;
}

function cloneNodeForDuplicate(node: Node, usedKeys: Set<string>): Node {
  if (node.type === "control") {
    return {
      ...deepClone(node),
      id: uid("ctrl"),
      key: nextAvailableControlKey(usedKeys, node.controlType),
    };
  }

  const children = node.children.map((child) => cloneNodeForDuplicate(child, usedKeys));
  return {
    ...deepClone(node),
    id: uid("layout"),
    ...(node.layoutType === "tabs"
      ? { props: { ...(node.props ?? {}), defaultTabId: children[0]?.id } }
      : {}),
    children,
  };
}

export type DesignerState = {
  schema: FormDefinition | null;
  selectedId: string | null;
  dirty: boolean;
  lastSavedAt: number | null;
  history: History;

  init: (schema: FormDefinition) => void;
  select: (id: string | null) => void;

  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  updateNode: (id: string, patch: Partial<LayoutNode> | Partial<ControlNode>) => void;
  updateSchema: (patch: Partial<FormDefinition>) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, parentLayoutId: string, insertIndex: number) => void;
  duplicateNode: (id: string) => void;
  addLayout: (
    parentLayoutId: string,
    layoutType: LayoutNode["layoutType"],
    insertIndex?: number
  ) => void;
  addControl: (
    parentLayoutId: string,
    controlType: ControlNode["controlType"],
    insertIndex?: number
  ) => void;

  getSelectedNode: () => Node | null;
};

export const useDesignerStore = create<DesignerState>((set, get) => ({
  schema: null,
  selectedId: null,
  dirty: false,
  lastSavedAt: null,
  history: { past: [], future: [] },

  init: (schema) =>
    set({
      schema: deepClone(schema),
      selectedId: null,
      dirty: false,
      lastSavedAt: null,
      history: { past: [], future: [] },
    }),

  select: (id) => set({ selectedId: id }),

  markSaved: () => set({ dirty: false, lastSavedAt: Date.now() }),

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  undo: () => {
    const { schema, history } = get();
    if (!schema || history.past.length === 0) return;

    const prev = history.past[history.past.length - 1];
    set({
      schema: deepClone(prev),
      history: {
        past: history.past.slice(0, -1),
        future: [deepClone(schema), ...history.future],
      },
      dirty: true,
    });
  },

  redo: () => {
    const { schema, history } = get();
    if (!schema || history.future.length === 0) return;

    const next = history.future[0];
    set({
      schema: deepClone(next),
      history: {
        past: [...history.past, deepClone(schema)],
        future: history.future.slice(1),
      },
      dirty: true,
    });
  },

  updateNode: (id, patch) => {
    const cur = get().schema;
    if (!cur) return;

    const next: FormDefinition = {
      ...cur,
      root: {
        ...cur.root,
        children: updateNodeDeep(cur.root.children, id, (n) => ({ ...n, ...patch } as Node)),
      },
    };

    set((state) => ({
      schema: next,
      history: pushHistory(cur, state.history),
      dirty: true,
    }));
  },

  updateSchema: (patch) => {
    const cur = get().schema;
    if (!cur) return;
    const next: FormDefinition = { ...cur, ...patch };
    set((state) => ({
      schema: next,
      history: pushHistory(cur, state.history),
      dirty: true,
    }));
  },

  removeNode: (id) => {
    const cur = get().schema;
    if (!cur) return;
    const found = findNodeWithParent(cur.root, id);
    if (
      found?.node.type === "layout" &&
      found.node.layoutType === "tab" &&
      found.parent.layoutType === "tabs"
    ) {
      const tabCount = found.parent.children.filter(
        (child) => child.type === "layout" && child.layoutType === "tab",
      ).length;
      if (tabCount <= 1) return;
    }

    let nextRoot: LayoutNode = {
      ...cur.root,
      children: removeNodeDeep(cur.root.children, id),
    };
    if (
      found?.node.type === "layout" &&
      found.node.layoutType === "tab" &&
      found.parent.layoutType === "tabs" &&
      (found.parent.props as Record<string, unknown> | undefined)?.defaultTabId === id
    ) {
      const nextDefaultTab = found.parent.children.find(
        (child) => child.id !== id && child.type === "layout" && child.layoutType === "tab",
      );
      nextRoot = {
        ...nextRoot,
        children: updateNodeDeep(nextRoot.children, found.parent.id, (node) => (
          node.type === "layout"
            ? { ...node, props: { ...(node.props ?? {}), defaultTabId: nextDefaultTab?.id } }
            : node
        )),
      };
    }

    const next: FormDefinition = {
      ...cur,
      root: nextRoot,
    };

    set((state) => ({
      schema: next,
      history: pushHistory(cur, state.history),
      dirty: true,
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },

  moveNode: (id, parentLayoutId, insertIndex) => {
    const cur = get().schema;
    if (!cur || id === cur.root.id) return;

    const found = findNodeWithParent(cur.root, id);
    if (!found) return;
    const resolvedParentLayoutId = insertionParentFor(cur.root, parentLayoutId, found.node);
    if (!resolvedParentLayoutId) return;
    if (found.node.type === "layout" && containsNode(found.node, resolvedParentLayoutId)) return;

    const adjustedIndex =
      found.parent.id === resolvedParentLayoutId && found.index < insertIndex
        ? insertIndex - 1
        : insertIndex;

    const withoutMoved: FormDefinition = {
      ...cur,
      root: {
        ...cur.root,
        children: removeNodeDeep(cur.root.children, id),
      },
    };
    const nextRoot = insertNodeIntoLayout(withoutMoved.root, resolvedParentLayoutId, found.node, adjustedIndex);

    set((state) => ({
      schema: { ...cur, root: nextRoot },
      history: pushHistory(cur, state.history),
      dirty: true,
      selectedId: id,
    }));
  },

  duplicateNode: (id) => {
    const cur = get().schema;
    if (!cur || id === cur.root.id) return;

    const found = findNodeWithParent(cur.root, id);
    if (!found) return;

    const usedKeys = collectControlKeys(cur.root.children);
    const duplicate = cloneNodeForDuplicate(found.node, usedKeys);
    const nextRoot =
      found.parent.id === cur.root.id
        ? {
            ...cur.root,
            children: (() => {
              const children = [...cur.root.children];
              children.splice(found.index + 1, 0, duplicate);
              return children;
            })(),
          }
        : {
            ...cur.root,
            children: updateNodeDeep(cur.root.children, found.parent.id, (node) => {
              if (node.type !== "layout") return node;
              const children = [...node.children];
              children.splice(found.index + 1, 0, duplicate);
              return { ...node, children };
            }),
          };

    set((state) => ({
      schema: { ...cur, root: nextRoot },
      history: pushHistory(cur, state.history),
      dirty: true,
      selectedId: duplicate.id,
    }));
  },

  addLayout: (parentLayoutId, layoutType, insertIndex) => {
    const cur = get().schema;
    if (!cur) return;

    const newLayout: LayoutNode = {
      id: uid("layout"),
      type: "layout",
      layoutType,
      label: layoutType === "repeater" ? "Repeat Section" : layoutType === "tabs" ? "Tabs" : layoutType,
      ...(layoutType === "repeater"
        ? {
            key: nextLayoutKey(cur.root, layoutType),
            props: { minItems: 0, defaultItems: 1 },
          }
        : {}),
      ...(layoutType === "tabs"
        ? {
            children: [makeTabPage("Tab 1"), makeTabPage("Tab 2")],
          }
        : { children: [] }),
    };
    if (layoutType === "tabs") {
      newLayout.props = { defaultTabId: newLayout.children[0]?.id };
    }
    const resolvedParentLayoutId = insertionParentFor(cur.root, parentLayoutId, newLayout);
    if (!resolvedParentLayoutId) return;

    const nextRoot: LayoutNode =
      cur.root.id === resolvedParentLayoutId
        ? {
            ...cur.root,
            children: (() => {
              const children = [...cur.root.children];
              const idx =
                insertIndex == null || insertIndex < 0 || insertIndex >= children.length
                  ? children.length
                  : insertIndex;
              children.splice(idx, 0, newLayout);
              return children;
            })(),
          }
        : {
            ...cur.root,
            children: insertChildToLayout(cur.root.children, resolvedParentLayoutId, newLayout, insertIndex),
          };

    const next: FormDefinition = {
      ...cur,
      root: nextRoot,
    };

    set((state) => ({
      schema: next,
      history: pushHistory(cur, state.history),
      dirty: true,
      selectedId: newLayout.id,
    }));
  },

  addControl: (parentLayoutId, controlType, insertIndex) => {
    const cur = get().schema;
    if (!cur) return;

    const newControl: ControlNode = {
      id: uid("ctrl"),
      type: "control",
      controlType,
      key: nextControlKey(cur.root, controlType),
      label: controlType,
      props: {},
    };

    if (controlType === "dropdown" || controlType === "segmented" || controlType === "multiselect") {
      newControl.props = {
        options: [
          { label: "Option A", value: "a" },
          { label: "Option B", value: "b" },
        ],
      };
    }

    if (controlType === "button") {
      newControl.label = "Button";
      newControl.props = {
        text: "Button",
        variant: "primary",
        actions: [],
      };
    }

    if (controlType === "listview") {
      newControl.label = "List View";
      newControl.props = {
        data: "=DATA(\"\")",
        keyField: "id",
        title: "=TEXT(ITEM(\"name\"))",
        subtitle: "",
        description: "",
        emptyText: "No records found",
        actions: [],
      };
    }
    const resolvedParentLayoutId = insertionParentFor(cur.root, parentLayoutId, newControl);
    if (!resolvedParentLayoutId) return;

    const nextRoot: LayoutNode =
      cur.root.id === resolvedParentLayoutId
        ? {
            ...cur.root,
            children: (() => {
              const children = [...cur.root.children];
              const idx =
                insertIndex == null || insertIndex < 0 || insertIndex >= children.length
                  ? children.length
                  : insertIndex;
              children.splice(idx, 0, newControl);
              return children;
            })(),
          }
        : {
            ...cur.root,
            children: insertChildToLayout(cur.root.children, resolvedParentLayoutId, newControl, insertIndex),
          };

    const next: FormDefinition = {
      ...cur,
      root: nextRoot,
    };

    set((state) => ({
      schema: next,
      history: pushHistory(cur, state.history),
      dirty: true,
      selectedId: newControl.id,
    }));
  },

  getSelectedNode: () => {
    const { schema, selectedId } = get();
    if (!schema || !selectedId) return null;
    if (schema.root.id === selectedId) return schema.root;
    const found = findNodeDeep(schema.root.children, selectedId);
    return found.node;
  },
}));
