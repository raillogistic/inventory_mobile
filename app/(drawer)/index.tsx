import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { type CampagneInventaire } from "@/lib/graphql/inventory-operations";

/**
 * Palette de couleurs premium pour le design.
 * Inspirée d'un thème industriel/ferroviaire moderne.
 */
const COLORS = {
  /** Dégradé principal - du bleu profond au violet */
  gradient_start: "#0A1628",
  gradient_mid: "#1A237E",
  gradient_end: "#311B92",
  /** Accents */
  accent_primary: "#FF6B00",
  accent_secondary: "#FF8F3F",
  accent_glow: "rgba(255, 107, 0, 0.4)",
  /** Accents secondaires pour les états */
  highlight: "#60A5FA",
  highlight_glow: "rgba(96, 165, 250, 0.3)",
  /** Surfaces glassmorphism */
  glass_bg: "rgba(255, 255, 255, 0.08)",
  glass_border: "rgba(255, 255, 255, 0.15)",
  glass_shadow: "rgba(0, 0, 0, 0.3)",
  /** Textes */
  text_primary: "#FFFFFF",
  text_secondary: "rgba(255, 255, 255, 0.7)",
  text_muted: "rgba(255, 255, 255, 0.5)",
  /** Champs de saisie */
  input_bg: "rgba(255, 255, 255, 0.05)",
  input_border: "rgba(255, 255, 255, 0.12)",
  input_focus_border: "#FF6B00",
  /** États */
  error: "#FF5252",
  success: "#4CAF50",
  /** Éléments décoratifs */
  orb_1: "rgba(255, 107, 0, 0.3)",
  orb_2: "rgba(156, 39, 176, 0.25)",
  orb_3: "rgba(33, 150, 243, 0.2)",
  /** Cartes */
  card_bg: "rgba(255, 255, 255, 0.06)",
  card_border: "rgba(255, 255, 255, 0.1)",
  card_selected_border: "#FF6B00",
} as const;

/** Limite le nombre de campagnes récupérées par requête. */
const CAMPAIGN_LIST_LIMIT = 50;

/**
 * Props pour un élément de liste de campagne.
 */
type CampagneListItemProps = {
  /** Données de la campagne retournées par l'API. */
  campaign: CampagneInventaire;
  /** Si la campagne est actuellement sélectionnée. */
  isSelected: boolean;
  /** Callback déclenché lors de la sélection de la campagne. */
  onSelect: (campaign: CampagneInventaire) => void;
};

/**
 * Props pour le composant d'orbe flottant statique.
 */
type FloatingOrbProps = {
  /** Couleur de l'orbe. */
  color: string;
  /** Taille de l'orbe en pixels. */
  size: number;
  /** Position X (% du conteneur). */
  positionX: number;
  /** Position Y (% du conteneur). */
  positionY: number;
};

/**
 * Normalise une valeur de recherche pour une correspondance insensible à la casse.
 * @param value - Valeur à normaliser.
 * @returns Valeur normalisée.
 */
function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Filtre et trie les campagnes en fonction de la valeur de recherche.
 * @param campaigns - Liste des campagnes.
 * @param searchValue - Valeur de recherche.
 * @returns Campagnes filtrées et triées.
 */
function filterCampaigns(
  campaigns: CampagneInventaire[],
  searchValue: string
): CampagneInventaire[] {
  const normalizedSearch = normalizeSearchValue(searchValue);
  const filtered = normalizedSearch
    ? campaigns.filter((campaign) =>
        campaign.nom.toLowerCase().includes(normalizedSearch)
      )
    : campaigns;

  return [...filtered]
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .slice(0, CAMPAIGN_LIST_LIMIT);
}

/**
 * Formate une chaîne de date (YYYY-MM-DD) en utilisant la locale française.
 * @param value - Valeur de date à formater.
 * @returns Date formatée ou null.
 */
function formatDateLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return value;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Construit un label de plage de dates lisible pour une campagne.
 * @param campaign - Campagne pour laquelle construire le label.
 * @returns Label de plage de dates.
 */
function buildDateRangeLabel(campaign: CampagneInventaire): string {
  const startDate = formatDateLabel(campaign.date_debut);
  const endDate = formatDateLabel(campaign.date_fin);

  if (startDate && endDate) {
    return `Du ${startDate} au ${endDate}`;
  }

  if (startDate) {
    return `Depuis ${startDate}`;
  }

  if (endDate) {
    return `Jusqu'au ${endDate}`;
  }

  return "Dates non précisées";
}

/**
 * Composant d'orbe flottant décoratif statique.
 * Crée un effet visuel de lumière ambiante.
 */
function FloatingOrb({ color, size, positionX, positionY }: FloatingOrbProps) {
  return (
    <View
      style={[
        styles.floating_orb,
        {
          width: size,
          height: size,
          backgroundColor: color,
          left: `${positionX}%`,
          top: `${positionY}%`,
        },
      ]}
    />
  );
}

/**
 * Carte de campagne pour la liste de sélection.
 * Design glassmorphism avec états visuels clairs.
 */
function CampagneListItem({
  campaign,
  isSelected,
  onSelect,
}: CampagneListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(campaign);
  }, [campaign, onSelect]);

  return (
    <TouchableOpacity
      style={[
        styles.campaign_card,
        isSelected && styles.campaign_card_selected,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir la campagne ${campaign.nom}`}
      activeOpacity={0.7}
    >
      <View style={styles.card_header}>
        <View style={styles.card_icon_container}>
          <IconSymbol
            name="folder.fill"
            size={20}
            color={isSelected ? COLORS.accent_primary : COLORS.text_muted}
          />
        </View>
        <View style={styles.card_content}>
          <Text style={styles.card_title}>{campaign.nom}</Text>
          <Text style={styles.card_code}>Code: {campaign.code_campagne}</Text>
        </View>
        {isSelected && (
          <View style={styles.selected_badge}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={16}
              color={COLORS.text_primary}
            />
            <Text style={styles.selected_badge_text}>Active</Text>
          </View>
        )}
      </View>
      <View style={styles.card_footer}>
        <IconSymbol name="calendar" size={14} color={COLORS.text_muted} />
        <Text style={styles.card_dates}>{buildDateRangeLabel(campaign)}</Text>
      </View>
      {isSelected && <View style={styles.card_glow} />}
    </TouchableOpacity>
  );
}

/**
 * Écran de sélection de campagne pour le flux de comptage.
 *
 * Fonctionnalités:
 * - Fond dégradé avec orbes décoratifs
 * - Carte glassmorphism pour l'en-tête
 * - Liste de campagnes avec design premium
 * - Recherche avec icône intégrée
 * - États visuels clairs (sélection, chargement, erreur)
 */
export default function CampaignSelectionScreen() {
  const router = useRouter();
  const { session, setCampaign } = useComptageSession();
  const { cache, isHydrated, isSyncing, syncError, syncAll } =
    useInventoryOffline();
  const [searchText, setSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const selectedCampaignId = session.campaign?.id ?? null;

  const campaigns = useMemo(
    () => filterCampaigns(cache.campaigns, searchText),
    [cache.campaigns, searchText]
  );
  const hasCampaigns = cache.campaigns.length > 0;
  const isLoading = !isHydrated || (isSyncing && !hasCampaigns);
  const errorMessage = syncError;

  /** Met à jour la requête de recherche pour filtrer les campagnes. */
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  /** Stocke la campagne sélectionnée et navigue vers la sélection de groupe. */
  const handleSelectCampaign = useCallback(
    (campaign: CampagneInventaire) => {
      setCampaign(campaign);
      router.push("/(drawer)/groupes");
    },
    [router, setCampaign]
  );

  /** Réessaie la récupération de la liste des campagnes après une erreur. */
  const handleRetry = useCallback(() => {
    void syncAll();
  }, [syncAll]);

  /** Rafraîchit la liste des campagnes via pull-to-refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncAll]);

  /** Rend une ligne de la liste des campagnes. */
  const renderItem = useCallback(
    ({ item }: { item: CampagneInventaire }) => (
      <CampagneListItem
        campaign={item}
        isSelected={item.id === selectedCampaignId}
        onSelect={handleSelectCampaign}
      />
    ),
    [handleSelectCampaign, selectedCampaignId]
  );

  /** Fournit des clés stables pour la liste des campagnes. */
  const keyExtractor = useCallback((item: CampagneInventaire) => item.id, []);

  const showInitialLoading =
    isLoading && campaigns.length === 0 && !isRefreshing;
  const showInlineError = Boolean(errorMessage && campaigns.length > 0);

  /** Rend l'en-tête de la liste avec recherche et contexte de sélection. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.header_section}>
        {/* Carte d'en-tête glassmorphism */}
        <BlurView intensity={15} tint="dark" style={styles.header_blur}>
          <View style={styles.header_card}>
            <View style={styles.header_title_row}>
              <View style={styles.header_icon_container}>
                <IconSymbol
                  name="list.bullet.clipboard.fill"
                  size={24}
                  color={COLORS.accent_primary}
                />
              </View>
              <View style={styles.header_text}>
                <Text style={styles.header_title}>Campagnes</Text>
                <Text style={styles.header_subtitle}>
                  Sélectionnez une campagne active pour commencer le comptage
                </Text>
              </View>
            </View>

            {/* Séparateur décoratif */}
            <View style={styles.separator}>
              <LinearGradient
                colors={["transparent", COLORS.accent_primary, "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.separator_gradient}
              />
            </View>

            {/* Champ de recherche */}
            <View style={styles.search_container}>
              <IconSymbol
                name="magnifyingglass"
                size={18}
                color={COLORS.text_muted}
              />
              <TextInput
                style={styles.search_input}
                placeholder="Rechercher une campagne..."
                placeholderTextColor={COLORS.text_muted}
                autoCapitalize="none"
                autoCorrect={false}
                value={searchText}
                onChangeText={handleSearchChange}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <IconSymbol
                    name="xmark.circle.fill"
                    size={18}
                    color={COLORS.text_muted}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </BlurView>

        {/* Bannière de campagne sélectionnée */}
        {selectedCampaignId && session.campaign && (
          <View style={styles.selected_banner}>
            <View style={styles.selected_banner_icon}>
              <IconSymbol
                name="checkmark.seal.fill"
                size={20}
                color={COLORS.success}
              />
            </View>
            <View style={styles.selected_banner_content}>
              <Text style={styles.selected_banner_label}>Campagne active</Text>
              <Text style={styles.selected_banner_name}>
                {session.campaign.nom}
              </Text>
            </View>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={COLORS.text_muted}
            />
          </View>
        )}

        {/* Message d'erreur inline */}
        {showInlineError && (
          <View style={styles.error_container}>
            <View style={styles.error_icon_container}>
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={20}
                color={COLORS.error}
              />
            </View>
            <View style={styles.error_content}>
              <Text style={styles.error_title}>Erreur de synchronisation</Text>
              <Text style={styles.error_message}>{errorMessage}</Text>
            </View>
            <TouchableOpacity style={styles.retry_button} onPress={handleRetry}>
              <LinearGradient
                colors={[COLORS.accent_primary, COLORS.accent_secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.retry_gradient}
              >
                <IconSymbol
                  name="arrow.clockwise"
                  size={14}
                  color={COLORS.text_primary}
                />
                <Text style={styles.retry_text}>Réessayer</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Compteur de résultats */}
        <View style={styles.results_counter}>
          <IconSymbol name="folder" size={14} color={COLORS.text_muted} />
          <Text style={styles.results_text}>
            {campaigns.length} campagne{campaigns.length !== 1 ? "s" : ""}{" "}
            disponible{campaigns.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    );
  }, [
    campaigns.length,
    errorMessage,
    handleRetry,
    handleSearchChange,
    searchText,
    selectedCampaignId,
    session.campaign,
    showInlineError,
  ]);

  /** Rend l'état vide/chargement pour la liste des campagnes. */
  const renderEmptyComponent = useCallback(() => {
    if (showInitialLoading) {
      return (
        <View style={styles.loading_container}>
          <View style={styles.loading_icon_container}>
            <ActivityIndicator size="large" color={COLORS.accent_primary} />
          </View>
          <Text style={styles.loading_title}>Chargement des campagnes</Text>
          <Text style={styles.loading_subtitle}>
            Synchronisation avec le serveur en cours...
          </Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.error_full_container}>
          <View style={styles.error_full_icon}>
            <IconSymbol name="wifi.slash" size={48} color={COLORS.error} />
          </View>
          <Text style={styles.error_full_title}>Connexion impossible</Text>
          <Text style={styles.error_full_message}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.error_full_button}
            onPress={handleRetry}
          >
            <LinearGradient
              colors={[COLORS.accent_primary, COLORS.accent_secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.error_full_gradient}
            >
              <IconSymbol
                name="arrow.clockwise"
                size={18}
                color={COLORS.text_primary}
              />
              <Text style={styles.error_full_button_text}>
                Réessayer la connexion
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.empty_container}>
        <View style={styles.empty_icon_container}>
          <IconSymbol
            name="folder.badge.questionmark"
            size={48}
            color={COLORS.text_muted}
          />
        </View>
        <Text style={styles.empty_title}>Aucune campagne trouvée</Text>
        <Text style={styles.empty_message}>
          Vérifiez votre recherche ou contactez l&apos;administrateur système.
        </Text>
      </View>
    );
  }, [errorMessage, handleRetry, showInitialLoading]);

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Fond dégradé */}
      <LinearGradient
        colors={[
          COLORS.gradient_start,
          COLORS.gradient_mid,
          COLORS.gradient_end,
        ]}
        style={styles.gradient_background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Orbes flottants décoratifs */}
      <FloatingOrb
        color={COLORS.orb_1}
        size={180}
        positionX={-15}
        positionY={5}
      />
      <FloatingOrb
        color={COLORS.orb_2}
        size={140}
        positionX={75}
        positionY={10}
      />
      <FloatingOrb
        color={COLORS.orb_3}
        size={160}
        positionX={65}
        positionY={75}
      />
      <FloatingOrb
        color={COLORS.orb_1}
        size={100}
        positionX={-5}
        positionY={85}
      />

      {/* Contenu principal */}
      <FlatList
        data={campaigns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.list_content}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        alwaysBounceVertical
      />
    </View>
  );
}

/**
 * Styles du composant CampaignSelectionScreen.
 * Utilise un design premium avec glassmorphism.
 */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.gradient_start,
  },
  gradient_background: {
    ...StyleSheet.absoluteFillObject,
  },
  floating_orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.6,
  },
  list_content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
  },
  /* Section En-tête */
  header_section: {
    gap: 16,
    marginBottom: 8,
  },
  header_blur: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.glass_border,
  },
  header_card: {
    padding: 20,
    backgroundColor: COLORS.glass_bg,
  },
  header_title_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  header_icon_container: {
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
    color: COLORS.text_primary,
    letterSpacing: -0.5,
  },
  header_subtitle: {
    fontSize: 13,
    color: COLORS.text_secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  separator: {
    height: 1,
    marginBottom: 16,
  },
  separator_gradient: {
    flex: 1,
    height: 1,
  },
  /* Recherche */
  search_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.input_bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.input_border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  search_input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text_primary,
    fontWeight: "500",
  },
  /* Bannière sélection */
  selected_banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.3)",
    padding: 14,
  },
  selected_banner_icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  selected_banner_content: {
    flex: 1,
  },
  selected_banner_label: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.success,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selected_banner_name: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text_primary,
    marginTop: 2,
  },
  /* Erreur inline */
  error_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.3)",
    padding: 14,
  },
  error_icon_container: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 82, 82, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  error_content: {
    flex: 1,
  },
  error_title: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.error,
  },
  error_message: {
    fontSize: 12,
    color: COLORS.text_muted,
    marginTop: 2,
  },
  retry_button: {
    borderRadius: 10,
    overflow: "hidden",
  },
  retry_gradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retry_text: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text_primary,
  },
  /* Compteur de résultats */
  results_counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  results_text: {
    fontSize: 13,
    color: COLORS.text_muted,
    fontWeight: "500",
  },
  /* Carte de campagne */
  campaign_card: {
    backgroundColor: COLORS.card_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.card_border,
    padding: 16,
    gap: 12,
    position: "relative",
    overflow: "hidden",
  },
  campaign_card_selected: {
    borderColor: COLORS.card_selected_border,
    borderWidth: 2,
  },
  card_header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  card_icon_container: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  card_content: {
    flex: 1,
  },
  card_title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text_primary,
    marginBottom: 2,
  },
  card_code: {
    fontSize: 12,
    color: COLORS.text_muted,
    fontWeight: "500",
  },
  selected_badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accent_primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  selected_badge_text: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text_primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card_footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 52,
  },
  card_dates: {
    fontSize: 13,
    color: COLORS.text_muted,
  },
  card_glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.accent_primary,
    opacity: 0.8,
  },
  /* États de chargement */
  loading_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loading_icon_container: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  loading_title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text_primary,
  },
  loading_subtitle: {
    fontSize: 14,
    color: COLORS.text_muted,
    textAlign: "center",
  },
  /* Erreur pleine page */
  error_full_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 16,
  },
  error_full_icon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  error_full_title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text_primary,
  },
  error_full_message: {
    fontSize: 14,
    color: COLORS.text_muted,
    textAlign: "center",
    lineHeight: 20,
  },
  error_full_button: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
    shadowColor: COLORS.accent_primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  error_full_gradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  error_full_button_text: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text_primary,
  },
  /* État vide */
  empty_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 12,
  },
  empty_icon_container: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  empty_title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text_primary,
  },
  empty_message: {
    fontSize: 14,
    color: COLORS.text_muted,
    textAlign: "center",
    lineHeight: 20,
  },
});
