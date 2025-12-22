/**
 * @fileoverview Écran de récapitulatif des scans avec design premium.
 * Affiche les scans groupés par localisation et les articles manquants.
 */

import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
} from "@/components/ui/premium-theme";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryRecap } from "@/hooks/use-inventory-recap";
import {
  buildCsv,
  type CsvHeader,
  type CsvRow,
} from "@/lib/inventory/recap-csv";

/**
 * Props pour une ligne de scan dans le récap.
 */
type ScanRowProps = {
  /** Code article scanné */
  code: string;
  /** Description optionnelle */
  description: string | null;
  /** État optionnel du scan */
  etat: string | null;
  /** Timestamp de capture optionnel */
  capturedAt: string | null;
};

/**
 * Rend une ligne de scan pour la liste du récap.
 */
function ScanRow({ code, description, etat, capturedAt }: ScanRowProps) {
  return (
    <View style={styles.scan_row}>
      <View style={styles.scan_row_icon}>
        <IconSymbol
          name="checkmark.circle.fill"
          size={16}
          color={PREMIUM_COLORS.success}
        />
      </View>
      <View style={styles.scan_row_content}>
        <Text style={styles.scan_code}>{code}</Text>
        {description && (
          <Text style={styles.scan_description} numberOfLines={1}>
            {description}
          </Text>
        )}
        <View style={styles.scan_meta_row}>
          {etat && (
            <View style={styles.scan_badge}>
              <Text style={styles.scan_badge_text}>{etat}</Text>
            </View>
          )}
          {capturedAt && (
            <Text style={styles.scan_timestamp}>{capturedAt}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Écran de récapitulatif avec design premium.
 */
export default function RecapScreen() {
  const router = useRouter();
  const { session } = useComptageSession();
  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const { scansByLocation, missingArticles, loading, errorMessage, refresh } =
    useInventoryRecap(campaignId, groupId);

  const hasGroupSelection = Boolean(campaignId && groupId);
  const hasMissing = missingArticles.length > 0;
  const totalScans = scansByLocation.reduce(
    (acc, g) => acc + g.scans.length,
    0
  );

  /** Exporter les scans en CSV. */
  const handleExportCsv = useCallback(async () => {
    const headers: CsvHeader[] = [
      { key: "location", label: "Lieu" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "etat", label: "État" },
      { key: "capturedAt", label: "Capture" },
    ];

    const rows: CsvRow[] = scansByLocation.flatMap((group) =>
      group.scans.map((scan) => ({
        location: group.locationName,
        code: scan.code,
        description: scan.description ?? "",
        etat: scan.etat ?? "",
        capturedAt: scan.capturedAt ?? "",
      }))
    );

    const csv = buildCsv(headers, rows);
    await Share.share({
      title: "recap-scans.csv",
      message: csv,
    });
  }, [scansByLocation]);

  /** Rafraîchir les données. */
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  /** Naviguer vers la sélection de groupe. */
  const handleGoToGroups = useCallback(() => {
    router.push("/(drawer)/groupes");
  }, [router]);

  if (!hasGroupSelection) {
    return (
      <PremiumScreenWrapper>
        <View style={styles.missing_container}>
          <View style={styles.missing_icon}>
            <IconSymbol
              name="chart.bar.fill"
              size={48}
              color={PREMIUM_COLORS.text_muted}
            />
          </View>
          <Text style={styles.missing_title}>Sélection incomplète</Text>
          <Text style={styles.missing_subtitle}>
            Choisissez une campagne et un groupe pour voir le récap.
          </Text>
          <TouchableOpacity
            style={styles.missing_button}
            onPress={handleGoToGroups}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[
                PREMIUM_COLORS.accent_primary,
                PREMIUM_COLORS.accent_secondary,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.missing_button_gradient}
            >
              <Text style={styles.missing_button_text}>Choisir un groupe</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </PremiumScreenWrapper>
    );
  }

  return (
    <PremiumScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scroll_content}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête */}
        <View style={styles.header_section}>
          <BlurView intensity={20} tint="dark" style={styles.header_blur}>
            <View style={styles.header_card}>
              <View style={styles.header_row}>
                <View style={styles.header_icon}>
                  <IconSymbol
                    name="chart.bar.fill"
                    size={24}
                    color={PREMIUM_COLORS.accent_primary}
                  />
                </View>
                <View style={styles.header_text}>
                  <Text style={styles.header_title}>Récap</Text>
                  <Text style={styles.header_subtitle}>
                    Groupe: {session.group?.nom}
                  </Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.stats_row}>
                <View style={styles.stat_card}>
                  <Text style={styles.stat_value}>{totalScans}</Text>
                  <Text style={styles.stat_label}>Scans</Text>
                </View>
                <View style={styles.stat_card}>
                  <Text style={styles.stat_value}>
                    {scansByLocation.length}
                  </Text>
                  <Text style={styles.stat_label}>Lieux</Text>
                </View>
                <View
                  style={[
                    styles.stat_card,
                    hasMissing && styles.stat_card_warning,
                  ]}
                >
                  <Text
                    style={[
                      styles.stat_value,
                      hasMissing && styles.stat_value_warning,
                    ]}
                  >
                    {missingArticles.length}
                  </Text>
                  <Text style={styles.stat_label}>Inconnus</Text>
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

              {/* Actions */}
              <View style={styles.action_row}>
                <TouchableOpacity
                  style={styles.action_button}
                  onPress={handleRefresh}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name="arrow.clockwise"
                    size={16}
                    color={PREMIUM_COLORS.text_secondary}
                  />
                  <Text style={styles.action_button_text}>Actualiser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.action_button}
                  onPress={handleExportCsv}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name="square.and.arrow.up"
                    size={16}
                    color={PREMIUM_COLORS.text_secondary}
                  />
                  <Text style={styles.action_button_text}>Exporter CSV</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Chargement */}
        {loading && (
          <View style={styles.loading_container}>
            <ActivityIndicator
              size="large"
              color={PREMIUM_COLORS.accent_primary}
            />
            <Text style={styles.loading_text}>Chargement du récap...</Text>
          </View>
        )}

        {/* Erreur */}
        {errorMessage && (
          <View style={styles.error_container}>
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={20}
              color={PREMIUM_COLORS.error}
            />
            <View style={styles.error_content}>
              <Text style={styles.error_title}>Erreur de chargement</Text>
              <Text style={styles.error_message}>{errorMessage}</Text>
            </View>
          </View>
        )}

        {/* Scans par localisation */}
        {scansByLocation.map((group) => (
          <View key={group.locationId} style={styles.section}>
            <View style={styles.section_header}>
              <View style={styles.section_header_left}>
                <IconSymbol
                  name="mappin.and.ellipse"
                  size={16}
                  color={PREMIUM_COLORS.accent_primary}
                />
                <Text style={styles.section_title}>{group.locationName}</Text>
              </View>
              <View style={styles.section_badge}>
                <Text style={styles.section_badge_text}>
                  {group.scans.length}
                </Text>
              </View>
            </View>
            <View style={styles.section_card}>
              {group.scans.map((scan) => (
                <ScanRow
                  key={`${scan.id}-${scan.code}`}
                  code={scan.code}
                  description={scan.description}
                  etat={scan.etat}
                  capturedAt={scan.capturedAt}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Articles inconnus */}
        <View style={styles.section}>
          <View style={styles.section_header}>
            <View style={styles.section_header_left}>
              <IconSymbol
                name="questionmark.circle.fill"
                size={16}
                color={PREMIUM_COLORS.warning}
              />
              <Text style={styles.section_title}>Articles inconnus</Text>
            </View>
            <View
              style={[
                styles.section_badge,
                hasMissing && styles.section_badge_warning,
              ]}
            >
              <Text style={styles.section_badge_text}>
                {missingArticles.length}
              </Text>
            </View>
          </View>
          <View style={styles.section_card}>
            {hasMissing ? (
              missingArticles.map((item) => (
                <View
                  key={`${item.locationId}-${item.code}-${
                    item.capturedAt ?? "x"
                  }`}
                  style={styles.missing_row}
                >
                  <View style={styles.missing_row_icon}>
                    <IconSymbol
                      name="exclamationmark.circle.fill"
                      size={16}
                      color={PREMIUM_COLORS.warning}
                    />
                  </View>
                  <View style={styles.missing_row_content}>
                    <Text style={styles.missing_code}>{item.code}</Text>
                    <Text style={styles.missing_location}>
                      Lieu: {item.locationName}
                    </Text>
                    {item.capturedAt && (
                      <Text style={styles.missing_timestamp}>
                        Capture: {item.capturedAt}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.empty_text}>Aucun article inconnu.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </PremiumScreenWrapper>
  );
}

/**
 * Styles du composant RecapScreen.
 */
const styles = StyleSheet.create({
  scroll_content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
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
  stats_row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  stat_card: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  stat_card_warning: {
    backgroundColor: PREMIUM_COLORS.warning_bg,
  },
  stat_value: {
    fontSize: 24,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  stat_value_warning: {
    color: PREMIUM_COLORS.warning,
  },
  stat_label: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 2,
  },
  separator: {
    height: 1,
    marginVertical: 16,
  },
  action_row: {
    flexDirection: "row",
    gap: 12,
  },
  action_button: {
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
  },
  action_button_text: {
    fontSize: 14,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  /* Chargement */
  loading_container: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  loading_text: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },
  /* Erreur */
  error_container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 16,
    padding: 16,
  },
  error_content: {
    flex: 1,
    gap: 4,
  },
  error_title: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.error,
  },
  error_message: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  /* Section */
  section: {
    gap: 10,
  },
  section_header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section_header_left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  section_title: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  section_badge: {
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  section_badge_warning: {
    backgroundColor: PREMIUM_COLORS.warning_bg,
  },
  section_badge_text: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  section_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 14,
    gap: 12,
  },
  /* Scan row */
  scan_row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  scan_row_icon: {
    marginTop: 2,
  },
  scan_row_content: {
    flex: 1,
    gap: 2,
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
  scan_meta_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  scan_badge: {
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  scan_badge_text: {
    fontSize: 11,
    fontWeight: "500",
    color: PREMIUM_COLORS.text_secondary,
  },
  scan_timestamp: {
    fontSize: 11,
    color: PREMIUM_COLORS.text_muted,
  },
  /* Missing row */
  missing_row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  missing_row_icon: {
    marginTop: 2,
  },
  missing_row_content: {
    flex: 1,
    gap: 2,
  },
  missing_code: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  missing_location: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  missing_timestamp: {
    fontSize: 11,
    color: PREMIUM_COLORS.text_muted,
  },
  empty_text: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
    paddingVertical: 8,
  },
  /* Missing selection */
  missing_container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  missing_icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  missing_title: {
    fontSize: 22,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
    textAlign: "center",
  },
  missing_subtitle: {
    fontSize: 15,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
  },
  missing_button: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  missing_button_gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  missing_button_text: {
    fontSize: 16,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
});
