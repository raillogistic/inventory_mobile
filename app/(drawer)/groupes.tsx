/**
 * @fileoverview Écran de sélection des groupes de comptage avec design premium.
 * Permet de choisir un groupe et de valider avec un code PIN.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
} from "@/components/ui/premium-theme";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { type GroupeComptage } from "@/lib/graphql/inventory-operations";

/** Limite du nombre de groupes affichés */
const GROUPE_LIST_LIMIT = 50;

/** Nombre de chiffres requis pour le PIN */
const PIN_LENGTH = 4;

/**
 * Normalise une valeur de recherche pour la correspondance insensible à la casse.
 * @param value - Valeur à normaliser
 * @returns Valeur normalisée
 */
function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Filtre et trie les groupes selon la recherche et la campagne sélectionnée.
 * @param groups - Liste des groupes
 * @param searchValue - Valeur de recherche
 * @param campaignId - ID de la campagne sélectionnée
 * @returns Groupes filtrés et triés
 */
function filterGroups(
  groups: GroupeComptage[],
  searchValue: string,
  campaignId: string | null
): GroupeComptage[] {
  if (!campaignId) {
    return [];
  }

  const normalizedSearch = normalizeSearchValue(searchValue);
  const filtered = groups.filter((group) => group.campagne.id === campaignId);
  const searched = normalizedSearch
    ? filtered.filter((group) =>
        group.nom.toLowerCase().includes(normalizedSearch)
      )
    : filtered;

  return [...searched]
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .slice(0, GROUPE_LIST_LIMIT);
}

/**
 * Props pour le composant PinCodeInput.
 */
type PinCodeInputProps = {
  /** Valeur actuelle du PIN */
  value: string;
  /** Longueur requise du PIN */
  length: number;
  /** Callback pour mettre à jour la valeur */
  onChange: (value: string) => void;
  /** Ref de l'input pour le focus */
  inputRef: React.RefObject<TextInput>;
  /** Active le focus automatique si necessaire. */
  autoFocus?: boolean;
};

/**
 * Composant d'entrée PIN avec style premium.
 */
function PinCodeInput({
  value,
  length,
  onChange,
  inputRef,
  autoFocus = false,
}: PinCodeInputProps) {
  /** Normalise les valeurs entrantes. */
  const handleChangeText = useCallback(
    (nextValue: string) => {
      const sanitized = nextValue.replace(/[^0-9]/g, "").slice(0, length);
      onChange(sanitized);
    },
    [length, onChange]
  );

  /** Focus l'input quand on appuie sur la zone. */
  const handleFocusRequest = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <Pressable
      style={styles.pin_container}
      onPressIn={handleFocusRequest}
      accessibilityRole="button"
      accessibilityLabel="Saisir le code PIN"
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        keyboardType="numeric"
        inputMode="numeric"
        showSoftInputOnFocus
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden_input}
      />
      <View style={styles.pin_box_row}>
        {Array.from({ length }).map((_, index) => {
          const isFilled = index < value.length;
          const isActive =
            value.length < length
              ? index === value.length
              : index === length - 1;

          return (
            <View
              key={`pin-box-${index}`}
              style={[styles.pin_box, isActive && styles.pin_box_active]}
            >
              {isFilled && <View style={styles.pin_dot} />}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/**
 * Props pour le composant GroupeListItem.
 */
type GroupeListItemProps = {
  /** Données du groupe */
  group: GroupeComptage;
  /** Si le groupe est sélectionné */
  isSelected: boolean;
  /** Callback de sélection */
  onSelect: (group: GroupeComptage) => void;
};

/**
 * Composant carte de groupe avec style premium.
 */
function GroupeListItem({ group, isSelected, onSelect }: GroupeListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(group);
  }, [group, onSelect]);

  return (
    <TouchableOpacity
      style={[styles.group_card, isSelected && styles.group_card_selected]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir le groupe ${group.nom}`}
      activeOpacity={0.7}
    >
      {/* Barre d'accent pour sélection */}
      {isSelected && <View style={styles.card_glow_bar} />}

      <View style={styles.group_card_content}>
        <View
          style={[styles.group_icon, isSelected && styles.group_icon_selected]}
        >
          <IconSymbol
            name="person.2.fill"
            size={20}
            color={
              isSelected
                ? PREMIUM_COLORS.accent_primary
                : PREMIUM_COLORS.text_muted
            }
          />
        </View>

        <View style={styles.group_info}>
          <Text style={styles.group_name}>{group.nom}</Text>
          <View style={styles.group_meta_row}>
            <IconSymbol
              name="desktopcomputer"
              size={12}
              color={PREMIUM_COLORS.text_muted}
            />
            <Text style={styles.group_meta}>{group.appareil_identifiant}</Text>
          </View>
          <View style={styles.group_meta_row}>
            <IconSymbol
              name="person"
              size={12}
              color={PREMIUM_COLORS.text_muted}
            />
            <Text style={styles.group_meta}>{group.utilisateur.username}</Text>
          </View>
        </View>

        {isSelected && (
          <View style={styles.selected_badge}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={16}
              color={PREMIUM_COLORS.text_primary}
            />
            <Text style={styles.selected_badge_text}>Actif</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}


/**
 * Props for the group list header.
 */
type GroupListHeaderProps = {
  /** Number of available groups. */
  groupCount: number;
  /** Selected group id. */
  selectedGroupId: string | null;
  /** Selected campaign name. */
  campaignName: string | null | undefined;
  /** Selected campaign code. */
  campaignCode: string | null | undefined;
  /** Selected group name. */
  selectedGroupName: string | null | undefined;
  /** Search input value. */
  searchText: string;
  /** Callback when search value changes. */
  onSearchChange: (value: string) => void;
  /** Callback to clear search. */
  onClearSearch: () => void;
  /** Callback to change campaign. */
  onChangeCampaign: () => void;
  /** Callback to continue to locations. */
  onContinueToLocations: () => void;
  /** Whether to show inline error. */
  showInlineError: boolean;
  /** Inline error message. */
  errorMessage: string | null;
  /** Callback to retry sync. */
  onRetry: () => void;
};

/**
 * Header for the group list with search and context.
 */
function GroupListHeader({
  groupCount,
  selectedGroupId,
  campaignName,
  campaignCode,
  selectedGroupName,
  searchText,
  onSearchChange,
  onClearSearch,
  onChangeCampaign,
  onContinueToLocations,
  showInlineError,
  errorMessage,
  onRetry,
}: GroupListHeaderProps) {
  return (
    <View style={styles.header_section}>
      <BlurView intensity={20} tint="dark" style={styles.header_blur}>
        <View style={styles.header_card}>
          <View style={styles.header_row}>
            <View style={styles.header_icon}>
              <IconSymbol
                name="person.2.fill"
                size={24}
                color={PREMIUM_COLORS.accent_primary}
              />
            </View>
            <View style={styles.header_text}>
              <Text style={styles.header_title}>Groupes</Text>
              <Text style={styles.header_subtitle}>
                {groupCount} groupe(s) disponible(s)
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

          {/* Campagne s??lectionn??e */}
          <View style={styles.campaign_banner}>
            <View style={styles.campaign_info}>
              <View style={styles.campaign_icon}>
                <IconSymbol
                  name="folder.fill"
                  size={16}
                  color={PREMIUM_COLORS.accent_primary}
                />
              </View>
              <View style={styles.campaign_text}>
                <Text style={styles.campaign_name}>{campaignName}</Text>
                <Text style={styles.campaign_code}>
                  Code: {campaignCode}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.change_button}
              onPress={onChangeCampaign}
              activeOpacity={0.7}
            >
              <Text style={styles.change_button_text}>Changer</Text>
            </TouchableOpacity>
          </View>

          {/* Recherche */}
          <View style={styles.search_container}>
            <IconSymbol
              name="magnifyingglass"
              size={18}
              color={PREMIUM_COLORS.text_muted}
            />
            <TextInput
              style={styles.search_input}
              placeholder="Rechercher un groupe..."
              placeholderTextColor={PREMIUM_COLORS.text_muted}
              value={searchText}
              onChangeText={onSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={onClearSearch}>
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

          {/* Groupe s??lectionn?? */}
          {selectedGroupId && (
            <TouchableOpacity
              style={styles.selected_banner}
              onPress={onContinueToLocations}
              activeOpacity={0.7}
            >
              <View style={styles.selected_banner_content}>
                <IconSymbol
                  name="checkmark.seal.fill"
                  size={20}
                  color={PREMIUM_COLORS.success}
                />
                <View style={styles.selected_banner_text}>
                  <Text style={styles.selected_banner_title}>Groupe actif</Text>
                  <Text style={styles.selected_banner_name}>
                    {selectedGroupName}
                  </Text>
                </View>
              </View>
              <IconSymbol
                name="chevron.right"
                size={16}
                color={PREMIUM_COLORS.text_muted}
              />
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
                onPress={onRetry}
              >
                <Text style={styles.retry_small_text}>R??essayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );
}

/**
 * Écran de sélection des groupes de comptage avec design premium.
 */
export default function GroupSelectionScreen() {
  const router = useRouter();
  const { session, setCampaign, setGroup } = useComptageSession();
  const { cache, isHydrated, isSyncing, syncError, syncAll } =
    useInventoryOffline();
  const [searchText, setSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pinPromptGroup, setPinPromptGroup] = useState<GroupeComptage | null>(
    null
  );
  const [pinValue, setPinValue] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<TextInput>(null);

  const campaignId = session.campaign?.id ?? null;
  const selectedGroupId = session.group?.id ?? null;

  const groups = useMemo(
    () => filterGroups(cache.groups, searchText, campaignId),
    [cache.groups, searchText, campaignId]
  );
  const hasGroups = cache.groups.length > 0;
  const isLoading = !isHydrated || (isSyncing && !hasGroups);
  const errorMessage = syncError;

  /** Met à jour la recherche. */
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  /** Efface la recherche. */
  const handleClearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  /** Ouvre le prompt PIN pour le groupe sélectionné. */
  const handleSelectGroup = useCallback(
    (group: GroupeComptage) => {
      if (group.id === selectedGroupId) {
        router.push("/(drawer)/lieux");
        return;
      }

      setPinPromptGroup(group);
      setPinValue("");
      setPinError(null);
    },
    [router, selectedGroupId]
  );

  /** Retourne à la liste des campagnes. */
  const handleChangeCampaign = useCallback(() => {
    setCampaign(null);
    router.push("/(drawer)");
  }, [router, setCampaign]);

  /** Gère le bouton retour Android. */
  const handleHardwareBack = useCallback(() => {
    if (campaignId && selectedGroupId) {
      router.replace("/(drawer)/lieux");
      return true;
    }

    return false;
  }, [campaignId, selectedGroupId, router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleHardwareBack
      );
      return () => subscription.remove();
    }, [handleHardwareBack])
  );

  /** Continue vers les lieux si un groupe est sélectionné. */
  const handleContinueToLocations = useCallback(() => {
    router.push("/(drawer)/lieux");
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

  /** Met à jour le PIN. */
  const handlePinChange = useCallback((value: string) => {
    setPinValue(value.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH));
    setPinError(null);
  }, []);

  /** Ferme le prompt PIN. */
  const handleClosePinPrompt = useCallback(() => {
    setPinPromptGroup(null);
    setPinValue("");
    setPinError(null);
  }, []);

  /** Focus le PIN des que le modal est affiche. */
  const handlePinModalShow = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      pinInputRef.current?.focus();
    });
  }, []);

  /** Valide le PIN et navigue vers les lieux. */
  const handleConfirmPin = useCallback(
    (enteredPin: string) => {
      if (!pinPromptGroup) {
        return;
      }

      const expectedPin = pinPromptGroup.pin_code?.trim() ?? "";

      if (!expectedPin) {
        setPinValue("");
        setPinError("PIN manquant pour ce groupe.");
        pinInputRef.current?.focus();
        return;
      }

      if (enteredPin.length !== PIN_LENGTH) {
        setPinValue("");
        setPinError("PIN incomplet.");
        pinInputRef.current?.focus();
        return;
      }

      if (enteredPin !== expectedPin) {
        setPinValue("");
        setPinError("PIN invalide. Réessayez.");
        pinInputRef.current?.focus();
        return;
      }

      setGroup(pinPromptGroup);
      setPinPromptGroup(null);
      setPinValue("");
      setPinError(null);
      router.push("/(drawer)/lieux");
    },
    [pinPromptGroup, router, setGroup]
  );

  /** Auto-valide le PIN une fois complet. */
  useEffect(() => {
    if (!pinPromptGroup) {
      return;
    }

    if (pinValue.length === PIN_LENGTH) {
      handleConfirmPin(pinValue);
    }
  }, [handleConfirmPin, pinPromptGroup, pinValue]);

  /** Rend une ligne de groupe. */
  const renderItem = useCallback(
    ({ item }: { item: GroupeComptage }) => (
      <GroupeListItem
        group={item}
        isSelected={item.id === selectedGroupId}
        onSelect={handleSelectGroup}
      />
    ),
    [handleSelectGroup, selectedGroupId]
  );

  /** Key extractor. */
  const keyExtractor = useCallback((item: GroupeComptage) => item.id, []);

  const showInitialLoading = isLoading && groups.length === 0 && !isRefreshing;
  const showInlineError = Boolean(errorMessage && groups.length > 0);

  /** Rend l'en-tête de la liste. */
  const headerElement = useMemo(
    () => (
      <GroupListHeader
        groupCount={groups.length}
        selectedGroupId={selectedGroupId}
        campaignName={session.campaign?.nom}
        campaignCode={session.campaign?.code_campagne}
        selectedGroupName={session.group?.nom}
        searchText={searchText}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        onChangeCampaign={handleChangeCampaign}
        onContinueToLocations={handleContinueToLocations}
        showInlineError={showInlineError}
        errorMessage={errorMessage}
        onRetry={handleRetry}
      />
    ),
    [
      errorMessage,
      groups.length,
      handleChangeCampaign,
      handleClearSearch,
      handleContinueToLocations,
      handleRetry,
      handleSearchChange,
      searchText,
      selectedGroupId,
      session.campaign?.code_campagne,
      session.campaign?.nom,
      session.group?.nom,
      showInlineError,
    ]
  );

  /** Rend l'état vide/chargement. */
  const renderEmptyComponent = useCallback(() => {
    if (showInitialLoading) {
      return (
        <View style={styles.loading_container}>
          <View style={styles.loading_circle}>
            <ActivityIndicator
              size="large"
              color={PREMIUM_COLORS.accent_primary}
            />
          </View>
          <Text style={styles.loading_text}>Chargement des groupes...</Text>
        </View>
      );
    }

    if (errorMessage) {
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
            Impossible de charger les groupes
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
          <IconSymbol
            name="person.2.slash"
            size={40}
            color={PREMIUM_COLORS.text_muted}
          />
        </View>
        <Text style={styles.empty_title}>Aucun groupe trouvé</Text>
        <Text style={styles.empty_subtitle}>
          Vérifiez votre recherche ou contactez l'administrateur.
        </Text>
      </View>
    );
  }, [showInitialLoading, errorMessage, handleRetry]);

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
            onPress={handleChangeCampaign}
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

  return (
    <PremiumScreenWrapper>
      <FlatList
        data={groups}
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

      {/* Modal PIN */}
      <Modal
        transparent
        visible={Boolean(pinPromptGroup)}
        animationType="fade"
        onShow={handlePinModalShow}
        onRequestClose={handleClosePinPrompt}
      >
        <Pressable style={styles.modal_overlay} onPress={handleClosePinPrompt}>
          <Pressable
            style={styles.modal_card}
            onPress={(event) => event.stopPropagation()}
          >
            {/* Bouton fermer */}
            <TouchableOpacity
              style={styles.modal_close}
              onPress={handleClosePinPrompt}
            >
              <IconSymbol
                name="xmark"
                size={16}
                color={PREMIUM_COLORS.text_muted}
              />
            </TouchableOpacity>

            <View style={styles.modal_content}>
              <View style={styles.modal_icon}>
                <IconSymbol
                  name="lock.fill"
                  size={32}
                  color={PREMIUM_COLORS.accent_primary}
                />
              </View>

              <Text style={styles.modal_title}>Code PIN</Text>
              <Text style={styles.modal_subtitle}>
                Saisissez le PIN à 4 chiffres pour valider le groupe
                {pinPromptGroup ? ` "${pinPromptGroup.nom}"` : ""}.
              </Text>

              <PinCodeInput
                value={pinValue}
                length={PIN_LENGTH}
                onChange={handlePinChange}
                inputRef={pinInputRef}
                autoFocus
              />

              {pinError && (
                <View style={styles.pin_error_container}>
                  <IconSymbol
                    name="exclamationmark.circle.fill"
                    size={16}
                    color={PREMIUM_COLORS.error}
                  />
                  <Text style={styles.pin_error_text}>{pinError}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.cancel_button}
              onPress={handleClosePinPrompt}
            >
              <Text style={styles.cancel_button_text}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </PremiumScreenWrapper>
  );
}

/**
 * Styles du composant GroupSelectionScreen.
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
    gap: 16,
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
  /* Campagne */
  campaign_banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    borderRadius: 14,
    padding: 14,
  },
  campaign_info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  campaign_icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 107, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  campaign_text: {
    flex: 1,
  },
  campaign_name: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  campaign_code: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 2,
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
  /* Groupe sélectionné */
  selected_banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: PREMIUM_COLORS.success_bg,
    borderRadius: 14,
    padding: 14,
  },
  selected_banner_content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  selected_banner_text: {
    flex: 1,
  },
  selected_banner_title: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.success,
  },
  selected_banner_name: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
    marginTop: 2,
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
  /* Carte de groupe */
  group_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    overflow: "hidden",
  },
  group_card_selected: {
    borderColor: PREMIUM_COLORS.accent_primary,
    borderWidth: 2,
  },
  card_glow_bar: {
    height: 3,
    backgroundColor: PREMIUM_COLORS.accent_primary,
  },
  group_card_content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  group_icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PREMIUM_COLORS.glass_highlight,
    alignItems: "center",
    justifyContent: "center",
  },
  group_icon_selected: {
    backgroundColor: "rgba(255, 107, 0, 0.15)",
  },
  group_info: {
    flex: 1,
    gap: 4,
  },
  group_name: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  group_meta_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  group_meta: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  selected_badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PREMIUM_COLORS.accent_primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selected_badge_text: {
    fontSize: 11,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
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
  /* Modal PIN */
  modal_overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 22, 40, 0.9)",
    justifyContent: "center",
    padding: 24,
  },
  modal_card: {
    backgroundColor: PREMIUM_COLORS.gradient_start,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 24,
    gap: 20,
  },
  modal_close: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  modal_content: {
    alignItems: "center",
    gap: 16,
  },
  modal_icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255, 107, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modal_title: {
    fontSize: 24,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  modal_subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
  },
  /* PIN Input */
  pin_container: {
    alignItems: "center",
    marginTop: 8,
  },
  hidden_input: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    zIndex: 1,
  },
  pin_box_row: {
    flexDirection: "row",
    gap: 12,
  },
  pin_box: {
    width: 56,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PREMIUM_COLORS.glass_border,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },
  pin_box_active: {
    borderColor: PREMIUM_COLORS.accent_primary,
  },
  pin_dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PREMIUM_COLORS.accent_primary,
  },
  pin_error_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 10,
    padding: 10,
    width: "100%",
  },
  pin_error_text: {
    fontSize: 13,
    color: PREMIUM_COLORS.error,
    flex: 1,
  },
  cancel_button: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
  },
  cancel_button_text: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
});
