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

function uid(prefix = "n") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
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

  return {
    ...deepClone(node),
    id: uid("layout"),
    children: node.children.map((child) => cloneNodeForDuplicate(child, usedKeys)),
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
  removeNode: (id: string) => void;
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

  removeNode: (id) => {
    const cur = get().schema;
    if (!cur) return;

    const next: FormDefinition = {
      ...cur,
      root: {
        ...cur.root,
        children: removeNodeDeep(cur.root.children, id),
      },
    };

    set((state) => ({
      schema: next,
      history: pushHistory(cur, state.history),
      dirty: true,
      selectedId: state.selectedId === id ? null : state.selectedId,
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
      label: layoutType,
      ...(layoutType === "repeater"
        ? {
            key: nextLayoutKey(cur.root, layoutType),
            label: "Repeat Section",
            props: { minItems: 0, defaultItems: 1 },
          }
        : {}),
      children: [],
    };

    const nextRoot: LayoutNode =
      cur.root.id === parentLayoutId
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
            children: insertChildToLayout(cur.root.children, parentLayoutId, newLayout, insertIndex),
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

    if (controlType === "button") {
      newControl.label = "Button";
      newControl.props = {
        text: "Button",
        variant: "primary",
        actions: [{ id: uid("action"), type: "submit", clearDraftOnSuccess: true }],
      };
    }

    const nextRoot: LayoutNode =
      cur.root.id === parentLayoutId
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
            children: insertChildToLayout(cur.root.children, parentLayoutId, newControl, insertIndex),
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
