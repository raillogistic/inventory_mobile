/**
 * @fileoverview Écran de sélection des lieux avec design premium.
 * Permet de naviguer dans la hiérarchie des lieux et de sélectionner un lieu pour scanner.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
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
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { type Location } from "@/lib/graphql/inventory-operations";

/** Limite du nombre de lieux affichés */
const LOCATION_LIST_LIMIT = 80;

/**
 * Normalise une valeur de recherche pour la correspondance insensible à la casse.
 * @param value - Valeur à normaliser
 * @returns Valeur normalisée
 */
function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Construit un ensemble d'IDs de lieux autorisés depuis le groupe sélectionné.
 * @param locations - Liste des lieux autorisés
 * @returns Set des IDs autorisés
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
 * Filtre les lieux pour le niveau actuel de la hiérarchie et la recherche.
 * @param locations - Liste de tous les lieux
 * @param parentId - ID du parent (null pour le niveau racine)
 * @param searchValue - Valeur de recherche
 * @param barcodeValue - Valeur du code-barres
 * @returns Lieux filtrés et triés
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

/** Props pour un élément de la liste de lieux */
type LocationListItemProps = {
  /** Données du lieu */
  location: Location;
  /** Si le lieu a des sous-lieux */
  hasChildren: boolean;
  /** Callback de sélection */
  onSelect: (location: Location, hasChildren: boolean) => void;
};

/**
 * Composant carte de lieu avec style premium.
 */
function LocationListItem({
  location,
  hasChildren,
  onSelect,
}: LocationListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(location, hasChildren);
  }, [hasChildren, location, onSelect]);

  return (
    <TouchableOpacity
      style={styles.location_card}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir le lieu ${location.locationname}`}
      activeOpacity={0.7}
    >
      <View style={styles.location_card_content}>
        <View style={styles.location_icon}>
          <IconSymbol
            name={hasChildren ? "folder.fill" : "mappin.circle.fill"}
            size={20}
            color={
              hasChildren
                ? PREMIUM_COLORS.accent_primary
                : PREMIUM_COLORS.success
            }
          />
        </View>

        <View style={styles.location_info}>
          <Text style={styles.location_name}>{location.locationname}</Text>
          {location.desc && (
            <Text style={styles.location_desc} numberOfLines={1}>
              {location.desc}
            </Text>
          )}
          {location.barcode && (
            <View style={styles.barcode_row}>
              <IconSymbol
                name="barcode"
                size={12}
                color={PREMIUM_COLORS.text_muted}
              />
              <Text style={styles.barcode_text}>{location.barcode}</Text>
            </View>
          )}
        </View>

        {hasChildren ? (
          <View style={styles.children_badge}>
            <IconSymbol
              name="folder"
              size={12}
              color={PREMIUM_COLORS.accent_primary}
            />
            <Text style={styles.children_badge_text}>Sublieux</Text>
          </View>
        ) : (
          <IconSymbol
            name="chevron.right"
            size={16}
            color={PREMIUM_COLORS.text_muted}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Élément de fil d'Ariane */
export type LocationTrailItem = {
  /** Identifiant unique du lieu */
  id: string;
  /** Nom d'affichage du lieu */
  locationname: string;
  /** Description optionnelle */
  desc: string | null;
  /** Code-barres optionnel */
  barcode: string | null;
};

/** Props de l'écran de niveau de localisation */
export type LocationLevelScreenProps = {
  /** Lieu parent pour ce niveau, si défini */
  parentLocation: Location | null;
  /** Fil d'Ariane des parents menant à ce niveau */
  parentTrail: LocationTrailItem[];
};

/**
 * Écran de sélection des lieux avec design premium.
 */
export function LocationLevelScreen({
  parentLocation,
  parentTrail,
}: LocationLevelScreenProps) {
  const router = useRouter();
  const { session, setLocation } = useComptageSession();
  const { cache, isHydrated, isSyncing, syncError, syncAll } =
    useInventoryOffline();
  const [searchText, setSearchText] = useState<string>("");
  const [barcodeText, setBarcodeText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const parentId = parentLocation?.id ?? null;

  // Lieux autorisés pour le groupe sélectionné
  const groupLocationIds = useMemo(
    () => buildAuthorizedLocationIdSet(session.group?.lieux_autorises),
    [session.group?.lieux_autorises]
  );

  // IDs des lieux qui ont des sous-lieux
  const parentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const location of cache.locations) {
      if (location.parent?.id) {
        ids.add(location.parent.id);
      }
    }
    return ids;
  }, [cache.locations]);

  // Lieux filtrés pour le niveau actuel
  const locations = useMemo(() => {
    const filtered = filterLocationsForLevel(
      cache.locations,
      parentId,
      searchText,
      barcodeText
    );

    // Si un groupe est sélectionné, filtrer les lieux autorisés
    if (groupId && groupLocationIds.size > 0) {
      return filtered.filter(
        (location) =>
          groupLocationIds.has(location.id) || parentIds.has(location.id)
      );
    }

    return filtered;
  }, [
    cache.locations,
    parentId,
    searchText,
    barcodeText,
    groupId,
    groupLocationIds,
    parentIds,
  ]);

  const hasLocations = cache.locations.length > 0;
  const isLoading = !isHydrated || (isSyncing && !hasLocations);
  const errorMessage = syncError;

  /** Met à jour la recherche. */
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  /** Efface la recherche. */
  const handleClearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  /** Met à jour le code-barres. */
  const handleBarcodeChange = useCallback((value: string) => {
    setBarcodeText(value);
  }, []);

  /** Efface le code-barres. */
  const handleClearBarcode = useCallback(() => {
    setBarcodeText("");
  }, []);

  /** Sélectionne un lieu et navigue. */
  const handleSelectLocation = useCallback(
    (location: Location, hasChildren: boolean) => {
      if (hasChildren) {
        // Navigation vers les sous-lieux
        const newTrail = [
          ...parentTrail,
          {
            id: location.id,
            locationname: location.locationname,
            desc: location.desc ?? null,
            barcode: location.barcode ?? null,
          },
        ];
        router.push({
          pathname: "/(drawer)/lieux/[parentId]",
          params: {
            parentId: location.id,
            parentName: location.locationname,
            parentDesc: location.desc ?? "",
            parentBarcode: location.barcode ?? "",
            parentTrail: JSON.stringify(newTrail),
          },
        });
      } else {
        // Sélection du lieu pour scanner
        setLocation(location);
        router.push("/(drawer)/scan");
      }
    },
    [parentTrail, router, setLocation]
  );

  /** Retourne au niveau parent. */
  const handleGoBack = useCallback(() => {
    if (parentTrail.length > 0) {
      router.back();
    }
  }, [parentTrail.length, router]);

  /** Change de groupe. */
  const handleChangeGroup = useCallback(() => {
    router.push("/(drawer)/groupes");
  }, [router]);

  /** Réessaie le chargement. */
  const handleRetry = useCallback(() => {
    void syncAll();
  }, [syncAll]);

  /** Rafraîchit la liste. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [syncAll]);

  /** Navigue vers le scan. */
  const handleStartScan = useCallback(() => {
    if (parentLocation) {
      setLocation(parentLocation);
      router.push("/(drawer)/scan");
    }
  }, [parentLocation, router, setLocation]);

  /** Rend une ligne de lieu. */
  const renderItem = useCallback(
    ({ item }: { item: Location }) => {
      const hasChildren = parentIds.has(item.id);

      return (
        <LocationListItem
          location={item}
          hasChildren={hasChildren}
          onSelect={handleSelectLocation}
        />
      );
    },
    [handleSelectLocation, parentIds]
  );

  /** Key extractor. */
  const keyExtractor = useCallback((item: Location) => item.id, []);

  const showInitialLoading =
    isLoading && locations.length === 0 && !isRefreshing;
  const showInlineError = Boolean(errorMessage && locations.length > 0);

  // Vérification des prérequis
  if (!campaignId) {
    return (
      <PremiumScreenWrapper>
        <View style={styles.missing_container}>
          <View style={styles.missing_icon}>
            <IconSymbol
              name="folder.badge.questionmark"
              size={48}
              color={PREMIUM_COLORS.text_muted}
            />
          </View>
          <Text style={styles.missing_title}>Aucune campagne sélectionnée</Text>
          <Text style={styles.missing_subtitle}>
            Retournez à la liste des campagnes pour continuer.
          </Text>
          <TouchableOpacity
            style={styles.missing_button}
            onPress={() => router.push("/(drawer)")}
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
              <Text style={styles.missing_button_text}>Voir les campagnes</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </PremiumScreenWrapper>
    );
  }

  if (!groupId) {
    return (
      <PremiumScreenWrapper>
        <View style={styles.missing_container}>
          <View style={styles.missing_icon}>
            <IconSymbol
              name="person.2.slash"
              size={48}
              color={PREMIUM_COLORS.text_muted}
            />
          </View>
          <Text style={styles.missing_title}>Aucun groupe sélectionné</Text>
          <Text style={styles.missing_subtitle}>
            Choisissez un groupe de comptage pour continuer.
          </Text>
          <TouchableOpacity
            style={styles.missing_button}
            onPress={handleChangeGroup}
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

  /** Rend l'en-tête de la liste. */
  const headerElement = useMemo(
    () => (
      <View style={styles.header_section}>
        <BlurView intensity={20} tint="dark" style={styles.header_blur}>
          <View style={styles.header_card}>
            {/* Titre */}
            <View style={styles.header_row}>
              <View style={styles.header_icon}>
                <IconSymbol
                  name="map.fill"
                  size={24}
                  color={PREMIUM_COLORS.accent_primary}
                />
              </View>
              <View style={styles.header_text}>
                <Text style={styles.header_title}>
                  {parentLocation ? parentLocation.locationname : "Lieux"}
                </Text>
                <Text style={styles.header_subtitle}>
                  {locations.length} lieu(x) disponible(s)
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

            {/* Fil d'Ariane et groupe */}
            <View style={styles.context_row}>
              <View style={styles.context_info}>
                <View style={styles.context_item}>
                  <IconSymbol
                    name="person.2"
                    size={14}
                    color={PREMIUM_COLORS.text_muted}
                  />
                  <Text style={styles.context_text}>{session.group?.nom}</Text>
                </View>
                {parentTrail.length > 0 && (
                  <View style={styles.breadcrumb_row}>
                    <IconSymbol
                      name="folder.fill"
                      size={14}
                      color={PREMIUM_COLORS.text_muted}
                    />
                    <Text style={styles.breadcrumb_text} numberOfLines={1}>
                      {parentTrail.map((item) => item.locationname).join(" › ")}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.change_button}
                onPress={handleChangeGroup}
                activeOpacity={0.7}
              >
                <Text style={styles.change_button_text}>Changer</Text>
              </TouchableOpacity>
            </View>

            {/* Bouton retour si sous-niveau */}
            {parentTrail.length > 0 && (
              <TouchableOpacity
                style={styles.back_button}
                onPress={handleGoBack}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name="arrow.left"
                  size={16}
                  color={PREMIUM_COLORS.accent_primary}
                />
                <Text style={styles.back_button_text}>
                  Retour à {parentTrail[parentTrail.length - 1].locationname}
                </Text>
              </TouchableOpacity>
            )}

            {/* Recherche */}
            <View style={styles.search_container}>
              <IconSymbol
                name="magnifyingglass"
                size={18}
                color={PREMIUM_COLORS.text_muted}
              />
              <TextInput
                style={styles.search_input}
                placeholder="Rechercher un lieu..."
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                value={searchText}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch}>
                  <View style={styles.clear_button}>
                    <IconSymbol
                      name="xmark"
                      size={12}
                      color={PREMIUM_COLORS.text_primary}
                    />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Recherche par code-barres */}
            <View style={styles.search_container}>
              <IconSymbol
                name="barcode"
                size={18}
                color={PREMIUM_COLORS.text_muted}
              />
              <TextInput
                style={styles.search_input}
                placeholder="Rechercher par code-barres..."
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                value={barcodeText}
                onChangeText={handleBarcodeChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {barcodeText.length > 0 && (
                <TouchableOpacity onPress={handleClearBarcode}>
                  <View style={styles.clear_button}>
                    <IconSymbol
                      name="xmark"
                      size={12}
                      color={PREMIUM_COLORS.text_primary}
                    />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Bouton scanner ce lieu (pour les sous-lieux) */}
            {parentLocation && (
              <TouchableOpacity
                style={styles.scan_this_button}
                onPress={handleStartScan}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[
                    PREMIUM_COLORS.accent_primary,
                    PREMIUM_COLORS.accent_secondary,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scan_this_gradient}
                >
                  <IconSymbol
                    name="barcode.viewfinder"
                    size={18}
                    color={PREMIUM_COLORS.text_primary}
                  />
                  <Text style={styles.scan_this_text}>
                    Scanner dans {parentLocation.locationname}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Erreur inline */}
            {showInlineError && (
              <View style={styles.error_container}>
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={18}
                  color={PREMIUM_COLORS.error}
                />
                <View style={styles.error_content}>
                  <Text style={styles.error_title}>Erreur de chargement</Text>
                  <Text style={styles.error_message}>{errorMessage}</Text>
                </View>
                <TouchableOpacity
                  style={styles.retry_small_button}
                  onPress={handleRetry}
                >
                  <Text style={styles.retry_small_text}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </BlurView>
      </View>
    ),
    [
      barcodeText,
      errorMessage,
      handleBarcodeChange,
      handleChangeGroup,
      handleClearBarcode,
      handleClearSearch,
      handleGoBack,
      handleRetry,
      handleSearchChange,
      handleStartScan,
      locations.length,
      parentLocation,
      parentTrail,
      searchText,
      session.group?.nom,
      showInlineError,
    ]
  );

  /** Rend l'état vide/chargement. */
  const renderEmptyComponent = () => {
    if (showInitialLoading) {
      return (
        <View style={styles.loading_container}>
          <View style={styles.loading_circle}>
            <ActivityIndicator
              size="large"
              color={PREMIUM_COLORS.accent_primary}
            />
          </View>
          <Text style={styles.loading_text}>Chargement des lieux...</Text>
        </View>
      );
    }

    if (errorMessage && locations.length === 0) {
      return (
        <View style={styles.error_full_container}>
          <View style={styles.error_full_icon}>
            <IconSymbol
              name="wifi.slash"
              size={40}
              color={PREMIUM_COLORS.error}
            />
          </View>
          <Text style={styles.error_full_title}>
            Impossible de charger les lieux
          </Text>
          <Text style={styles.error_full_message}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retry_button}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[
                PREMIUM_COLORS.accent_primary,
                PREMIUM_COLORS.accent_secondary,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.retry_button_gradient}
            >
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={PREMIUM_COLORS.text_primary}
              />
              <Text style={styles.retry_button_text}>Réessayer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.empty_container}>
        <View style={styles.empty_icon}>
          <IconSymbol name="map" size={40} color={PREMIUM_COLORS.text_muted} />
        </View>
        <Text style={styles.empty_title}>Aucun lieu trouvé</Text>
        <Text style={styles.empty_subtitle}>
          {searchText || barcodeText
            ? "Ajustez votre recherche."
            : "Aucun lieu disponible à ce niveau."}
        </Text>
      </View>
    );
  };

  return (
    <PremiumScreenWrapper>
      <FlatList
        data={locations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={headerElement}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.list_content}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
      />
    </PremiumScreenWrapper>
  );
}

/**
 * Default route wrapper for Expo Router.
 */
export default function LocationLevelRoute() {
  return <LocationLevelScreen parentLocation={null} parentTrail={[]} />;
}

/**
 * Styles du composant LocationLevelScreen.
 */
const styles = StyleSheet.create({
  list_content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
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
    gap: 14,
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
  },
  /* Contexte */
  context_row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    borderRadius: 14,
    padding: 14,
  },
  context_info: {
    flex: 1,
    gap: 6,
  },
  context_item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  context_text: {
    fontSize: 14,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  breadcrumb_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  breadcrumb_text: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
    flex: 1,
  },
  change_button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
  },
  change_button_text: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  /* Bouton retour */
  back_button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 107, 0, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 0, 0.2)",
  },
  back_button_text: {
    fontSize: 14,
    fontWeight: "500",
    color: PREMIUM_COLORS.accent_primary,
  },
  /* Recherche */
  search_container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    paddingHorizontal: 14,
    gap: 10,
  },
  search_input: {
    flex: 1,
    fontSize: 16,
    color: PREMIUM_COLORS.text_primary,
    paddingVertical: 14,
  },
  clear_button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Bouton scanner ce lieu */
  scan_this_button: {
    borderRadius: 14,
    overflow: "hidden",
  },
  scan_this_gradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  scan_this_text: {
    fontSize: 15,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  /* Erreur inline */
  error_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 12,
    padding: 12,
  },
  error_content: {
    flex: 1,
    gap: 2,
  },
  error_title: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.error,
  },
  error_message: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  retry_small_button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PREMIUM_COLORS.glass_bg,
  },
  retry_small_text: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  /* Carte de lieu */
  location_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
  },
  location_card_content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  location_icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  location_info: {
    flex: 1,
    gap: 4,
  },
  location_name: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  location_desc: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  barcode_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barcode_text: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  children_badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  children_badge_text: {
    fontSize: 11,
    fontWeight: "600",
    color: PREMIUM_COLORS.accent_primary,
  },
  /* Chargement */
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
  /* Erreur pleine page */
  error_full_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 16,
  },
  error_full_icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PREMIUM_COLORS.error_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  error_full_title: {
    fontSize: 18,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
    textAlign: "center",
  },
  error_full_message: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
  },
  retry_button: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  retry_button_gradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  retry_button_text: {
    fontSize: 15,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
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
  /* Sélection manquante */
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
