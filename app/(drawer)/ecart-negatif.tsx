/**
 * @fileoverview Écran des écarts négatifs avec design premium.
 * Affiche les articles attendus mais non scannés.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
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
import { useInventoryRecap, type EcartNegativeItem } from "@/hooks/use-inventory-recap";
import {
  buildCsv,
  type CsvHeader,
  type CsvRow,
} from "@/lib/inventory/recap-csv";

/**
 * Props pour une ligne d'écart négatif.
 */
type EcartNegativeRowProps = {
  /** Code attendu */
  code: string;
  /** Description optionnelle */
  description: string | null;
  /** Nom du lieu où l'article est attendu */
  locationName: string;
};

/**
 * Section accord?on pour les ecarts par localisation.
 */
type EcartNegativeSection = {
  /** Identifiant de la localisation. */
  id: string;
  /** Titre affiche dans l'en-tete. */
  title: string;
  /** Ecarts associes a la localisation. */
  data: EcartNegativeItem[];
};

/**
 * Regroupe les ecarts par localisation.
 */
function buildEcartSections(
  items: EcartNegativeItem[]
): EcartNegativeSection[] {
  const map = new Map<string, EcartNegativeSection>();

  for (const item of items) {
    const section = map.get(item.locationId) ?? {
      id: item.locationId,
      title: item.locationName,
      data: [],
    };
    section.data.push(item);
    map.set(item.locationId, section);
  }

  const sections = Array.from(map.values());
  for (const section of sections) {
    section.data.sort((a, b) => a.code.localeCompare(b.code));
  }

  return sections.sort((a, b) => a.title.localeCompare(b.title));
}


/**
 * Rend une ligne d'écart négatif.
 */
function EcartNegativeRow({
  code,
  description,
  locationName,
}: EcartNegativeRowProps) {
  return (
    <View style={styles.ecart_row}>
      <View style={styles.ecart_row_icon}>
        <IconSymbol
          name="minus.circle.fill"
          size={18}
          color={PREMIUM_COLORS.error}
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
          <Text style={styles.ecart_location}>
            Lieu attendu: {locationName}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Écran des écarts négatifs avec design premium.
 */
export default function EcartNegatifScreen() {
  const router = useRouter();
  const { session } = useComptageSession();
  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const { ecartNegative, loading, errorMessage, refresh } = useInventoryRecap(
    campaignId,
    groupId
  );
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    () => new Set()
  );


  const hasGroupSelection = Boolean(campaignId && groupId);
  const hasEcarts = ecartNegative.length > 0;
  const ecartSections = useMemo(
    () => buildEcartSections(ecartNegative),
    [ecartNegative]
  );

  /** Exporter les écarts en CSV. */
  const handleExportCsv = useCallback(async () => {
    const headers: CsvHeader[] = [
      { key: "location", label: "Lieu attendu" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
    ];
    const rows: CsvRow[] = ecartNegative.map((item) => ({
      location: item.locationName,
      code: item.code,
      description: item.description ?? "",
    }));
    const csv = buildCsv(headers, rows);
    await Share.share({
      title: "ecart-negatif.csv",
      message: csv,
    });
  }, [ecartNegative]);

  /** Rafraîchir les données. */
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  /** Naviguer vers la sélection de groupe. */
  const handleGoToGroups = useCallback(() => {
    router.push("/(drawer)/groupes");
  }, [router]);

  /** Bascule l'accordion d'une localisation. */
  const handleToggleLocation = useCallback((locationId: string) => {
    setExpandedLocations((current) => {
      const next = new Set(current);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  }, []);

  /** Rend une ligne d'ecart negatif. */
  const renderItem = useCallback(
    (item: EcartNegativeItem) => (
      <EcartNegativeRow
        code={item.code}
        description={item.description}
        locationName={item.locationName}
      />
    ),
    []
  );

  /** Rend une section accord?on. */
  const renderSection = useCallback(
    ({ item }: { item: EcartNegativeSection }) => {
      const isExpanded = expandedLocations.has(item.id);
      return (
        <View style={styles.section_block}>
          <TouchableOpacity
            style={styles.section_header}
            onPress={() => handleToggleLocation(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.section_header_content}>
              <IconSymbol
                name="mappin.and.ellipse"
                size={16}
                color={PREMIUM_COLORS.accent_primary}
              />
              <Text style={styles.section_title}>{item.title}</Text>
            </View>
            <View style={styles.section_header_right}>
              <View style={styles.section_count_badge}>
                <Text style={styles.section_count}>{item.data.length}</Text>
              </View>
              <IconSymbol
                name={isExpanded ? "chevron.down" : "chevron.right"}
                size={16}
                color={PREMIUM_COLORS.text_muted}
              />
            </View>
          </TouchableOpacity>
          {isExpanded ? (
            <View style={styles.section_items}>
              {item.data.map((entry) => (
                <View key={`${entry.locationId}-${entry.code}`}>
                  {renderItem(entry)}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    },
    [expandedLocations, handleToggleLocation, renderItem]
  );

  /** Rend l'en-tete de la liste. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header_section}>
        <BlurView intensity={20} tint="dark" style={styles.header_blur}>
          <View style={styles.header_card}>
            <View style={styles.header_row}>
              <View style={styles.header_icon}>
                <IconSymbol
                  name="minus.circle.fill"
                  size={24}
                  color={PREMIUM_COLORS.error}
                />
              </View>
              <View style={styles.header_text}>
                <Text style={styles.header_title}>Ecart negatif</Text>
                <Text style={styles.header_subtitle}>
                  Groupe: {session.group?.nom}
                </Text>
              </View>
            </View>

            <View style={styles.stat_card}>
              <Text
                style={[
                  styles.stat_value,
                  hasEcarts && styles.stat_value_error,
                ]}
              >
                {ecartNegative.length}
              </Text>
              <Text style={styles.stat_label}>
                Article(s) attendu(s) non scannes
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
          </View>
        </BlurView>
      </View>
    );
  }, [
    ecartNegative.length,
    errorMessage,
    handleExportCsv,
    handleRefresh,
    hasEcarts,
    session.group?.nom,
  ]);

  /** Rend l'etat vide ou de chargement. */
  const renderEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.loading_container}>
          <ActivityIndicator
            size="large"
            color={PREMIUM_COLORS.accent_primary}
          />
          <Text style={styles.loading_text}>
            Chargement de l'ecart negatif...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.empty_container}>
        <View style={styles.empty_icon}>
          <IconSymbol
            name="checkmark.seal.fill"
            size={40}
            color={PREMIUM_COLORS.success}
          />
        </View>
        <Text style={styles.empty_title}>Aucun ecart negatif</Text>
        <Text style={styles.empty_subtitle}>
          Tous les articles attendus ont ete scannes.
        </Text>
      </View>
    );
  }, [loading]);

  if (!hasGroupSelection) {
    return (
      <PremiumScreenWrapper>
        <View style={styles.missing_container}>
          <View style={styles.missing_icon}>
            <IconSymbol
              name="minus.circle.fill"
              size={48}
              color={PREMIUM_COLORS.text_muted}
            />
          </View>
          <Text style={styles.missing_title}>Sélection incomplète</Text>
          <Text style={styles.missing_subtitle}>
            Choisissez une campagne et un groupe pour voir l'écart négatif.
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
      <View style={styles.list_wrapper}>
        <SectionList
          sections={[{ id: "accordion", title: "accordion", data: ecartSections }]}
          keyExtractor={(item) => item.id}
          renderItem={renderSection}
          renderSectionHeader={() => null}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.scroll_content}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      </View>
    </PremiumScreenWrapper>
  );
}


/**
 * Styles du composant EcartNegatifScreen.
 */
const styles = StyleSheet.create({
  list_wrapper: {
    flex: 1,
  },
  scroll_content: {
    flexGrow: 1,
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
    backgroundColor: PREMIUM_COLORS.error_bg,
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
  stat_value_error: {
    color: PREMIUM_COLORS.error,
  },
  stat_label: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 4,
  },
  section_block: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    overflow: "hidden",
  },
  section_header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  section_header_content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  section_title: {
    fontSize: 14,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
    flexShrink: 1,
  },
  section_header_right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  section_count_badge: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: PREMIUM_COLORS.error_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  section_count: {
    fontSize: 12,
    fontWeight: "700",
    color: PREMIUM_COLORS.error,
  },
  section_items: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
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
