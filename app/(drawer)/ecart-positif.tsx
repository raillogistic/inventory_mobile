/**
 * @fileoverview Écran des écarts positifs avec design premium.
 * Affiche les articles scannés mais non attendus à leur emplacement.
 */

import React, { useCallback } from "react";
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
 * Props pour une ligne d'écart positif.
 */
type EcartPositiveRowProps = {
  /** Code scanné */
  code: string;
  /** Description optionnelle */
  description: string | null;
  /** Nom du lieu où l'article a été scanné */
  locationName: string;
  /** Lieux attendus pour l'article */
  expectedLocations: string[];
};

/**
 * Rend une ligne d'écart positif.
 */
function EcartPositiveRow({
  code,
  description,
  locationName,
  expectedLocations,
}: EcartPositiveRowProps) {
  return (
    <View style={styles.ecart_row}>
      <View style={styles.ecart_row_icon}>
        <IconSymbol
          name="plus.circle.fill"
          size={18}
          color={PREMIUM_COLORS.warning}
        />
      </View>
      <View style={styles.ecart_row_content}>
        <Text style={styles.ecart_code}>{code}</Text>
        {description && (
          <Text style={styles.ecart_description} numberOfLines={1}>
            {description}
          </Text>
        )}
        <View style={styles.ecart_location_row}>
          <IconSymbol
            name="mappin"
            size={12}
            color={PREMIUM_COLORS.text_muted}
          />
          <Text style={styles.ecart_location}>Lieu scanné: {locationName}</Text>
        </View>
        {expectedLocations.length > 0 && (
          <View style={styles.ecart_expected_row}>
            <IconSymbol
              name="arrow.right.circle"
              size={12}
              color={PREMIUM_COLORS.accent_primary}
            />
            <Text style={styles.ecart_expected}>
              Attendu: {expectedLocations.join(", ")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Écran des écarts positifs avec design premium.
 */
export default function EcartPositifScreen() {
  const router = useRouter();
  const { session } = useComptageSession();
  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const { ecartPositive, loading, errorMessage, refresh } = useInventoryRecap(
    campaignId,
    groupId
  );

  const hasGroupSelection = Boolean(campaignId && groupId);
  const hasEcarts = ecartPositive.length > 0;

  /** Exporter les écarts en CSV. */
  const handleExportCsv = useCallback(async () => {
    const headers: CsvHeader[] = [
      { key: "location", label: "Lieu scanné" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "expected", label: "Lieux attendus" },
    ];
    const rows: CsvRow[] = ecartPositive.map((item) => ({
      location: item.locationName,
      code: item.code,
      description: item.description ?? "",
      expected: item.expectedLocations.join(" | "),
    }));
    const csv = buildCsv(headers, rows);
    await Share.share({
      title: "ecart-positif.csv",
      message: csv,
    });
  }, [ecartPositive]);

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
              name="plus.circle.fill"
              size={48}
              color={PREMIUM_COLORS.text_muted}
            />
          </View>
          <Text style={styles.missing_title}>Sélection incomplète</Text>
          <Text style={styles.missing_subtitle}>
            Choisissez une campagne et un groupe pour voir l'écart positif.
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
                    name="plus.circle.fill"
                    size={24}
                    color={PREMIUM_COLORS.warning}
                  />
                </View>
                <View style={styles.header_text}>
                  <Text style={styles.header_title}>Écart positif</Text>
                  <Text style={styles.header_subtitle}>
                    Groupe: {session.group?.nom}
                  </Text>
                </View>
              </View>

              {/* Stat */}
              <View style={styles.stat_card}>
                <Text
                  style={[
                    styles.stat_value,
                    hasEcarts && styles.stat_value_warning,
                  ]}
                >
                  {ecartPositive.length}
                </Text>
                <Text style={styles.stat_label}>
                  Article(s) scanné(s) non attendu(s) ici
                </Text>
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
            <Text style={styles.loading_text}>
              Chargement de l'écart positif...
            </Text>
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

        {/* Liste des écarts */}
        <View style={styles.list_card}>
          {hasEcarts ? (
            ecartPositive.map((item) => (
              <EcartPositiveRow
                key={`${item.locationId}-${item.code}`}
                code={item.code}
                description={item.description}
                locationName={item.locationName}
                expectedLocations={item.expectedLocations}
              />
            ))
          ) : (
            <View style={styles.empty_container}>
              <View style={styles.empty_icon}>
                <IconSymbol
                  name="checkmark.seal.fill"
                  size={40}
                  color={PREMIUM_COLORS.success}
                />
              </View>
              <Text style={styles.empty_title}>Aucun écart positif</Text>
              <Text style={styles.empty_subtitle}>
                Tous les articles sont scannés à leur emplacement attendu.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </PremiumScreenWrapper>
  );
}

/**
 * Styles du composant EcartPositifScreen.
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
    backgroundColor: PREMIUM_COLORS.warning_bg,
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
  stat_card: {
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  stat_value: {
    fontSize: 36,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  stat_value_warning: {
    color: PREMIUM_COLORS.warning,
  },
  stat_label: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 4,
    textAlign: "center",
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
  /* Liste */
  list_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 16,
    gap: 14,
  },
  /* Ecart row */
  ecart_row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PREMIUM_COLORS.glass_border,
  },
  ecart_row_icon: {
    marginTop: 2,
  },
  ecart_row_content: {
    flex: 1,
    gap: 2,
  },
  ecart_code: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  ecart_description: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  ecart_location_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ecart_location: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  ecart_expected_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  ecart_expected: {
    fontSize: 12,
    color: PREMIUM_COLORS.accent_primary,
    flex: 1,
  },
  /* État vide */
  empty_container: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  empty_icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PREMIUM_COLORS.success_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  empty_title: {
    fontSize: 18,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  empty_subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
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
