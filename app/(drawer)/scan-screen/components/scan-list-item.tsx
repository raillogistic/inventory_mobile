import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { type LocationArticleItem, type ScanListTab } from "../types";

type ScanListItemProps = {
  item: LocationArticleItem;
  activeTab: ScanListTab;
};

export const ScanListItem = memo(function ScanListItem({
  item,
  activeTab,
}: ScanListItemProps) {
  const isMissing = item.status === "missing";
  const isOtherLocation = item.status === "other";
  const isScanned = item.status === "scanned";

  // Premium status-based colors
  const cardBorderColor = isMissing
    ? PREMIUM_COLORS.error
    : isOtherLocation
    ? PREMIUM_COLORS.warning
    : isScanned
    ? PREMIUM_COLORS.success
    : PREMIUM_COLORS.glass_border;
  const cardBackgroundColor = isMissing
    ? "rgba(239, 68, 68, 0.15)"
    : isOtherLocation
    ? "rgba(245, 158, 11, 0.15)"
    : isScanned
    ? "rgba(16, 185, 129, 0.15)"
    : PREMIUM_COLORS.glass_bg;
  const primaryTextColor = isMissing
    ? "#FCA5A5"
    : isOtherLocation
    ? "#FCD34D"
    : isScanned
    ? "#6EE7B7"
    : PREMIUM_COLORS.text_primary;
  const secondaryTextColor = isMissing
    ? "#FCA5A5"
    : isOtherLocation
    ? "#FCD34D"
    : isScanned
    ? "#6EE7B7"
    : PREMIUM_COLORS.text_muted;

  return (
    <View
      style={[
        styles.recentCard,
        {
          borderColor: cardBorderColor,
          backgroundColor: cardBackgroundColor,
        },
      ]}
    >
      <ThemedText type="defaultSemiBold" style={{ color: primaryTextColor }}>
        {item.code}
      </ThemedText>
      {item.description ? (
        <ThemedText
          style={[styles.recentDescription, { color: secondaryTextColor }]}
        >
          {item.description}
        </ThemedText>
      ) : null}
      {activeTab === "scanned" ? (
        <>
          <ThemedText
            style={[styles.recentMeta, { color: secondaryTextColor }]}
          >
            Ancien lieu: {item.previousLocationName ?? "Inconnu"}
          </ThemedText>
          <ThemedText
            style={[styles.recentMeta, { color: secondaryTextColor }]}
          >
            Nouveau lieu: {item.nextLocationName ?? "Lieu inconnu"}
          </ThemedText>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  recentCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  recentDescription: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    lineHeight: 20,
  },
  recentMeta: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 2,
  },
});
