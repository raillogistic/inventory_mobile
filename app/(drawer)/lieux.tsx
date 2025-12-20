import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  type Location,
  type LocationListVariables,
} from "@/lib/graphql/inventory-operations";
import { useLocationList } from "@/lib/graphql/inventory-hooks";

/** Props for a location list item. */
type LocationListItemProps = {
  /** Location data returned by the API. */
  location: Location;
  /** Whether the location is currently selected. */
  isSelected: boolean;
  /** Callback fired when the user selects the location. */
  onSelect: (location: Location) => void;
  /** Card border color derived from theme. */
  borderColor: string;
  /** Card background color derived from theme. */
  backgroundColor: string;
  /** Highlight color used for selected state. */
  highlightColor: string;
  /** Muted text color used for secondary labels. */
  mutedColor: string;
};

/** Limits the number of locations fetched per request. */
const LOCATION_LIST_LIMIT = 60;

/**
 * Render a location card for the selection list.
 */
function LocationListItem({
  location,
  isSelected,
  onSelect,
  borderColor,
  backgroundColor,
  highlightColor,
  mutedColor,
}: LocationListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(location);
  }, [location, onSelect]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderColor, backgroundColor },
        isSelected ? { borderColor: highlightColor } : null,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir le lieu ${location.locationname}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <ThemedText type="defaultSemiBold">
            {location.locationname}
          </ThemedText>
          {location.parent ? (
            <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
              Parent: {location.parent.locationname}
            </ThemedText>
          ) : null}
          {location.desc ? (
            <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
              {location.desc}
            </ThemedText>
          ) : null}
          {location.barcode ? (
            <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
              Code: {location.barcode}
            </ThemedText>
          ) : null}
        </View>
        {isSelected ? (
          <View
            style={[styles.selectedBadge, { backgroundColor: highlightColor }]}
          >
            <ThemedText style={styles.selectedBadgeText}>Selectionne</ThemedText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Location selection screen for the comptage flow.
 */
export default function LocationSelectionScreen() {
  const router = useRouter();
  const { session, setLocation, setGroup } = useComptageSession();
  const [searchText, setSearchText] = useState<string>("");
  const [barcodeText, setBarcodeText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupId = session.group?.id ?? null;
  const selectedLocationId = session.location?.id ?? null;

  const queryVariables = useMemo<LocationListVariables>(
    () => ({
      nameContains: searchText.trim() || null,
      barcode: barcodeText.trim() || null,
      limit: LOCATION_LIST_LIMIT,
    }),
    [barcodeText, searchText]
  );

  const { locations, loading, errorMessage, refetch } = useLocationList(
    queryVariables,
    { skip: !groupId }
  );

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

  /** Update the search query used to filter locations. */
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  /** Update the barcode input used to filter locations. */
  const handleBarcodeChange = useCallback((value: string) => {
    setBarcodeText(value);
  }, []);

  /** Store the selected location and navigate to the scan screen. */
  const handleSelectLocation = useCallback(
    (location: Location) => {
      setLocation(location);
      router.push("/(drawer)/scan");
    },
    [router, setLocation]
  );

  /** Navigate back to the group selection and reset selection. */
  const handleChangeGroup = useCallback(() => {
    setGroup(null);
    router.push("/(drawer)/groupes");
  }, [router, setGroup]);

  /** Retry location list retrieval after an error. */
  const handleRetry = useCallback(() => {
    refetch(queryVariables);
  }, [queryVariables, refetch]);

  /** Refresh the location list via pull-to-refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch(queryVariables);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryVariables, refetch]);

  /** Render a single location list row. */
  const renderItem = useCallback(
    ({ item }: { item: Location }) => (
      <LocationListItem
        location={item}
        isSelected={item.id === selectedLocationId}
        onSelect={handleSelectLocation}
        borderColor={borderColor}
        backgroundColor={surfaceColor}
        highlightColor={highlightColor}
        mutedColor={mutedColor}
      />
    ),
    [
      borderColor,
      handleSelectLocation,
      highlightColor,
      mutedColor,
      selectedLocationId,
      surfaceColor,
    ]
  );

  /** Provide stable keys for the location list. */
  const keyExtractor = useCallback((item: Location) => item.id, []);

  const showInitialLoading = loading && locations.length === 0 && !isRefreshing;
  const showInlineError = Boolean(errorMessage && locations.length > 0);

  /** Render the list header with group context and search. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <ThemedText type="title">Lieux</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Selectionnez le lieu de comptage.
          </ThemedText>
        </View>

        <View style={styles.groupBanner}>
          <View style={styles.groupInfo}>
            <ThemedText type="defaultSemiBold">
              Groupe: {session.group?.nom}
            </ThemedText>
            <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
              Appareil: {session.group?.appareil_identifiant}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.changeButton, { borderColor }]}
            onPress={handleChangeGroup}
          >
            <ThemedText style={styles.changeButtonText}>Changer</ThemedText>
          </TouchableOpacity>
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
            placeholder="Rechercher un lieu"
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            value={searchText}
            onChangeText={handleSearchChange}
          />
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
            placeholder="Scanner ou saisir un code barre"
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            value={barcodeText}
            onChangeText={handleBarcodeChange}
          />
        </View>

        {selectedLocationId ? (
          <View style={[styles.selectedBanner, { borderColor }]}>
            <ThemedText type="defaultSemiBold">Lieu selectionne</ThemedText>
            <ThemedText style={{ color: mutedColor }}>
              {session.location?.locationname}
            </ThemedText>
          </View>
        ) : null}

        {showInlineError ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorTitle}>
              Impossible de charger les lieux.
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
    barcodeText,
    borderColor,
    errorMessage,
    handleBarcodeChange,
    handleChangeGroup,
    handleRetry,
    handleSearchChange,
    highlightColor,
    inputTextColor,
    mutedColor,
    placeholderColor,
    searchText,
    selectedLocationId,
    session.group?.appareil_identifiant,
    session.group?.nom,
    session.location?.locationname,
    showInlineError,
    surfaceColor,
  ]);

  /** Render the empty/loading state for the location list. */
  const renderEmptyComponent = useCallback(() => {
    if (showInitialLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={highlightColor} />
          <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
            Chargement des lieux...
          </ThemedText>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorTitle}>
            Impossible de charger les lieux.
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
        <ThemedText type="subtitle">Aucun lieu trouve.</ThemedText>
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

  if (!groupId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <ThemedText type="title">Aucun groupe selectionne</ThemedText>
          <ThemedText style={[styles.missingText, { color: mutedColor }]}>
            Retournez a la liste des groupes pour continuer.
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: highlightColor }]}
            onPress={handleChangeGroup}
          >
            <ThemedText style={styles.retryButtonText}>
              Voir les groupes
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={locations}
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
  groupBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  groupInfo: {
    flex: 1,
    gap: 4,
  },
  changeButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "600",
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
  cardMeta: {
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
  missingContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  missingText: {
    fontSize: 14,
    textAlign: "center",
  },
});
