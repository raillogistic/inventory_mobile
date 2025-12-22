/**
 * @fileoverview Écran de l'historique des scans avec design premium.
 * Affiche la liste des scans sauvegardés localement avec images.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
  premiumStyles,
} from "@/components/ui/premium-theme";
import {
  getScanHistory,
  type ScanHistoryItem,
} from "@/lib/storage/scan-history";

/**
 * Formate un timestamp pour l'affichage en français.
 * @param value - Valeur timestamp ISO
 * @returns Date formatée en français
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
 * Retourne la couleur d'accent selon le statut du scan.
 * @param status - Statut du scan
 * @returns Couleur d'accent appropriée
 */
function getStatusColor(status: string): string {
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
 * Retourne le label du statut du scan.
 * @param status - Statut du scan
 * @returns Label en français
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case "missing":
      return "Manquant";
    case "other":
      return "Autre lieu";
    default:
      return "Scanné";
  }
}

/**
 * Écran de l'historique des scans avec design premium.
 * Affiche les scans sauvegardés avec possibilité de voir les détails.
 */
export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState<ScanHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ScanHistoryItem | null>(
    null
  );

  /** Charge les données de l'historique au focus. */
  const loadHistory = useCallback(async () => {
    const items = await getScanHistory();
    setHistoryItems(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  /** Ouvre le modal de détail. */
  const handleOpenDetail = useCallback((item: ScanHistoryItem) => {
    setSelectedItem(item);
  }, []);

  /** Ferme le modal de détail. */
  const handleCloseDetail = useCallback(() => {
    setSelectedItem(null);
  }, []);

  /** Rend une ligne d'historique. */
  const renderItem = useCallback(
    ({ item }: { item: ScanHistoryItem }) => {
      const accentColor = getStatusColor(item.status ?? "scanned");
      const statusLabel =
        item.statusLabel ?? getStatusLabel(item.status ?? "scanned");

      return (
        <TouchableOpacity
          style={styles.history_card}
          onPress={() => handleOpenDetail(item)}
          activeOpacity={0.7}
        >
          {/* Barre d'accent supérieure */}
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
                  size={24}
                  color={PREMIUM_COLORS.text_muted}
                />
              </View>
            )}

            {/* Métadonnées */}
            <View style={styles.meta_container}>
              <Text style={styles.item_code}>{item.code}</Text>
              <Text style={styles.item_description} numberOfLines={1}>
                {item.description ?? "Description inconnue"}
              </Text>

              <View style={styles.meta_row}>
                <View
                  style={[
                    styles.status_badge,
                    { backgroundColor: `${accentColor}20` },
                  ]}
                >
                  <View
                    style={[
                      styles.status_dot,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <Text style={[styles.status_text, { color: accentColor }]}>
                    {statusLabel}
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
            </View>

            {/* Chevron */}
            <IconSymbol
              name="chevron.right"
              size={16}
              color={PREMIUM_COLORS.text_muted}
            />
          </View>
        </TouchableOpacity>
      );
    },
    [handleOpenDetail]
  );

  /** Rend l'en-tête de la liste. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header_section}>
        <BlurView intensity={20} tint="dark" style={styles.header_blur}>
          <View style={styles.header_card}>
            <View style={styles.header_row}>
              <View style={styles.header_icon}>
                <IconSymbol
                  name="clock.arrow.circlepath"
                  size={24}
                  color={PREMIUM_COLORS.accent_primary}
                />
              </View>
              <View style={styles.header_text}>
                <Text style={styles.header_title}>Historique</Text>
                <Text style={styles.header_subtitle}>
                  {historyItems.length} scan(s) sauvegardé(s)
                </Text>
              </View>
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

            <Text style={styles.info_text}>
              Les scans effectués sont sauvegardés localement. Appuyez sur un
              élément pour voir les détails.
            </Text>
          </View>
        </BlurView>
      </View>
    );
  }, [historyItems.length]);

  /** Rend l'état vide. */
  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.empty_container}>
        <View style={styles.empty_icon}>
          <IconSymbol
            name="clock.arrow.circlepath"
            size={40}
            color={PREMIUM_COLORS.text_muted}
          />
        </View>
        <Text style={styles.empty_title}>Aucun scan sauvegardé</Text>
        <Text style={styles.empty_subtitle}>
          Effectuez un scan pour alimenter l'historique.
        </Text>
      </View>
    );
  }, []);

  /** Key extractor. */
  const keyExtractor = useCallback((item: ScanHistoryItem) => item.id, []);

  return (
    <PremiumScreenWrapper>
      <FlatList
        data={historyItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list_content}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal de détail */}
      <Modal
        transparent
        visible={Boolean(selectedItem)}
        animationType="fade"
        onRequestClose={handleCloseDetail}
      >
        <Pressable style={styles.modal_overlay} onPress={handleCloseDetail}>
          {selectedItem && (
            <Pressable style={styles.modal_card} onPress={() => {}}>
              {/* Bouton fermer */}
              <TouchableOpacity
                style={styles.modal_close}
                onPress={handleCloseDetail}
              >
                <IconSymbol
                  name="xmark"
                  size={16}
                  color={PREMIUM_COLORS.text_muted}
                />
              </TouchableOpacity>

              {/* Image */}
              {selectedItem.imageUri ? (
                <Image
                  source={{ uri: selectedItem.imageUri }}
                  style={styles.modal_image}
                />
              ) : (
                <View style={styles.modal_image_fallback}>
                  <IconSymbol
                    name="photo"
                    size={48}
                    color={PREMIUM_COLORS.text_muted}
                  />
                  <Text style={styles.modal_no_image}>
                    Aucune image disponible
                  </Text>
                </View>
              )}

              {/* Infos */}
              <View style={styles.modal_info}>
                <Text style={styles.modal_code}>{selectedItem.code}</Text>
                <Text style={styles.modal_description}>
                  {selectedItem.description ?? "Description inconnue"}
                </Text>

                {selectedItem.serialNumber && (
                  <View style={styles.modal_row}>
                    <IconSymbol
                      name="number"
                      size={14}
                      color={PREMIUM_COLORS.text_muted}
                    />
                    <Text style={styles.modal_meta}>
                      N° série: {selectedItem.serialNumber}
                    </Text>
                  </View>
                )}

                {selectedItem.observation && (
                  <View style={styles.modal_row}>
                    <IconSymbol
                      name="text.bubble"
                      size={14}
                      color={PREMIUM_COLORS.text_muted}
                    />
                    <Text style={styles.modal_meta}>
                      {selectedItem.observation}
                    </Text>
                  </View>
                )}

                <View style={styles.modal_row}>
                  <IconSymbol
                    name="mappin"
                    size={14}
                    color={PREMIUM_COLORS.text_muted}
                  />
                  <Text style={styles.modal_meta}>
                    {selectedItem.locationName}
                  </Text>
                </View>

                <View style={styles.modal_row}>
                  <IconSymbol
                    name="clock"
                    size={14}
                    color={PREMIUM_COLORS.text_muted}
                  />
                  <Text style={styles.modal_meta}>
                    {formatTimestamp(selectedItem.capturedAt)}
                  </Text>
                </View>
              </View>

              {/* Bouton fermer */}
              <TouchableOpacity
                style={styles.modal_button}
                onPress={handleCloseDetail}
              >
                <LinearGradient
                  colors={[
                    PREMIUM_COLORS.accent_primary,
                    PREMIUM_COLORS.accent_secondary,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modal_button_gradient}
                >
                  <Text style={styles.modal_button_text}>Fermer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </PremiumScreenWrapper>
  );
}

/**
 * Styles du composant HistoryScreen.
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
    fontSize: 24,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
    letterSpacing: -0.5,
  },
  header_subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginVertical: 16,
  },
  info_text: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    lineHeight: 18,
  },
  /* Card d'historique */
  history_card: {
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
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  thumbnail_fallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  meta_container: {
    flex: 1,
    gap: 4,
  },
  item_code: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  item_description: {
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
    paddingVertical: 4,
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
    marginTop: 2,
  },
  location_text: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
    flex: 1,
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
  /* Modal */
  modal_overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 22, 40, 0.9)",
    justifyContent: "center",
    padding: 24,
  },
  modal_card: {
    backgroundColor: PREMIUM_COLORS.gradient_start,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 20,
    gap: 16,
  },
  modal_close: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  modal_image: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  modal_image_fallback: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  modal_no_image: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },
  modal_info: {
    gap: 8,
  },
  modal_code: {
    fontSize: 22,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  modal_description: {
    fontSize: 15,
    color: PREMIUM_COLORS.text_secondary,
  },
  modal_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modal_meta: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    flex: 1,
  },
  modal_button: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  modal_button_gradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  modal_button_text: {
    fontSize: 16,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
});
