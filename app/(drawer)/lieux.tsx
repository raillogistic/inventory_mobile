import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  /** Whether the card is rendered as a nested child item. */
  isChild?: boolean;
  /** Whether to display the parent label under the location name. */
  showParent?: boolean;
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
/** Limits the number of child locations fetched per request. */
const CHILD_LOCATION_LIMIT = 200;

/**
 * Render a location card for the selection list.
 */
function LocationListItem({
  location,
  isSelected,
  isChild = false,
  showParent = true,
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
        isChild ? styles.childCard : null,
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
          {showParent && location.parent ? (
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
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const groupId = session.group?.id ?? null;
  const selectedLocationId = session.location?.id ?? null;

  const trimmedSearch = searchText.trim();
  const trimmedBarcode = barcodeText.trim();
  const shouldShowHierarchy = trimmedSearch.length === 0 && trimmedBarcode.length === 0;

  const queryVariables = useMemo<LocationListVariables>(
    () => ({
      nameContains: trimmedSearch || null,
      barcode: trimmedBarcode || null,
      parentIsNull: shouldShowHierarchy ? true : null,
      limit: LOCATION_LIST_LIMIT,
    }),
    [shouldShowHierarchy, trimmedBarcode, trimmedSearch]
  );

  const { locations, loading, errorMessage, refetch } = useLocationList(
    queryVariables,
    { skip: !groupId }
  );

  const parentIds = useMemo(() => {
    if (!shouldShowHierarchy) {
      return [];
    }
    return locations.map((location) => location.id);
  }, [locations, shouldShowHierarchy]);

  const childQueryVariables = useMemo<LocationListVariables>(
    () => ({
      parentIn: parentIds.length > 0 ? parentIds : null,
      limit: CHILD_LOCATION_LIMIT,
    }),
    [parentIds]
  );

  const childQuerySkip = !groupId || parentIds.length === 0 || !shouldShowHierarchy;

  const {
    locations: childLocations,
    loading: childLoading,
    errorMessage: childErrorMessage,
    refetch: refetchChildren,
  } = useLocationList(childQueryVariables, { skip: childQuerySkip });

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

  /** Clear expanded parents when switching filters or group. */
  useEffect(() => {
    setExpandedParents({});
  }, [groupId, trimmedBarcode, trimmedSearch]);

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
    const refreshCalls = [refetch(queryVariables)];
    if (!childQuerySkip) {
      refreshCalls.push(refetchChildren(childQueryVariables));
    }
    void Promise.all(refreshCalls);
  }, [childQuerySkip, childQueryVariables, queryVariables, refetch, refetchChildren]);

  /** Refresh the location list via pull-to-refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshCalls = [refetch(queryVariables)];
      if (!childQuerySkip) {
        refreshCalls.push(refetchChildren(childQueryVariables));
      }
      await Promise.all(refreshCalls);
    } finally {
      setIsRefreshing(false);
    }
  }, [childQuerySkip, childQueryVariables, queryVariables, refetch, refetchChildren]);

  /** Toggle the visibility of child locations for a parent. */
  const handleToggleChildren = useCallback((parentId: string) => {
    setExpandedParents((current) => ({
      ...current,
      [parentId]: !current[parentId],
    }));
  }, []);

  /** Group child locations by their parent id. */
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Location[]>();
    for (const child of childLocations) {
      const parentId = child.parent?.id;
      if (!parentId) {
        continue;
      }
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId)?.push(child);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.locationname.localeCompare(b.locationname));
    }

    return map;
  }, [childLocations]);

  /** Render a single location list row with optional children. */
  const renderItem = useCallback(
    ({ item }: { item: Location }) => {
      const children = childrenByParent.get(item.id) ?? [];
      const hasChildren = shouldShowHierarchy && children.length > 0;
      const isExpanded = expandedParents[item.id] ?? false;
      const childCountLabel =
        children.length === 1 ? "1 sous-lieu" : `${children.length} sous-lieux`;

      return (
        <View style={styles.locationGroup}>
          <LocationListItem
            location={item}
            isSelected={item.id === selectedLocationId}
            onSelect={handleSelectLocation}
            borderColor={borderColor}
            backgroundColor={surfaceColor}
            highlightColor={highlightColor}
            mutedColor={mutedColor}
          />

          {hasChildren ? (
            <TouchableOpacity
              style={[styles.childToggle, { borderColor }]}
              onPress={() => handleToggleChildren(item.id)}
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded ? "Masquer les sous-lieux" : "Afficher les sous-lieux"
              }
            >
              <ThemedText style={styles.childToggleText}>
                {isExpanded ? "Masquer les sous-lieux" : `Voir ${childCountLabel}`}
              </ThemedText>
            </TouchableOpacity>
          ) : null}

          {hasChildren && isExpanded ? (
            <View style={styles.childList}>
              {childLoading && children.length === 0 ? (
                <View style={styles.childLoading}>
                  <ActivityIndicator size="small" color={highlightColor} />
                  <ThemedText style={[styles.childLoadingText, { color: mutedColor }]}>
                    Chargement des sous-lieux...
                  </ThemedText>
                </View>
              ) : null}

              {children.map((child) => (
                <LocationListItem
                  key={child.id}
                  location={child}
                  isSelected={child.id === selectedLocationId}
                  isChild
                  showParent={false}
                  onSelect={handleSelectLocation}
                  borderColor={borderColor}
                  backgroundColor={surfaceColor}
                  highlightColor={highlightColor}
                  mutedColor={mutedColor}
                />
              ))}

              {childErrorMessage ? (
                <ThemedText style={[styles.childErrorText, { color: mutedColor }]}>
                  Impossible de charger les sous-lieux.
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [
      borderColor,
      childErrorMessage,
      childLoading,
      childrenByParent,
      expandedParents,
      handleSelectLocation,
      handleToggleChildren,
      highlightColor,
      mutedColor,
      selectedLocationId,
      shouldShowHierarchy,
      surfaceColor,
    ]
  );

  /** Provide stable keys for the location list. */
  const keyExtractor = useCallback((item: Location) => item.id, []);

  const combinedErrorMessage = errorMessage ?? childErrorMessage ?? null;
  const showInitialLoading = loading && locations.length === 0 && !isRefreshing;
  const showInlineError = Boolean(combinedErrorMessage && locations.length > 0);

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
              {combinedErrorMessage}
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
    combinedErrorMessage,
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

    if (combinedErrorMessage) {
      return (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorTitle}>
            Impossible de charger les lieux.
          </ThemedText>
          <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
            {combinedErrorMessage}
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
    combinedErrorMessage,
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
  locationGroup: {
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  childCard: {
    marginLeft: 16,
    padding: 12,
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
  childToggle: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 6,
  },
  childToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  childList: {
    gap: 8,
    marginLeft: 4,
  },
  childLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    marginLeft: 16,
  },
  childLoadingText: {
    fontSize: 12,
  },
  childErrorText: {
    fontSize: 12,
    marginLeft: 16,
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
