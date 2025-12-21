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
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { useThemeColor } from "@/hooks/use-theme-color";
import { type Location } from "@/lib/graphql/inventory-operations";

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

/**
 * Normalize a search value for case-insensitive matching.
 */
function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Build a set of authorized location ids from the selected group.
 */
function buildAuthorizedLocationIdSet(
  locations: Location[] | null | undefined
): Set<string> {
  const ids = new Set<string>();

  for (const location of locations ?? []) {
    ids.add(location.id);
  }

  return ids;
}

/**
 * Filter locations for the current hierarchy level and search input.
 */
function filterLocationsForLevel(
  locations: Location[],
  parentId: string | null,
  searchValue: string,
  barcodeValue: string
): Location[] {
  const normalizedSearch = normalizeSearchValue(searchValue);
  const trimmedBarcode = barcodeValue.trim();

  const filtered = locations.filter((location) => {
    const matchesParent = parentId
      ? location.parent?.id === parentId
      : !location.parent;
    if (!matchesParent) {
      return false;
    }

    if (trimmedBarcode) {
      const barcode = location.barcode?.trim() ?? "";
      if (barcode !== trimmedBarcode) {
        return false;
      }
    }

    if (normalizedSearch) {
      const name = location.locationname.toLowerCase();
      if (!name.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });

  return filtered
    .sort((a, b) => a.locationname.localeCompare(b.locationname))
    .slice(0, LOCATION_LIST_LIMIT);
}

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
export type LocationTrailItem = {
  /** Unique identifier for the location. */
  id: string;
  /** Display name for the location. */
  locationname: string;
  /** Optional description. */
  desc: string | null;
  /** Optional barcode. */
  barcode: string | null;
};

export type LocationLevelScreenProps = {
  /** Parent location for this level, if any. */
  parentLocation: Location | null;
  /** Trail of parent locations leading to this level. */
  parentTrail: LocationTrailItem[];
};

/** Props for the location list header. */
type LocationHeaderProps = {
  /** Selected group label. */
  groupName: string | null | undefined;
  /** Selected device label. */
  deviceName: string | null | undefined;
  /** Current parent location. */
  parentLocation: Location | null;
  /** Current search text value. */
  searchText: string;
  /** Current barcode text value. */
  barcodeText: string;
  /** Called when the search text changes. */
  onSearchChange: (value: string) => void;
  /** Called when the barcode text changes. */
  onBarcodeChange: (value: string) => void;
  /** Called when the user wants to go back. */
  onBack: () => void;
  /** Called when the user wants to change group. */
  onChangeGroup: () => void;
  /** Border color for cards. */
  borderColor: string;
  /** Surface background color. */
  surfaceColor: string;
  /** Muted text color. */
  mutedColor: string;
  /** Input text color. */
  inputTextColor: string;
  /** Placeholder text color. */
  placeholderColor: string;
  /** Regular text color. */
  textColor: string;
};

/**
 * Header for the location list with search and group context.
 */
const LocationHeader = React.memo(function LocationHeader({
  groupName,
  deviceName,
  parentLocation,
  searchText,
  barcodeText,
  onSearchChange,
  onBarcodeChange,
  onBack,
  onChangeGroup,
  borderColor,
  surfaceColor,
  mutedColor,
  inputTextColor,
  placeholderColor,
  textColor,
}: LocationHeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {parentLocation ? (
            <TouchableOpacity
              style={[styles.backButton, { borderColor }]}
              onPress={onBack}
            >
              <IconSymbol name="chevron.left" size={16} color={textColor} />
              <ThemedText style={styles.backButtonText}>Retour</ThemedText>
            </TouchableOpacity>
          ) : null}
          <ThemedText type="title">
            {parentLocation ? `Sous-lieux` : "Lieux"}
          </ThemedText>
        </View>
        <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
          {parentLocation
            ? `Selectionnez un sous-lieu de ${parentLocation.locationname}.`
            : "Selectionnez le lieu de comptage."}
        </ThemedText>
      </View>

      <View style={styles.groupBanner}>
        <View style={styles.groupInfo}>
          <ThemedText type="defaultSemiBold">Groupe: {groupName}</ThemedText>
          <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
            Appareil: {deviceName}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.changeButton, { borderColor }]}
          onPress={onChangeGroup}
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
          onChangeText={onSearchChange}
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
          onChangeText={onBarcodeChange}
        />
      </View>
    </View>
  );
});

/**
 * Location selection screen for a single hierarchy level.
 */
export function LocationLevelScreen({
  parentLocation,
  parentTrail,
}: LocationLevelScreenProps) {
  const router = useRouter();
  const { session, setGroup, setLocation } = useComptageSession();
  const { cache, isHydrated, isSyncing, syncError, syncAll } =
    useInventoryOffline();
  const [searchText, setSearchText] = useState<string>("");
  const [barcodeText, setBarcodeText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupId = session.group?.id ?? null;
  const parentId = parentLocation?.id ?? null;

  const authorizedLocationIds = useMemo(
    () => buildAuthorizedLocationIdSet(session.group?.lieux_autorises),
    [session.group?.lieux_autorises]
  );

  const authorizedLocations = useMemo(() => {
    if (!groupId) {
      return [];
    }

    return cache.locations.filter((location) =>
      authorizedLocationIds.has(location.id)
    );
  }, [authorizedLocationIds, cache.locations, groupId]);

  const locations = useMemo(
    () =>
      filterLocationsForLevel(
        authorizedLocations,
        parentId,
        searchText,
        barcodeText
      ),
    [authorizedLocations, barcodeText, parentId, searchText]
  );
  const hasLocations = authorizedLocations.length > 0;
  const isLoading = !isHydrated || (isSyncing && !hasLocations);
  const errorMessage = syncError;

  const borderColor = useThemeColor(
    { light: "#E2E8F0", dark: "#2B2E35" },
    "icon"
  );
  const surfaceColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const highlightColor = useThemeColor(
    { light: "#2563EB", dark: "#60A5FA" },
    "tint"
  );
  const mutedColor = useThemeColor(
    { light: "#64748B", dark: "#94A3B8" },
    "icon"
  );
  const inputTextColor = useThemeColor({}, "text");
  const textColor = useThemeColor({}, "text");
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
        const nextTrail = parentLocation
          ? [...parentTrail, parentLocation]
          : parentTrail;
        router.push({
          pathname: "/(drawer)/lieux/[parentId]",
          params: {
            parentId: location.id,
            parentName: location.locationname,
            parentDesc: location.desc ?? "",
            parentBarcode: location.barcode ?? "",
            parentTrail: JSON.stringify(nextTrail),
          },
        });
        return;
      }

      setLocation(location);
      router.push("/(drawer)/scan");
    },
    [parentLocation, parentTrail, router, setLocation]
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

  /** Navigate back within the location hierarchy. */
  const handleBack = useCallback(() => {
    if (!parentLocation) {
      return;
    }
    if (parentTrail.length === 0) {
      router.replace("/(drawer)/lieux");
      return;
    }
    const nextParent = parentTrail[parentTrail.length - 1];
    const nextTrail = parentTrail.slice(0, -1);
    router.replace({
      pathname: "/(drawer)/lieux/[parentId]",
      params: {
        parentId: nextParent.id,
        parentName: nextParent.locationname,
        parentDesc: nextParent.desc ?? "",
        parentBarcode: nextParent.barcode ?? "",
        parentTrail: JSON.stringify(nextTrail),
      },
    });
  }, [parentLocation, parentTrail, router]);

  /** Retry location list retrieval after an error. */
  const handleRetry = useCallback(() => {
    void syncAll();
  }, [syncAll]);

  /** Refresh the location list via pull-to-refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncAll]);

  /** Build a lookup of location ids that have children. */
  const hasChildrenById = useMemo(() => {
    const map = new Map<string, boolean>();
    if (locations.length === 0) {
      return map;
    }

    const parentIds = new Set<string>(locations.map((location) => location.id));

    for (const child of authorizedLocations) {
      const parentIdValue = child.parent?.id;
      if (parentIdValue && parentIds.has(parentIdValue)) {
        map.set(parentIdValue, true);
      }
    }
    return map;
  }, [authorizedLocations, locations]);

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

  const showInitialLoading = isLoading && locations.length === 0 && !isRefreshing;

  const headerElement = useMemo(
    () => (
      <LocationHeader
        groupName={session.group?.nom}
        deviceName={session.group?.appareil_identifiant}
        parentLocation={parentLocation}
        searchText={searchText}
        barcodeText={barcodeText}
        onSearchChange={handleSearchChange}
        onBarcodeChange={handleBarcodeChange}
        onBack={handleBack}
        onChangeGroup={handleChangeGroup}
        borderColor={borderColor}
        surfaceColor={surfaceColor}
        mutedColor={mutedColor}
        inputTextColor={inputTextColor}
        placeholderColor={placeholderColor}
        textColor={textColor}
      />
    ),
    [
      barcodeText,
      borderColor,
      handleBarcodeChange,
      handleBack,
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
      textColor,
    ]
  );

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
        ListHeaderComponent={headerElement}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: "600",
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
