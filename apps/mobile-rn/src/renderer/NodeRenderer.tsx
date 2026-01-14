import React from "react";

import type { Node } from "@contracts/form-types";

import type { FormState, SetValue } from "./types";

import { LayoutRenderer } from "./LayoutRenderer";
import { ControlRenderer } from "./controls/ControlRenderer";

export type NodeRendererProps = {
  node: Node;
  data: FormState;
  setValue: SetValue;
  errors: Record<string, string>;
};

export function NodeRenderer({ node, data, setValue, errors }: NodeRendererProps) {
  if (node.type === "layout") {
    return (
      <LayoutRenderer
        node={node}
        renderNode={(child) => (
          <NodeRenderer node={child} data={data} setValue={setValue} errors={errors} />
        )}
      />
    );
  }

  return (
    <ControlRenderer node={node} value={data[node.key]} setValue={setValue} error={errors[node.key]} />
  );
}
