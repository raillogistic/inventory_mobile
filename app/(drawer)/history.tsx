import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  getScanHistory,
  type ScanHistoryItem,
} from "@/lib/storage/scan-history";

/** Color palette for scan status badges. */
type StatusPalette = {
  /** Border/background color for scanned items. */
  scanned: string;
  /** Border/background color for missing items. */
  missing: string;
  /** Border/background color for other location items. */
  other: string;
};

/**
 * Format a timestamp for display in French locale.
 */
function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * History screen that lists locally stored scans with images.
 */
export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState<ScanHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ScanHistoryItem | null>(null);
  const borderColor = useThemeColor(
    { light: "#E2E8F0", dark: "#2B2E35" },
    "icon"
  );
  const surfaceColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const mutedColor = useThemeColor(
    { light: "#64748B", dark: "#94A3B8" },
    "icon"
  );
  const scannedColor = useThemeColor(
    { light: "#16A34A", dark: "#22C55E" },
    "tint"
  );
  const missingColor = useThemeColor(
    { light: "#DC2626", dark: "#B91C1C" },
    "tint"
  );
  const otherColor = useThemeColor(
    { light: "#FBBF24", dark: "#F59E0B" },
    "tint"
  );
  const statusPalette: StatusPalette = useMemo(
    () => ({
      scanned: scannedColor,
      missing: missingColor,
      other: otherColor,
    }),
    [missingColor, otherColor, scannedColor]
  );

  /** Load history data when the screen gains focus. */
  const loadHistory = useCallback(async () => {
    const items = await getScanHistory();
    setHistoryItems(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  /** Render a single history row. */
  const renderItem = useCallback(
    ({ item }: { item: ScanHistoryItem }) => {
      const accentColor =
        item.status === "missing"
          ? statusPalette.missing
          : item.status === "other"
          ? statusPalette.other
          : statusPalette.scanned;
      return (
        <TouchableOpacity
          style={[
            styles.historyCard,
            { borderColor: accentColor, backgroundColor: surfaceColor },
          ]}
          onPress={() => setSelectedItem(item)}
        >
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
          ) : (
            <View
              style={[
                styles.thumbnailFallback,
                { borderColor, backgroundColor: surfaceColor },
              ]}
            >
              <ThemedText style={[styles.thumbnailText, { color: mutedColor }]}>
                Sans image
              </ThemedText>
            </View>
          )}
          <View style={styles.historyMeta}>
            <ThemedText type="defaultSemiBold">{item.code}</ThemedText>
            <ThemedText style={[styles.historyDescription, { color: mutedColor }]}>
              {item.description ?? "Description inconnue"}
            </ThemedText>
            <View style={styles.historyRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: accentColor },
                ]}
              >
                <ThemedText style={styles.statusText}>
                  {item.statusLabel}
                </ThemedText>
              </View>
              <ThemedText style={[styles.historyTimestamp, { color: mutedColor }]}>
                {formatTimestamp(item.capturedAt)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.historyLocation, { color: mutedColor }]}>
              Lieu: {item.locationName}
            </ThemedText>
          </View>
        </TouchableOpacity>
      );
    },
    [borderColor, mutedColor, statusPalette, surfaceColor]
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={historyItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">Aucun scan sauvegarde</ThemedText>
            <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
              Effectuez un scan pour alimenter l'historique.
            </ThemedText>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <Modal
        transparent
        visible={Boolean(selectedItem)}
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          {selectedItem ? (
            <View style={[styles.modalCard, { backgroundColor: surfaceColor }]}>
              {selectedItem.imageUri ? (
                <Image
                  source={{ uri: selectedItem.imageUri }}
                  style={styles.modalImage}
                />
              ) : (
                <View style={styles.modalImageFallback}>
                  <ThemedText style={{ color: mutedColor }}>
                    Aucune image disponible
                  </ThemedText>
                </View>
              )}
              <View style={styles.modalMeta}>
                <ThemedText type="subtitle">{selectedItem.code}</ThemedText>
                <ThemedText style={{ color: mutedColor }}>
                  {selectedItem.description ?? "Description inconnue"}
                </ThemedText>
                <ThemedText style={{ color: mutedColor }}>
                  {formatTimestamp(selectedItem.capturedAt)}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setSelectedItem(null)}
              >
                <ThemedText style={styles.modalButtonText}>Fermer</ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  thumbnailFallback: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  thumbnailText: {
    fontSize: 12,
    textAlign: "center",
  },
  historyMeta: {
    flex: 1,
    gap: 4,
  },
  historyDescription: {
    fontSize: 13,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  historyTimestamp: {
    fontSize: 12,
  },
  historyLocation: {
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  modalImage: {
    width: "100%",
    height: 240,
    borderRadius: 16,
  },
  modalImageFallback: {
    width: "100%",
    height: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  modalMeta: {
    gap: 6,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
