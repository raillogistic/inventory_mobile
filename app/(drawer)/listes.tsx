import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { useThemeColor } from "@/hooks/use-theme-color";
import { type OfflineArticleEntry } from "@/lib/graphql/inventory-operations";

/** Article row displayed under a location section. */
type ArticleListItem = {
  /** Article identifier. */
  id: string;
  /** Article code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Current location label for the article. */
  currentLocationName: string | null;
};

/** Section payload used to render articles grouped by location. */
type LocationSection = {
  /** Location identifier. */
  id: string;
  /** Location label shown in the section header. */
  title: string;
  /** Articles belonging to the location. */
  data: ArticleListItem[];
};

/** Placeholder key for articles without a current location. */
const UNKNOWN_LOCATION_KEY = "unknown-location";

/**
 * Build location-based sections from offline article entries.
 */
function buildLocationSections(
  articles: OfflineArticleEntry[]
): LocationSection[] {
  const sections = new Map<string, LocationSection>();

  for (const article of articles) {
    const location = article.currentLocation;
    const locationId = location?.id ?? UNKNOWN_LOCATION_KEY;
    const locationName = location?.locationname ?? "Sans localisation";
    const section =
      sections.get(locationId) ??
      {
        id: locationId,
        title: locationName,
        data: [],
      };

    section.data.push({
      id: article.id,
      code: article.code,
      description: article.desc ?? null,
      currentLocationName: article.currentLocation?.locationname ?? null,
    });
    sections.set(locationId, section);
  }

  const result = Array.from(sections.values());
  for (const section of result) {
    section.data.sort((a, b) => a.code.localeCompare(b.code));
  }

  return result.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Article list screen grouped by current location.
 */
export default function ListesScreen() {
  const { cache, isHydrated, isSyncing, syncAll, syncError } =
    useInventoryOffline();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sections = useMemo(
    () => buildLocationSections(cache.articles),
    [cache.articles]
  );
  const hasArticles = cache.articles.length > 0;
  const isLoading = !isHydrated || (isSyncing && !hasArticles);

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

  /** Refresh offline cache when the user pulls to refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncAll]);

  /** Render a single article row. */
  const renderItem = useCallback(
    ({ item }: { item: ArticleListItem }) => (
      <View
        style={[
          styles.articleCard,
          { borderColor, backgroundColor: surfaceColor },
        ]}
      >
        <ThemedText type="defaultSemiBold">{item.code}</ThemedText>
        <ThemedText style={[styles.articleDesc, { color: mutedColor }]}>
          {item.description ?? "Description inconnue"}
        </ThemedText>
        <ThemedText style={[styles.articleLocation, { color: mutedColor }]}>
          {item.currentLocationName ?? "Sans localisation"}
        </ThemedText>
      </View>
    ),
    [borderColor, mutedColor, surfaceColor]
  );

  /** Render a section header for a location. */
  const renderSectionHeader = useCallback(
    ({ section }: { section: LocationSection }) => (
      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle">{section.title}</ThemedText>
        <ThemedText style={[styles.sectionCount, { color: mutedColor }]}>
          {section.data.length} article(s)
        </ThemedText>
      </View>
    ),
    [mutedColor]
  );

  /** Render the empty or loading state. */
  const renderEmptyComponent = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={highlightColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            Chargement des articles...
          </ThemedText>
        </View>
      );
    }

    if (syncError) {
      return (
        <View style={styles.errorState}>
          <ThemedText style={styles.errorTitle}>
            Impossible de charger les articles.
          </ThemedText>
          <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
            {syncError}
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: highlightColor }]}
            onPress={handleRefresh}
          >
            <ThemedText style={styles.retryButtonText}>Reessayer</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <ThemedText type="subtitle">Aucun article enregistre</ThemedText>
        <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
          Lancez une synchronisation pour charger les articles.
        </ThemedText>
      </View>
    );
  }, [handleRefresh, highlightColor, isLoading, mutedColor, syncError]);

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  sectionHeader: {
    paddingVertical: 8,
    gap: 4,
  },
  sectionCount: {
    fontSize: 12,
  },
  articleCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  articleDesc: {
    fontSize: 13,
  },
  articleLocation: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorState: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
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
});
