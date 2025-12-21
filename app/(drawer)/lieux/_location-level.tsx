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
  /** Whether the card should display an expansion hint. */
  hasChildren: boolean;
  /** Callback fired when the user selects the location. */
  onSelect: (location: Location, hasChildren: boolean) => void;
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
const LOCATION_LIST_LIMIT = 80;
/** Limits the number of child locations fetched per request. */
const CHILD_LOCATION_LIMIT = 200;

/**
 * Render a location card for the selection list.
 */
function LocationListItem({
  location,
  hasChildren,
  onSelect,
  borderColor,
  backgroundColor,
  highlightColor,
  mutedColor,
}: LocationListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(location, hasChildren);
  }, [hasChildren, location, onSelect]);

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor, backgroundColor }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir le lieu ${location.locationname}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <ThemedText type="defaultSemiBold">
            {location.locationname}
          </ThemedText>
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
        {hasChildren ? (
          <View style={[styles.childBadge, { borderColor: highlightColor }]}>
            <ThemedText style={styles.childBadgeText}>Sublieux</ThemedText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** Props for the location level screen. */
export type LocationLevelScreenProps = {
  /** Parent location for this level, if any. */
  parentLocation: Location | null;
};

/**
 * Location selection screen for a single hierarchy level.
 */
export function LocationLevelScreen({ parentLocation }: LocationLevelScreenProps) {
  const router = useRouter();
  const { session, setGroup, setLocation } = useComptageSession();
  const [searchText, setSearchText] = useState<string>("");
  const [barcodeText, setBarcodeText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupId = session.group?.id ?? null;
  const parentId = parentLocation?.id ?? null;
  const trimmedSearch = searchText.trim();
  const trimmedBarcode = barcodeText.trim();

  const queryVariables = useMemo<LocationListVariables>(
    () => ({
      nameContains: trimmedSearch || null,
      barcode: trimmedBarcode || null,
      parent: parentId ?? null,
      parentIsNull: parentId ? null : true,
      limit: LOCATION_LIST_LIMIT,
    }),
    [parentId, trimmedBarcode, trimmedSearch]
  );

  const { locations, loading, errorMessage, refetch } = useLocationList(
    queryVariables,
    { skip: !groupId }
  );

  const parentIds = useMemo(
    () => locations.map((location) => location.id),
    [locations]
  );

  const childQueryVariables = useMemo<LocationListVariables>(
    () => ({
      parentIn: parentIds.length > 0 ? parentIds : null,
      limit: CHILD_LOCATION_LIMIT,
    }),
    [parentIds]
  );

  const childQuerySkip = !groupId || parentIds.length === 0;

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

  /** Clear filters when switching group. */
  useEffect(() => {
    setSearchText("");
    setBarcodeText("");
  }, [groupId, parentId]);

  /** Navigate to next level or select the location if it is a leaf. */
  const handleSelectLocation = useCallback(
    (location: Location, hasChildren: boolean) => {
      if (hasChildren) {
        router.push({
          pathname: "/(drawer)/lieux/[parentId]",
          params: {
            parentId: location.id,
            parentName: location.locationname,
            parentDesc: location.desc ?? "",
            parentBarcode: location.barcode ?? "",
          },
        });
        return;
      }

      setLocation(location);
      router.push("/(drawer)/scan");
    },
    [router, setLocation]
  );

  /** Select the current parent location for scanning. */
  const handleSelectParent = useCallback(() => {
    if (!parentLocation) {
      return;
    }
    setLocation(parentLocation);
    router.push("/(drawer)/scan");
  }, [parentLocation, router, setLocation]);

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

  /** Build a lookup of location ids that have children. */
  const hasChildrenById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const child of childLocations) {
      const parentIdValue = child.parent?.id;
      if (parentIdValue) {
        map.set(parentIdValue, true);
      }
    }
    return map;
  }, [childLocations]);

  /** Render a single location list row with child hint. */
  const renderItem = useCallback(
    ({ item }: { item: Location }) => {
      const hasChildren = hasChildrenById.get(item.id) ?? false;
      return (
        <LocationListItem
          location={item}
          hasChildren={hasChildren}
          onSelect={handleSelectLocation}
          borderColor={borderColor}
          backgroundColor={surfaceColor}
          highlightColor={highlightColor}
          mutedColor={mutedColor}
        />
      );
    },
    [
      borderColor,
      handleSelectLocation,
      hasChildrenById,
      highlightColor,
      mutedColor,
      surfaceColor,
    ]
  );

  /** Provide stable keys for the location list. */
  const keyExtractor = useCallback((item: Location) => item.id, []);

  const combinedErrorMessage = errorMessage ?? childErrorMessage ?? null;
  const showInitialLoading = loading && locations.length === 0 && !isRefreshing;

  /** Render the list header with group context and search. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <ThemedText type="title">
            {parentLocation ? `Sous-lieux` : "Lieux"}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            {parentLocation
              ? `Selectionnez un sous-lieu de ${parentLocation.locationname}.`
              : "Selectionnez le lieu de comptage."}
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
      </View>
    );
  }, [
    barcodeText,
    borderColor,
    handleBarcodeChange,
    handleChangeGroup,
    handleSearchChange,
    inputTextColor,
    mutedColor,
    parentLocation,
    placeholderColor,
    searchText,
    session.group?.appareil_identifiant,
    session.group?.nom,
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

  /** Render the footer with parent selection when available. */
  const renderFooter = useCallback(() => {
    if (!parentLocation) {
      return null;
    }

    return (
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.parentButton, { backgroundColor: highlightColor }]}
          onPress={handleSelectParent}
        >
          <ThemedText style={styles.parentButtonText}>
            Scanner "{parentLocation.locationname}"
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }, [handleSelectParent, highlightColor, parentLocation]);

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
        ListFooterComponent={renderFooter}
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
  childBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  childBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  footer: {
    marginTop: 16,
  },
  parentButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  parentButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
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
