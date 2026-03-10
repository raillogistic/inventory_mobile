import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { type RecentScan } from "../types";
import { formatTimestamp } from "../utils";

type RecapCardProps = {
  totalScanCount: number;
  lastScan: RecentScan | null;
};

export function RecapCard({ totalScanCount, lastScan }: RecapCardProps) {
  return (
    <View style={styles.recapCard}>
      <View style={styles.recapRow}>
        <ThemedText style={styles.recapLabel}>Scans enregistres</ThemedText>
        <ThemedText
          type="defaultSemiBold"
          style={{ color: PREMIUM_COLORS.text_primary }}
        >
          {totalScanCount}
        </ThemedText>
      </View>
      {lastScan ? (
        <View style={styles.recapRow}>
          <ThemedText style={styles.recapLabel}>Dernier scan</ThemedText>
          <View style={styles.recapValueColumn}>
            <ThemedText
              type="defaultSemiBold"
              style={{ color: PREMIUM_COLORS.text_primary }}
            >
              {lastScan.code}
            </ThemedText>
            <ThemedText style={styles.recapMeta}>
              {formatTimestamp(lastScan.capturedAt)}
            </ThemedText>
          </View>
        </View>
      ) : (
        <ThemedText style={styles.recapEmpty}>
          Aucun scan enregistre pour l&apos;instant.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  recapCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recapLabel: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  recapValueColumn: {
    alignItems: "flex-end",
    gap: 2,
  },
  recapMeta: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  recapEmpty: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    fontStyle: "italic",
  },
});
