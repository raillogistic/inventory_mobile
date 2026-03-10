import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { SCAN_LIST_TABS } from "../constants";
import { type ScanListTab } from "../types";

type ScanTabsProps = {
  activeTab: ScanListTab;
  onTabChange: (tab: ScanListTab) => void;
  scannedCountLabel: string;
  articleCountLabel: string;
};

export function ScanTabs({
  activeTab,
  onTabChange,
  scannedCountLabel,
  articleCountLabel,
}: ScanTabsProps) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <ThemedText
          type="subtitle"
          style={{ color: PREMIUM_COLORS.text_primary }}
        >
          {activeTab === "scanned" ? "Articles scannes" : "Articles du lieu"}
        </ThemedText>
        <ThemedText style={styles.sectionMeta}>
          {activeTab === "scanned" ? scannedCountLabel : articleCountLabel}
        </ThemedText>
      </View>
      <View style={styles.tabRow}>
        {SCAN_LIST_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabButton,
                isActive && {
                  backgroundColor: PREMIUM_COLORS.accent_primary,
                },
              ]}
              onPress={() => onTabChange(tab.id)}
            >
              <ThemedText
                style={[
                  styles.tabButtonText,
                  {
                    color: isActive
                      ? PREMIUM_COLORS.text_primary
                      : PREMIUM_COLORS.text_muted,
                  },
                ]}
              >
                {tab.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionMeta: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 999,
    padding: 4,
    marginTop: 12,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_muted,
  },
});
