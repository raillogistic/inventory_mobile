import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  type CampagneInventaire,
  type CampagneInventaireListVariables,
} from "@/lib/graphql/inventory-operations";
import { useCampagneInventaireList } from "@/lib/graphql/inventory-hooks";

/** Props for a single campaign list item. */
type CampagneListItemProps = {
  /** Campaign data returned by the API. */
  campaign: CampagneInventaire;
  /** Whether the campaign is currently selected. */
  isSelected: boolean;
  /** Callback fired when the user selects the campaign. */
  onSelect: (campaign: CampagneInventaire) => void;
  /** Card border color derived from theme. */
  borderColor: string;
  /** Card background color derived from theme. */
  backgroundColor: string;
  /** Highlight color used for selected state. */
  highlightColor: string;
  /** Muted text color used for secondary labels. */
  mutedColor: string;
};

/** Limits the number of campaigns fetched per request. */
const CAMPAIGN_LIST_LIMIT = 50;

/**
 * Format a date string (YYYY-MM-DD) using a French locale.
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
 * Build a readable campaign date range label.
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

  return "Dates non precisees";
}

/**
 * Render a campaign card for the selection list.
 */
function CampagneListItem({
  campaign,
  isSelected,
  onSelect,
  borderColor,
  backgroundColor,
  highlightColor,
  mutedColor,
}: CampagneListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(campaign);
  }, [campaign, onSelect]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderColor, backgroundColor },
        isSelected ? { borderColor: highlightColor } : null,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir la campagne ${campaign.nom}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <ThemedText type="defaultSemiBold">{campaign.nom}</ThemedText>
          <ThemedText style={[styles.cardCode, { color: mutedColor }]}>
            Code: {campaign.code_campagne}
          </ThemedText>
        </View>
        {isSelected ? (
          <View
            style={[styles.selectedBadge, { backgroundColor: highlightColor }]}
          >
            <ThemedText style={styles.selectedBadgeText}>
              Selectionnee
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={[styles.cardDates, { color: mutedColor }]}>
        {buildDateRangeLabel(campaign)}
      </ThemedText>
    </TouchableOpacity>
  );
}

/**
 * Campaign selection screen for the comptage flow.
 */
export default function CampaignSelectionScreen() {
  const { session, setCampaign } = useComptageSession();
  const [searchText, setSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const selectedCampaignId = session.campaign?.id ?? null;

  const queryVariables = useMemo<CampagneInventaireListVariables>(
    () => ({
      nameContains: searchText.trim() || null,
      limit: CAMPAIGN_LIST_LIMIT,
    }),
    [searchText]
  );

  const { campaigns, loading, errorMessage, refetch } =
    useCampagneInventaireList(queryVariables);

  const borderColor = useThemeColor({ light: "#E2E8F0", dark: "#2B2E35" }, "icon");
  const surfaceColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const highlightColor = useThemeColor({ light: "#2563EB", dark: "#60A5FA" }, "tint");
  const mutedColor = useThemeColor({ light: "#64748B", dark: "#94A3B8" }, "icon");
  const inputTextColor = useThemeColor({}, "text");
  const placeholderColor = useThemeColor(
    { light: "#94A3B8", dark: "#6B7280" },
    "icon"
  );

  /** Update the search query used to filter campaigns. */
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  /** Store the selected campaign in the comptage session. */
  const handleSelectCampaign = useCallback(
    (campaign: CampagneInventaire) => {
      setCampaign(campaign);
    },
    [setCampaign]
  );

  /** Retry campaign list retrieval after an error. */
  const handleRetry = useCallback(() => {
    refetch(queryVariables);
  }, [queryVariables, refetch]);

  /** Refresh the campaign list via pull-to-refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch(queryVariables);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryVariables, refetch]);

  /** Render a single campaign list row. */
  const renderItem = useCallback(
    ({ item }: { item: CampagneInventaire }) => (
      <CampagneListItem
        campaign={item}
        isSelected={item.id === selectedCampaignId}
        onSelect={handleSelectCampaign}
        borderColor={borderColor}
        backgroundColor={surfaceColor}
        highlightColor={highlightColor}
        mutedColor={mutedColor}
      />
    ),
    [
      borderColor,
      handleSelectCampaign,
      highlightColor,
      mutedColor,
      selectedCampaignId,
      surfaceColor,
    ]
  );

  /** Provide stable keys for the campaign list. */
  const keyExtractor = useCallback((item: CampagneInventaire) => item.id, []);

  const showInitialLoading = loading && campaigns.length === 0 && !isRefreshing;
  const showInlineError = Boolean(errorMessage && campaigns.length > 0);

  /** Render the list header with search and selection context. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <ThemedText type="title">Campagnes</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Selectionnez une campagne active pour commencer le comptage.
          </ThemedText>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                borderColor,
                color: inputTextColor,
                backgroundColor: surfaceColor,
              },
            ]}
            placeholder="Rechercher une campagne"
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            value={searchText}
            onChangeText={handleSearchChange}
          />
        </View>

        {selectedCampaignId ? (
          <View style={[styles.selectedBanner, { borderColor }]}>
            <ThemedText type="defaultSemiBold">
              Campagne selectionnee
            </ThemedText>
            <ThemedText style={{ color: mutedColor }}>
              {session.campaign?.nom}
            </ThemedText>
          </View>
        ) : null}

        {showInlineError ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorTitle}>
              Impossible de charger les campagnes.
            </ThemedText>
            <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
              {errorMessage}
            </ThemedText>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: highlightColor }]}
              onPress={handleRetry}
            >
              <ThemedText style={styles.retryButtonText}>Reessayer</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }, [
    borderColor,
    errorMessage,
    handleRetry,
    handleSearchChange,
    highlightColor,
    inputTextColor,
    mutedColor,
    placeholderColor,
    searchText,
    selectedCampaignId,
    session.campaign?.nom,
    showInlineError,
    surfaceColor,
  ]);

  /** Render the empty/loading state for the campaign list. */
  const renderEmptyComponent = useCallback(() => {
    if (showInitialLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={highlightColor} />
          <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
            Chargement des campagnes...
          </ThemedText>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorTitle}>
            Impossible de charger les campagnes.
          </ThemedText>
          <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
            {errorMessage}
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: highlightColor }]}
            onPress={handleRetry}
          >
            <ThemedText style={styles.retryButtonText}>Reessayer</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <ThemedText type="subtitle">Aucune campagne trouvee.</ThemedText>
        <ThemedText style={[styles.emptyMessage, { color: mutedColor }]}>
          Verifiez votre recherche ou contactez l'administrateur.
        </ThemedText>
      </View>
    );
  }, [
    errorMessage,
    handleRetry,
    highlightColor,
    mutedColor,
    showInitialLoading,
  ]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={campaigns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        alwaysBounceVertical
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    gap: 12,
  },
  header: {
    gap: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  searchContainer: {
    marginBottom: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  selectedBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorMessage: {
    fontSize: 14,
  },
  retryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyContainer: {
    paddingVertical: 24,
    gap: 6,
    alignItems: "center",
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  cardCode: {
    fontSize: 13,
  },
  cardDates: {
    fontSize: 13,
  },
  selectedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
