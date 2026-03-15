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

function addChildToLayout(nodes: Node[], layoutId: string, child: Node): Node[] {
  return nodes.map((n) => {
    if (n.id === layoutId && n.type === "layout") {
      return { ...n, children: [...n.children, child] };
    }
    if (n.type === "layout") {
      return { ...n, children: addChildToLayout(n.children, layoutId, child) };
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
  addLayout: (parentLayoutId: string, layoutType: LayoutNode["layoutType"]) => void;
  addControl: (parentLayoutId: string, controlType: ControlNode["controlType"]) => void;

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

  addLayout: (parentLayoutId, layoutType) => {
    const cur = get().schema;
    if (!cur) return;

    const newLayout: LayoutNode = {
      id: uid("layout"),
      type: "layout",
      layoutType,
      label: layoutType,
      children: [],
    };

    const nextRoot: LayoutNode =
      cur.root.id === parentLayoutId
        ? { ...cur.root, children: [...cur.root.children, newLayout] }
        : { ...cur.root, children: addChildToLayout(cur.root.children, parentLayoutId, newLayout) };

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

  addControl: (parentLayoutId, controlType) => {
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

    const nextRoot: LayoutNode =
      cur.root.id === parentLayoutId
        ? { ...cur.root, children: [...cur.root.children, newControl] }
        : { ...cur.root, children: addChildToLayout(cur.root.children, parentLayoutId, newControl) };

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
