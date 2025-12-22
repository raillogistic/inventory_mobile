import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  loadInventoryScans,
  type InventoryScanRecord,
} from "@/lib/offline/inventory-scan-storage";

/** Identifier for the active sync tab. */
type SyncTabId = "pending" | "synced";

/** Metadata describing a sync tab. */
type SyncTabOption = {
  /** Tab identifier. */
  id: SyncTabId;
  /** Tab label displayed in the UI. */
  label: string;
};

/** Color palette for scan status badges. */
type StatusPalette = {
  /** Border/background color for scanned items. */
  scanned: string;
  /** Border/background color for missing items. */
  missing: string;
  /** Border/background color for other location items. */
  other: string;
};

/** Tabs available on the sync screen. */
const SYNC_TABS: SyncTabOption[] = [
  { id: "pending", label: "A synchroniser" },
  { id: "synced", label: "Synchronises" },
];

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
 * Resolve the best description for a scan item.
 */
function getScanDescription(scan: InventoryScanRecord): string {
  return (
    scan.articleDescription ??
    scan.customDesc ??
    scan.observation ??
    "Description inconnue"
  );
}

/**
 * Screen that lists scans awaiting sync and already synced scans.
 */
export default function ArticlesSyncScreen() {
  const { isScanSyncing, scanSyncError, syncScans } = useInventoryOffline();
  const [activeTab, setActiveTab] = useState<SyncTabId>("pending");
  const [pendingScans, setPendingScans] = useState<InventoryScanRecord[]>([]);
  const [syncedScans, setSyncedScans] = useState<InventoryScanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const borderColor = useThemeColor(
    { light: "#E2E8F0", dark: "#2B2E35" },
    "icon"
  );
  const surfaceColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const tintColor = useThemeColor(
    { light: "#2563EB", dark: "#60A5FA" },
    "tint"
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
  const buttonTextColor = useThemeColor(
    { light: "#FFFFFF", dark: "#0F172A" },
    "text"
  );
  const statusPalette: StatusPalette = useMemo(
    () => ({
      scanned: scannedColor,
      missing: missingColor,
      other: otherColor,
    }),
    [missingColor, otherColor, scannedColor]
  );

  /** Display a toast or alert for sync feedback. */
  const showSyncMessage = useCallback((message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert("Synchronisation", message);
  }, []);

  /** Load scans grouped by sync state. */
  const loadScans = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [pending, synced] = await Promise.all([
        loadInventoryScans({ isSynced: false }),
        loadInventoryScans({ isSynced: true }),
      ]);
      setPendingScans(pending);
      setSyncedScans(synced);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de charger les articles.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadScans();
    }, [loadScans])
  );

  /** Switch between pending and synced tabs. */
  const handleTabChange = useCallback((tab: SyncTabId) => {
    setActiveTab(tab);
  }, []);

  /** Trigger a sync for pending scans. */
  const handleSyncNow = useCallback(async () => {
    if (isScanSyncing) {
      return;
    }

    try {
      const summary = await syncScans();
      await loadScans();

      if (summary.totalCount === 0) {
        showSyncMessage("Aucun article a synchroniser.");
        return;
      }

      if (summary.failedCount === 0) {
        showSyncMessage(`${summary.syncedCount} article(s) synchronises.`);
        return;
      }

      showSyncMessage(
        `${summary.syncedCount}/${summary.totalCount} articles synchronises.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La synchronisation a echoue.";
      showSyncMessage(message);
    }
  }, [isScanSyncing, loadScans, showSyncMessage, syncScans]);

  const activeScans = activeTab === "pending" ? pendingScans : syncedScans;
  const pendingCountLabel = `${pendingScans.length} article(s)`;
  const syncedCountLabel = `${syncedScans.length} article(s)`;

  /** Render a single scan row. */
  const renderItem = useCallback(
    ({ item }: { item: InventoryScanRecord }) => {
      const accentColor =
        item.status === "missing"
          ? statusPalette.missing
          : item.status === "other"
          ? statusPalette.other
          : statusPalette.scanned;
      return (
        <View
          style={[
            styles.scanCard,
            { borderColor: accentColor, backgroundColor: surfaceColor },
          ]}
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
          <View style={styles.scanMeta}>
            <ThemedText type="defaultSemiBold">{item.codeArticle}</ThemedText>
            <ThemedText style={[styles.scanDescription, { color: mutedColor }]}>
              {getScanDescription(item)}
            </ThemedText>
            <View style={styles.scanRow}>
              <View style={[styles.statusBadge, { backgroundColor: accentColor }]}>
                <ThemedText style={styles.statusText}>
                  {item.statusLabel}
                </ThemedText>
              </View>
              <ThemedText style={[styles.scanTimestamp, { color: mutedColor }]}>
                {formatTimestamp(item.capturedAt)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.scanLocation, { color: mutedColor }]}>
              Lieu: {item.locationName}
            </ThemedText>
            <ThemedText style={[styles.scanSync, { color: mutedColor }]}>
              {item.isSynced ? "Synchronise" : "En attente de sync"}
            </ThemedText>
          </View>
        </View>
      );
    },
    [borderColor, mutedColor, statusPalette, surfaceColor]
  );

  /** Render the list header containing tabs and actions. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title">Articles a synchroniser</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: mutedColor }]}>
              {activeTab === "pending" ? pendingCountLabel : syncedCountLabel}
            </ThemedText>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={tintColor} />
          ) : null}
        </View>
        <View
          style={[styles.tabRow, { borderColor, backgroundColor: surfaceColor }]}
        >
          {SYNC_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabButton,
                  isActive
                    ? { backgroundColor: tintColor }
                    : { backgroundColor: "transparent" },
                ]}
                onPress={() => handleTabChange(tab.id)}
              >
                <ThemedText
                  style={[
                    styles.tabButtonText,
                    { color: isActive ? buttonTextColor : mutedColor },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
        {activeTab === "pending" ? (
          <TouchableOpacity
            style={[
              styles.syncNowButton,
              {
                backgroundColor: tintColor,
                opacity: isScanSyncing ? 0.6 : 1,
              },
            ]}
            onPress={handleSyncNow}
            disabled={isScanSyncing}
          >
            <View style={styles.syncNowContent}>
              <IconSymbol
                name="arrow.clockwise"
                size={18}
                color={buttonTextColor}
              />
              <ThemedText
                type="defaultSemiBold"
                style={[styles.syncNowText, { color: buttonTextColor }]}
              >
                {isScanSyncing ? "Synchronisation..." : "Synchroniser maintenant"}
              </ThemedText>
            </View>
          </TouchableOpacity>
        ) : null}
        {loadError ? (
          <View style={styles.errorCard}>
            <ThemedText type="subtitle">Erreur de chargement</ThemedText>
            <ThemedText style={[styles.errorText, { color: mutedColor }]}>
              {loadError}
            </ThemedText>
          </View>
        ) : null}
        {scanSyncError ? (
          <View style={styles.errorCard}>
            <ThemedText type="subtitle">Erreur de synchronisation</ThemedText>
            <ThemedText style={[styles.errorText, { color: mutedColor }]}>
              {scanSyncError}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }, [
    activeTab,
    buttonTextColor,
    handleSyncNow,
    handleTabChange,
    isLoading,
    isScanSyncing,
    loadError,
    mutedColor,
    pendingCountLabel,
    scanSyncError,
    syncedCountLabel,
    tintColor,
    surfaceColor,
    borderColor,
  ]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={activeScans}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">
              {activeTab === "pending"
                ? "Aucun article a synchroniser"
                : "Aucun article synchronise"}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
              {activeTab === "pending"
                ? "Les scans en attente apparaissent ici."
                : "Les articles synchronises apparaissent ici."}
            </ThemedText>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  header: {
    gap: 12,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  syncNowButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  syncNowContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  syncNowText: {
    fontSize: 15,
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
    gap: 4,
    backgroundColor: "rgba(248, 113, 113, 0.12)",
  },
  errorText: {
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  scanCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  thumbnailFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailText: {
    fontSize: 11,
    textAlign: "center",
  },
  scanMeta: {
    flex: 1,
    gap: 4,
  },
  scanDescription: {
    fontSize: 13,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  scanTimestamp: {
    fontSize: 11,
  },
  scanLocation: {
    fontSize: 12,
  },
  scanSync: {
    fontSize: 12,
  },
});
