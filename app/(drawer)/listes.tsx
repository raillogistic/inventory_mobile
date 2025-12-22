/**
 * @fileoverview Écran de liste des articles regroupés par localisation avec design premium.
 * Affiche les articles de l'inventaire hors ligne groupés par leur emplacement actuel.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
} from "@/components/ui/premium-theme";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { type OfflineArticleEntry } from "@/lib/graphql/inventory-operations";

/**
 * Article affiché sous une section de localisation.
 */
type ArticleListItem = {
  /** Identifiant de l'article */
  id: string;
  /** Code de l'article */
  code: string;
  /** Description optionnelle */
  description: string | null;
  /** Nom de la localisation actuelle */
  currentLocationName: string | null;
};

/**
 * Section représentant une localisation avec ses articles.
 */
type LocationSection = {
  /** Identifiant de la localisation */
  id: string;
  /** Titre affiché dans l'en-tête de section */
  title: string;
  /** Articles appartenant à cette localisation */
  data: ArticleListItem[];
};

/** Clé pour les articles sans localisation */
const UNKNOWN_LOCATION_KEY = "unknown-location";

/**
 * Normalise une valeur pour la recherche.
 */
function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Indique si un article correspond à une recherche.
 */
function matchesArticleSearch(
  article: OfflineArticleEntry,
  query: string
): boolean {
  if (!query) {
    return true;
  }

  const code = normalizeSearchValue(article.code);
  const description = normalizeSearchValue(article.desc ?? "");
  return code.includes(query) || description.includes(query);
}

/**
 * Filtre les articles par recherche (code ou description).
 */
function filterArticlesByQuery(
  articles: OfflineArticleEntry[],
  query: string
): OfflineArticleEntry[] {
  const normalized = normalizeSearchValue(query);
  return articles.filter((article) =>
    matchesArticleSearch(article, normalized)
  );
}

/**
 * Construit les sections par localisation à partir des articles hors ligne.
 * @param articles - Liste des articles
 * @returns Sections triées par nom de localisation
 */
function buildLocationSections(
  articles: OfflineArticleEntry[]
): LocationSection[] {
  const sections = new Map<string, LocationSection>();

  for (const article of articles) {
    const location = article.currentLocation;
    const locationId = location?.id ?? UNKNOWN_LOCATION_KEY;
    const locationName = location?.locationname ?? "Sans localisation";
    const section = sections.get(locationId) ?? {
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
 * Écran de liste des articles avec design premium.
 * Articles regroupés par leur localisation actuelle.
 */
export default function ListesScreen() {
  const { cache, isHydrated, isSyncing, syncAll, syncError } =
    useInventoryOffline();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchInputRef = useRef<string>("");
  const [appliedQuery, setAppliedQuery] = useState<string>("");
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    () => new Set()
  );

  const filteredArticles = useMemo(
    () => filterArticlesByQuery(cache.articles, appliedQuery),
    [appliedQuery, cache.articles]
  );
  const sections = useMemo(
    () => buildLocationSections(filteredArticles),
    [filteredArticles]
  );
  const hasArticles = cache.articles.length > 0;
  const isLoading = !isHydrated || (isSyncing && !hasArticles);
  const hasSearch = normalizeSearchValue(appliedQuery).length > 0;
  const visibleArticleCount = hasSearch
    ? filteredArticles.length
    : cache.articles.length;

  /** Rafra?chit le cache hors ligne. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncAll]);

  /** Met ? jour la recherche. */
  const handleSearchChange = useCallback((value: string) => {
    searchInputRef.current = value;
  }, []);

  /** Applique la recherche saisie et ouvre les sections concernées. */
  const handleSearchSubmit = useCallback(() => {
    const normalized = normalizeSearchValue(searchInputRef.current);
    setAppliedQuery(normalized);

    if (!normalized) {
      setExpandedLocations(new Set());
      return;
    }

    const matches = filterArticlesByQuery(cache.articles, normalized);
    const resultSections = buildLocationSections(matches);
    setExpandedLocations(new Set(resultSections.map((section) => section.id)));
  }, [cache.articles]);

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

  /** Rend une ligne d'article. */
  const renderItem = useCallback(
    (item: ArticleListItem) => (
      <View style={styles.article_card}>
        <View style={styles.article_icon}>
          <IconSymbol
            name="shippingbox"
            size={18}
            color={PREMIUM_COLORS.accent_primary}
          />
        </View>
        <View style={styles.article_content}>
          <Text style={styles.article_code}>{item.code}</Text>
          <Text style={styles.article_description} numberOfLines={1}>
            {item.description ?? "Description inconnue"}
          </Text>
          <View style={styles.article_location_row}>
            <IconSymbol
              name="mappin"
              size={12}
              color={PREMIUM_COLORS.text_muted}
            />
            <Text style={styles.article_location}>
              {item.currentLocationName ?? "Sans localisation"}
            </Text>
          </View>
        </View>
      </View>
    ),
    []
  );

  /** Rend une section accord?on avec ses articles. */
  const renderSection = useCallback(
    ({ item }: { item: LocationSection }) => {
      const isExpanded = expandedLocations.has(item.id);
      () => (
        <View style={styles.section_block}>
          <TouchableOpacity
            style={styles.section_header}
            onPress={() => handleToggleLocation(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.section_header_content}>
              <IconSymbol
                name="folder.fill"
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
              {item.data.map((article) => (
                <View key={article.id}>{renderItem(article)}</View>
              ))}
            </View>
          ) : null}
        </View>
      );
    },
    [expandedLocations, handleToggleLocation, renderItem]
  );

  /** Rend l'en-t?te de la liste. */
  const headerElement = useMemo(
    () => (
      <View style={styles.header_section}>
        <BlurView intensity={20} tint="dark" style={styles.header_blur}>
          <View style={styles.header_card}>
            <View style={styles.header_row}>
              <View style={styles.header_icon}>
                <IconSymbol
                  name="list.bullet.rectangle.fill"
                  size={24}
                  color={PREMIUM_COLORS.accent_primary}
                />
              </View>
              <View style={styles.header_text}>
                <Text style={styles.header_title}>Listes</Text>
                <Text style={styles.header_subtitle}>
                  {visibleArticleCount} article(s) - {sections.length} lieu(x)
                </Text>
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

            <View style={styles.search_container}>
              <IconSymbol
                name="magnifyingglass"
                size={16}
                color={PREMIUM_COLORS.text_muted}
              />
              <TextInput
                style={styles.search_input}
                placeholder="Rechercher par code ou description"
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                onChangeText={handleSearchChange}
                onSubmitEditing={handleSearchSubmit}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            <TouchableOpacity
              style={styles.search_button}
              onPress={handleSearchSubmit}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[
                  PREMIUM_COLORS.accent_secondary,
                  PREMIUM_COLORS.accent_primary,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.search_button_gradient}
              >
                <IconSymbol
                  name="magnifyingglass"
                  size={16}
                  color={PREMIUM_COLORS.text_primary}
                />
                <Text style={styles.search_button_text}>Rechercher</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.refresh_button}
              onPress={handleRefresh}
              disabled={isRefreshing}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={
                  isRefreshing
                    ? [PREMIUM_COLORS.glass_bg, PREMIUM_COLORS.glass_bg]
                    : [
                        PREMIUM_COLORS.accent_primary,
                        PREMIUM_COLORS.accent_secondary,
                      ]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.refresh_button_gradient}
              >
                <IconSymbol
                  name="arrow.clockwise"
                  size={16}
                  color={PREMIUM_COLORS.text_primary}
                />
                <Text style={styles.refresh_button_text}>
                  {isRefreshing ? "Actualisation..." : "Actualiser"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {syncError && (
              <View style={styles.error_container}>
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={18}
                  color={PREMIUM_COLORS.error}
                />
                <Text style={styles.error_text}>{syncError}</Text>
              </View>
            )}
          </View>
        </BlurView>
      </View>
    ),
    [
      handleRefresh,
      handleSearchChange,
      handleSearchSubmit,
      isRefreshing,
      sections.length,
      syncError,
      visibleArticleCount,
    ]
  );

  /** Rend l'?tat vide ou de chargement. */
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.loading_container}>
          <View style={styles.loading_circle}>
            <ActivityIndicator
              size="large"
              color={PREMIUM_COLORS.accent_primary}
            />
          </View>
          <Text style={styles.loading_text}>Chargement des articles...</Text>
        </View>
      );
    }

    return (
      <View style={styles.empty_container}>
        <View style={styles.empty_icon}>
          <IconSymbol name="tray" size={40} color={PREMIUM_COLORS.text_muted} />
        </View>
        <Text style={styles.empty_title}>
          {hasSearch
            ? "Aucun article pour cette recherche"
            : "Aucun article enregistre"}
        </Text>
        <Text style={styles.empty_subtitle}>
          {hasSearch
            ? "Essayez un autre code ou une autre description."
            : "Lancez une synchronisation pour charger les articles."}
        </Text>
        {hasSearch ? null : (
          <TouchableOpacity
            style={styles.empty_button}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[
                PREMIUM_COLORS.accent_primary,
                PREMIUM_COLORS.accent_secondary,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.empty_button_gradient}
            >
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={PREMIUM_COLORS.text_primary}
              />
              <Text style={styles.empty_button_text}>Synchroniser</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [hasSearch, handleRefresh, isLoading]);

  return (
    <PremiumScreenWrapper>
      <View style={styles.list_wrapper}>
        <SectionList
          sections={[{ id: "accordion", title: "accordion", data: sections }]}
          keyExtractor={(item) => item.id}
          renderItem={renderSection}
          renderSectionHeader={() => null}
          ListHeaderComponent={headerElement}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list_content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </View>
    </PremiumScreenWrapper>
  );
}

/**
 * Styles du composant ListesScreen.
 */
const styles = StyleSheet.create({
  list_wrapper: {
    flex: 1,
  },
  list_content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 8,
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
  separator: {
    height: 1,
    marginVertical: 16,
  },
  search_container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 12,
  },
  search_input: {
    flex: 1,
    fontSize: 16,
    color: PREMIUM_COLORS.text_primary,
    paddingVertical: 12,
  },
  search_button: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  search_button_gradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  search_button_text: {
    fontSize: 14,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  refresh_button: {
    borderRadius: 12,
    overflow: "hidden",
  },
  refresh_button_gradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  refresh_button_text: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  error_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  error_text: {
    fontSize: 13,
    color: PREMIUM_COLORS.error,
    flex: 1,
  },
  /* Section header */
  section_block: {
    gap: 8,
    marginBottom: 8,
  },
  section_header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  section_header_content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  section_title: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  section_header_right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  section_count_badge: {
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  section_count: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  section_items: {
    gap: 8,
  },
  /* Article card */
  article_card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 14,
    gap: 12,
    marginBottom: 8,
  },
  article_icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  article_content: {
    flex: 1,
    gap: 2,
  },
  article_code: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  article_description: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  article_location_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  article_location: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  /* État de chargement */
  loading_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loading_circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loading_text: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },
  /* État vide */
  empty_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  empty_icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  empty_title: {
    fontSize: 18,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  empty_subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  empty_button: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
  },
  empty_button_gradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  empty_button_text: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
});
