/**
 * @fileoverview Écran de synchronisation des articles avec design premium.
 * Affiche les scans en attente de synchronisation et les scans synchronisés.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
} from "@/components/ui/premium-theme";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import {
  loadInventoryScans,
  type InventoryScanRecord,
} from "@/lib/offline/inventory-scan-storage";

/** Identifiant de l'onglet actif */
type SyncTabId = "pending" | "synced";

/** Métadonnées décrivant un onglet */
type SyncTabOption = {
  /** Identifiant de l'onglet */
  id: SyncTabId;
  /** Label affiché dans l'UI */
  label: string;
  /** Icône SF Symbol */
  icon: string;
};

/** Onglets disponibles */
const SYNC_TABS: SyncTabOption[] = [
  { id: "pending", label: "En attente", icon: "clock.arrow.circlepath" },
  { id: "synced", label: "Synchronisés", icon: "checkmark.circle.fill" },
];

/**
 * Formate un timestamp pour l'affichage en français.
 * @param value - Valeur timestamp ISO
 * @returns Date formatée
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
 * Récupère la meilleure description pour un scan.
 * @param scan - Enregistrement de scan
 * @returns Description
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
 * Retourne la couleur selon le statut du scan.
 * @param status - Statut du scan
 * @returns Couleur d'accent
 */
function getStatusColor(status: string | undefined): string {
  switch (status) {
    case "missing":
      return PREMIUM_COLORS.error;
    case "other":
      return PREMIUM_COLORS.warning;
    default:
      return PREMIUM_COLORS.success;
  }
}

/**
 * Écran de synchronisation des articles avec design premium.
 */
export default function ArticlesSyncScreen() {
  const {
    isScanSyncing,
    scanSyncError,
    syncScanById,
    syncScanImageById,
    syncScans,
  } = useInventoryOffline();
  const [activeTab, setActiveTab] = useState<SyncTabId>("pending");
  const [pendingScans, setPendingScans] = useState<InventoryScanRecord[]>([]);
  const [syncedScans, setSyncedScans] = useState<InventoryScanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Local scan id currently syncing. */
  const [syncingScanId, setSyncingScanId] = useState<string | null>(null);

  /** Affiche un toast ou une alerte pour le feedback. */
  const showSyncMessage = useCallback((message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert("Synchronisation", message);
  }, [
    handleSyncItem,
    handleSyncItemImageOnly,
    handleSyncItemNoImage,
    isScanSyncing,
    syncingScanId,
  ]);

  /** Charge les scans groupés par état de sync. */
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
  }, [handleSyncItem, isScanSyncing, syncingScanId]);

  useFocusEffect(
    useCallback(() => {
      void loadScans();
    }, [loadScans])
  );

  /** Change d'onglet. */
  const handleTabChange = useCallback((tab: SyncTabId) => {
    setActiveTab(tab);
  }, []);

  /** Lance la synchronisation. */
  const handleSyncNow = useCallback(async () => {
    if (isScanSyncing) {
      return;
    }

    try {
      const summary = await syncScans();
      await loadScans();

      if (summary.totalCount === 0) {
        showSyncMessage("Aucun article à synchroniser.");
        return;
      }

      if (summary.failedCount === 0) {
        showSyncMessage(`${summary.syncedCount} article(s) synchronisé(s).`);
        return;
      }

      const errorSummary =
        summary.errors && summary.errors.length > 0
          ? ` (${summary.errors.slice(0, 2).join(" | ")}${
              summary.errors.length > 2 ? " +..." : ""
            })`
          : "";
      showSyncMessage(
        `${summary.syncedCount}/${summary.totalCount} articles synchronisés.${errorSummary}`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "La synchronisation a échoué.";
      showSyncMessage(message);
    }
  }, [isScanSyncing, loadScans, showSyncMessage, syncScans]);

  /**
   * Sync a single scan record by id.
   * @param scanId - Scan identifier.
   */
  const handleSyncItem = useCallback(
    async (scanId: string) => {
      if (isScanSyncing) {
        return;
      }

      setSyncingScanId(scanId);

      try {
        const summary = await syncScanById(scanId);
        await loadScans();

        if (summary.totalCount === 0) {
          showSyncMessage("Aucun article a synchroniser.");
          return;
        }

        if (summary.failedCount === 0) {
          showSyncMessage("Article synchronise.");
          return;
        }

        const errorSummary =
          summary.errors && summary.errors.length > 0
            ? ` (${summary.errors.slice(0, 1).join(" | ")})`
            : "";
        showSyncMessage(
          `${summary.syncedCount}/${summary.totalCount} article synchronise.${errorSummary}`
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "La synchronisation a echoue.";
        showSyncMessage(message);
      } finally {
        setSyncingScanId(null);
      }
    },
    [isScanSyncing, loadScans, showSyncMessage, syncScanById]
  );

  /**
   * Sync a single scan record without its image payload.
   * @param scanId - Scan identifier.
   */
  const handleSyncItemNoImage = useCallback(
    async (scanId: string) => {
      if (isScanSyncing) {
        return;
      }

      setSyncingScanId(scanId);

      try {
        const summary = await syncScanById(scanId, { includeImages: false });
        await loadScans();

        if (summary.totalCount === 0) {
          showSyncMessage("Aucun article a synchroniser.");
          return;
        }

        if (summary.failedCount === 0) {
          showSyncMessage("Article synchronise sans image.");
          return;
        }

        const errorSummary =
          summary.errors && summary.errors.length > 0
            ? ` (${summary.errors.slice(0, 1).join(" | ")})`
            : "";
        showSyncMessage(
          `${summary.syncedCount}/${summary.totalCount} article synchronise sans image.${errorSummary}`
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "La synchronisation a echoue.";
        showSyncMessage(message);
      } finally {
        setSyncingScanId(null);
      }
    },
    [isScanSyncing, loadScans, showSyncMessage, syncScanById]
  );

  /**
   * Sync only the image for a previously synced scan.
   * @param scanId - Scan identifier.
   */
  const handleSyncItemImageOnly = useCallback(
    async (scanId: string) => {
      if (isScanSyncing) {
        return;
      }

      setSyncingScanId(scanId);

      try {
        const summary = await syncScanImageById(scanId);
        await loadScans();

        if (summary.totalCount === 0) {
          showSyncMessage("Aucun article a synchroniser.");
          return;
        }

        if (summary.failedCount === 0) {
          showSyncMessage("Image synchronisee.");
          return;
        }

        const errorSummary =
          summary.errors && summary.errors.length > 0
            ? ` (${summary.errors.slice(0, 1).join(" | ")})`
            : "";
        showSyncMessage(
          `${summary.syncedCount}/${summary.totalCount} image synchronisee.${errorSummary}`
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "La synchronisation a echoue.";
        showSyncMessage(message);
      } finally {
        setSyncingScanId(null);
      }
    },
    [isScanSyncing, loadScans, showSyncMessage, syncScanImageById]
  );

  const activeScans = activeTab === "pending" ? pendingScans : syncedScans;

  /** Rend une ligne de scan. */
  const renderItem = useCallback(({ item }: { item: InventoryScanRecord }) => {
    const accentColor = getStatusColor(item.status);
    const isItemSyncing = syncingScanId === item.id && isScanSyncing;
    return (
      <View style={styles.scan_card}>
        {/* Barre d'accent */}
        <View
          style={[styles.card_accent_bar, { backgroundColor: accentColor }]}
        />

        <View style={styles.card_content}>
          {/* Thumbnail */}
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnail_fallback}>
              <IconSymbol
                name="photo"
                size={20}
                color={PREMIUM_COLORS.text_muted}
              />
            </View>
          )}

          {/* Métadonnées */}
          <View style={styles.meta_container}>
            <Text style={styles.scan_code}>{item.codeArticle}</Text>
            <Text style={styles.scan_description} numberOfLines={1}>
              {getScanDescription(item)}
            </Text>

            <View style={styles.meta_row}>
              <View
                style={[
                  styles.status_badge,
                  { backgroundColor: `${accentColor}20` },
                ]}
              >
                <View
                  style={[styles.status_dot, { backgroundColor: accentColor }]}
                />
                <Text style={[styles.status_text, { color: accentColor }]}>
                  {item.statusLabel}
                </Text>
              </View>
              <Text style={styles.timestamp}>
                {formatTimestamp(item.capturedAt)}
              </Text>
            </View>

            <View style={styles.location_row}>
              <IconSymbol
                name="mappin"
                size={12}
                color={PREMIUM_COLORS.text_muted}
              />
              <Text style={styles.location_text} numberOfLines={1}>
                {item.locationName}
              </Text>
            </View>

            <View style={styles.sync_status_row}>
              <IconSymbol
                name={item.isSynced ? "checkmark.circle.fill" : "clock"}
                size={12}
                color={
                  item.isSynced
                    ? PREMIUM_COLORS.success
                    : PREMIUM_COLORS.text_muted
                }
              />
              <Text
                style={[
                  styles.sync_status_text,
                  {
                    color: item.isSynced
                      ? PREMIUM_COLORS.success
                      : PREMIUM_COLORS.text_muted,
                  },
                ]}
              >
                {item.isSynced ? "Synchronise" : "En attente"}
              </Text>
            </View>
            {!item.isSynced && (
              <View style={styles.item_sync_actions}>
                <TouchableOpacity
                  style={[
                    styles.item_sync_button,
                    isItemSyncing && styles.item_sync_button_disabled,
                  ]}
                  onPress={() => handleSyncItem(item.id)}
                  disabled={isScanSyncing}
                  activeOpacity={0.7}
                >
                  {isItemSyncing ? (
                    <ActivityIndicator
                      size="small"
                      color={PREMIUM_COLORS.accent_primary}
                    />
                  ) : (
                    <IconSymbol
                      name="arrow.clockwise"
                      size={14}
                      color={PREMIUM_COLORS.accent_primary}
                    />
                  )}
                  <Text style={styles.item_sync_button_text}>Sync</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.item_sync_button,
                    styles.item_sync_button_secondary,
                    isItemSyncing && styles.item_sync_button_disabled,
                  ]}
                  onPress={() => handleSyncItemNoImage(item.id)}
                  disabled={isScanSyncing}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name="photo.slash"
                    size={14}
                    color={PREMIUM_COLORS.text_muted}
                  />
                  <Text style={styles.item_sync_button_secondary_text}>
                    Sans image
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {item.isSynced && item.syncedWithoutImage && (
              <View style={styles.item_sync_actions}>
                <TouchableOpacity
                  style={[
                    styles.item_sync_button,
                    isItemSyncing && styles.item_sync_button_disabled,
                  ]}
                  onPress={() => handleSyncItemImageOnly(item.id)}
                  disabled={isScanSyncing}
                  activeOpacity={0.7}
                >
                  {isItemSyncing ? (
                    <ActivityIndicator
                      size="small"
                      color={PREMIUM_COLORS.accent_primary}
                    />
                  ) : (
                    <IconSymbol
                      name="photo"
                      size={14}
                      color={PREMIUM_COLORS.accent_primary}
                    />
                  )}
                  <Text style={styles.item_sync_button_text}>Sync image</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </View>
    );
  }, []);

  /** Rend l'en-tête de la liste. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header_section}>
        <BlurView intensity={20} tint="dark" style={styles.header_blur}>
          <View style={styles.header_card}>
            <View style={styles.header_row}>
              <View style={styles.header_icon}>
                <IconSymbol
                  name="arrow.triangle.2.circlepath"
                  size={24}
                  color={PREMIUM_COLORS.accent_primary}
                />
              </View>
              <View style={styles.header_text}>
                <Text style={styles.header_title}>
                  Articles à synchroniser*
                </Text>
                <Text style={styles.header_subtitle}>
                  {pendingScans.length} en attente • {syncedScans.length}{" "}
                  synchronisés
                </Text>
              </View>
              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color={PREMIUM_COLORS.accent_primary}
                />
              )}
            </View>

            <LinearGradient
              colors={[
                "transparent",
                PREMIUM_COLORS.accent_primary,
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.separator}
            />

            {/* Onglets */}
            <View style={styles.tab_row}>
              {SYNC_TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                const count =
                  tab.id === "pending"
                    ? pendingScans.length
                    : syncedScans.length;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.tab_button,
                      isActive && styles.tab_button_active,
                    ]}
                    onPress={() => handleTabChange(tab.id)}
                    activeOpacity={0.7}
                  >
                    <IconSymbol
                      name={tab.icon as any}
                      size={16}
                      color={
                        isActive
                          ? PREMIUM_COLORS.accent_primary
                          : PREMIUM_COLORS.text_muted
                      }
                    />
                    <Text
                      style={[
                        styles.tab_text,
                        isActive && styles.tab_text_active,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.tab_badge,
                        isActive && styles.tab_badge_active,
                      ]}
                    >
                      <Text style={styles.tab_badge_text}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bouton sync */}
            {activeTab === "pending" && (
              <TouchableOpacity
                style={[
                  styles.sync_button,
                  isScanSyncing && styles.sync_button_disabled,
                ]}
                onPress={handleSyncNow}
                disabled={isScanSyncing}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={
                    isScanSyncing
                      ? [PREMIUM_COLORS.glass_bg, PREMIUM_COLORS.glass_bg]
                      : [
                          PREMIUM_COLORS.accent_primary,
                          PREMIUM_COLORS.accent_secondary,
                        ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sync_button_gradient}
                >
                  <IconSymbol
                    name="arrow.clockwise"
                    size={18}
                    color={PREMIUM_COLORS.text_primary}
                  />
                  <Text style={styles.sync_button_text}>
                    {isScanSyncing
                      ? "Synchronisation..."
                      : "Synchroniser maintenant"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Erreurs */}
            {loadError && (
              <View style={styles.error_container}>
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={18}
                  color={PREMIUM_COLORS.error}
                />
                <View style={styles.error_content}>
                  <Text style={styles.error_title}>Erreur de chargement</Text>
                  <Text style={styles.error_message}>{loadError}</Text>
                </View>
              </View>
            )}

            {scanSyncError && (
              <View style={styles.error_container}>
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={18}
                  color={PREMIUM_COLORS.error}
                />
                <View style={styles.error_content}>
                  <Text style={styles.error_title}>
                    Erreur de synchronisation
                  </Text>
                  <Text style={styles.error_message}>{scanSyncError}</Text>
                </View>
              </View>
            )}
          </View>
        </BlurView>
      </View>
    );
  }, [
    activeTab,
    handleSyncNow,
    handleTabChange,
    isLoading,
    isScanSyncing,
    loadError,
    pendingScans.length,
    scanSyncError,
    syncedScans.length,
  ]);

  /** Rend l'état vide. */
  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.empty_container}>
        <View style={styles.empty_icon}>
          <IconSymbol
            name={activeTab === "pending" ? "tray" : "checkmark.seal.fill"}
            size={40}
            color={
              activeTab === "pending"
                ? PREMIUM_COLORS.text_muted
                : PREMIUM_COLORS.success
            }
          />
        </View>
        <Text style={styles.empty_title}>
          {activeTab === "pending"
            ? "Aucun article à synchroniser"
            : "Aucun article synchronisé"}
        </Text>
        <Text style={styles.empty_subtitle}>
          {activeTab === "pending"
            ? "Les scans en attente apparaissent ici."
            : "Les articles synchronisés apparaissent ici."}
        </Text>
      </View>
    );
  }, [activeTab]);

  /** Key extractor. */
  const keyExtractor = useCallback((item: InventoryScanRecord) => item.id, []);

  return (
    <PremiumScreenWrapper>
      <FlatList
        data={activeScans}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list_content}
        showsVerticalScrollIndicator={false}
      />
    </PremiumScreenWrapper>
  );
}

/**
 * Styles du composant ArticlesSyncScreen.
 */
const styles = StyleSheet.create({
  list_content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
  },
  /* En-tête */
  header_section: {
    marginBottom: 8,
  },
  header_blur: {
    borderRadius: 20,
    overflow: "hidden",
  },
  header_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 20,
    padding: 20,
  },
  header_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  header_icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 107, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  header_text: {
    flex: 1,
  },
  header_title: {
    fontSize: 22,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
    letterSpacing: -0.5,
  },
  header_subtitle: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginVertical: 16,
  },
  /* Onglets */
  tab_row: {
    flexDirection: "row",
    gap: 10,
  },
  tab_button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  tab_button_active: {
    borderColor: PREMIUM_COLORS.accent_primary,
    backgroundColor: "rgba(255, 107, 0, 0.08)",
  },
  tab_text: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_muted,
  },
  tab_text_active: {
    color: PREMIUM_COLORS.accent_primary,
  },
  tab_badge: {
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tab_badge_active: {
    backgroundColor: "rgba(255, 107, 0, 0.2)",
  },
  tab_badge_text: {
    fontSize: 11,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  /* Bouton sync */
  sync_button: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 16,
  },
  sync_button_disabled: {
    opacity: 0.6,
  },
  sync_button_gradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  sync_button_text: {
    fontSize: 16,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  /* Erreurs */
  error_container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  error_content: {
    flex: 1,
    gap: 2,
  },
  error_title: {
    fontSize: 14,
    fontWeight: "600",
    color: PREMIUM_COLORS.error,
  },
  error_message: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  /* Scan card */
  scan_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    overflow: "hidden",
  },
  card_accent_bar: {
    height: 3,
  },
  card_content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  thumbnail_fallback: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  meta_container: {
    flex: 1,
    gap: 3,
  },
  scan_code: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  scan_description: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  meta_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  status_badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  status_dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status_text: {
    fontSize: 11,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 11,
    color: PREMIUM_COLORS.text_muted,
  },
  location_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  location_text: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
    flex: 1,
  },
  sync_status_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sync_status_text: {
    fontSize: 11,
    fontWeight: "500",
  },
  item_sync_actions: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  item_sync_button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.accent_primary,
    backgroundColor: "rgba(255, 107, 0, 0.08)",
  },
  item_sync_button_disabled: {
    opacity: 0.6,
  },
  item_sync_button_text: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.accent_primary,
  },
  item_sync_button_secondary: {
    borderColor: PREMIUM_COLORS.glass_border,
    backgroundColor: PREMIUM_COLORS.glass_bg,
  },
  item_sync_button_secondary_text: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_muted,
  },
  /* État vide */
  empty_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  empty_icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  empty_title: {
    fontSize: 18,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  empty_subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
