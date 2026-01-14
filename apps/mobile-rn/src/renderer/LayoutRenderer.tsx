import React from "react";
import { View, Text } from "react-native";

import type { LayoutNode, Node } from "@contracts/form-types";

import { styles } from "./renderer-styles";

export type LayoutRendererProps = {
  node: LayoutNode;
  renderNode: (node: Node) => React.ReactNode;
};

export function LayoutRenderer({ node, renderNode }: LayoutRendererProps) {
  const layoutType = node.layoutType;

  if (layoutType === "section") {
    return (
      <View style={styles.section}>
        {node.label ? <Text style={styles.sectionTitle}>{node.label}</Text> : null}
        <View style={styles.sectionBody}>
          {node.children.map((child) => (
            <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  if (layoutType === "row") {
    return (
      <View style={styles.row}>
        {node.children.map((child) => (
          <View key={child.id} style={styles.rowItem}>
            {renderNode(child)}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {node.children.map((child) => (
        <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
      ))}
    </View>
  );
}
