import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View, Text } from "react-native";

import type { LayoutNode, Node, TabsProps } from "@transform/contracts/form-types";

import { styles } from "./renderer-styles";

export type LayoutRendererProps = {
  node: LayoutNode;
  renderNode: (node: Node) => React.ReactNode;
};

export function LayoutRenderer({ node, renderNode }: LayoutRendererProps) {
  const layoutType = node.layoutType;

  if (layoutType === "tabs") {
    return <TabsLayoutRenderer node={node} renderNode={renderNode} />;
  }

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

function TabsLayoutRenderer({ node, renderNode }: LayoutRendererProps) {
  const tabs = useMemo(
    () => node.children.filter((child): child is LayoutNode => child.type === "layout" && child.layoutType === "tab"),
    [node.children],
  );
  const tabsProps = node.props as TabsProps | undefined;
  const configuredDefault = typeof tabsProps?.defaultTabId === "string" ? tabsProps.defaultTabId : undefined;
  const initialTabId = tabs.some((tab) => tab.id === configuredDefault) ? configuredDefault : tabs[0]?.id;
  const [activeTabId, setActiveTabId] = useState<string | undefined>(initialTabId);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTabId)) setActiveTabId(initialTabId);
  }, [activeTabId, initialTabId, tabs]);

  if (!activeTab) return null;

  return (
    <View style={styles.tabsLayout}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {tabs.map((tab) => {
          const active = tab.id === activeTab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabButton, active ? styles.tabButtonActive : null]}
              onPress={() => setActiveTabId(tab.id)}
            >
              <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>
                {tab.label || "Tab"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.tabContent}>
        {activeTab.children.map((child) => (
          <React.Fragment key={child.id}>{renderNode(child)}</React.Fragment>
        ))}
      </View>
    </View>
  );
}
