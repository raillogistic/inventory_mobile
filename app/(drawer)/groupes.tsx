import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
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
  type GroupeComptage,
  type GroupeComptageListVariables,
} from "@/lib/graphql/inventory-operations";
import { useGroupeComptageList } from "@/lib/graphql/inventory-hooks";

/** Props for a comptage group list item. */
type GroupeListItemProps = {
  /** Comptage group data returned by the API. */
  group: GroupeComptage;
  /** Whether the group is currently selected. */
  isSelected: boolean;
  /** Callback fired when the user selects the group. */
  onSelect: (group: GroupeComptage) => void;
  /** Card border color derived from theme. */
  borderColor: string;
  /** Card background color derived from theme. */
  backgroundColor: string;
  /** Highlight color used for selected state. */
  highlightColor: string;
  /** Muted text color used for secondary labels. */
  mutedColor: string;
};

/** Limits the number of groups fetched per request. */
const GROUPE_LIST_LIMIT = 50;

/** Number of digits required for the group PIN. */
const PIN_LENGTH = 4;

/** Props for the PIN code input UI. */
type PinCodeInputProps = {
  /** Current PIN value. */
  value: string;
  /** Required PIN length. */
  length: number;
  /** Callback for updating the PIN value. */
  onChange: (value: string) => void;
  /** Input ref used to focus the hidden TextInput. */
  inputRef: React.RefObject<TextInput>;
  /** Default border color for each PIN box. */
  borderColor: string;
  /** Highlight color for the active PIN box. */
  highlightColor: string;
  /** Dot color for filled PIN boxes. */
  dotColor: string;
};

/**
 * Render a 4-digit PIN input with iOS-style boxes.
 */
function PinCodeInput({
  value,
  length,
  onChange,
  inputRef,
  borderColor,
  highlightColor,
  dotColor,
}: PinCodeInputProps) {
  /** Normalize incoming PIN values to digits only. */
  const handleChangeText = useCallback(
    (nextValue: string) => {
      const sanitized = nextValue.replace(/[^0-9]/g, "").slice(0, length);
      onChange(sanitized);
    },
    [length, onChange]
  );

  /** Focus the hidden input when the row is pressed. */
  const handleFocusRequest = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <Pressable
      style={styles.pinInputContainer}
      onPress={handleFocusRequest}
      accessibilityRole="button"
      accessibilityLabel="Saisir le code PIN"
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={false}
        caretHidden
        style={styles.hiddenPinInput}
      />
      <View style={styles.pinBoxRow}>
        {Array.from({ length }).map((_, index) => {
          const isFilled = index < value.length;
          const isActive =
            value.length < length
              ? index === value.length
              : index === length - 1;
          const boxBorderColor = isActive ? highlightColor : borderColor;

          return (
            <View
              key={`pin-box-${index}`}
              style={[styles.pinBox, { borderColor: boxBorderColor }]}
            >
              {isFilled ? (
                <View style={[styles.pinDot, { backgroundColor: dotColor }]} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/**
 * Render a comptage group card for the selection list.
 */
function GroupeListItem({
  group,
  isSelected,
  onSelect,
  borderColor,
  backgroundColor,
  highlightColor,
  mutedColor,
}: GroupeListItemProps) {
  const handlePress = useCallback(() => {
    onSelect(group);
  }, [group, onSelect]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderColor, backgroundColor },
        isSelected ? { borderColor: highlightColor } : null,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Choisir le groupe ${group.nom}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <ThemedText type="defaultSemiBold">{group.nom}</ThemedText>
          <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
            Appareil: {group.appareil_identifiant}
          </ThemedText>
          <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
            Utilisateur: {group.utilisateur.username}
          </ThemedText>
        </View>
        {isSelected ? (
          <View
            style={[styles.selectedBadge, { backgroundColor: highlightColor }]}
          >
            <ThemedText style={styles.selectedBadgeText}>
              Selectionne
            </ThemedText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Comptage group selection screen.
 */
export default function GroupSelectionScreen() {
  const router = useRouter();
  const { session, setCampaign, setGroup } = useComptageSession();
  const [searchText, setSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pinPromptGroup, setPinPromptGroup] = useState<GroupeComptage | null>(null);
  const [pinValue, setPinValue] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<TextInput>(null);

  const campaignId = session.campaign?.id ?? null;
  const selectedGroupId = session.group?.id ?? null;

  const queryVariables = useMemo<GroupeComptageListVariables>(
    () => ({
      campagne: campaignId,
      nameContains: searchText.trim() || null,
      limit: GROUPE_LIST_LIMIT,
    }),
    [campaignId, searchText]
  );

  const { groups, loading, errorMessage, refetch } = useGroupeComptageList(
    queryVariables,
    { skip: !campaignId }
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
  const modalSurfaceColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const modalOverlayColor = useThemeColor(
    { light: "rgba(15, 23, 42, 0.45)", dark: "rgba(15, 23, 42, 0.7)" },
    "background"
  );
  const pinDotColor = useThemeColor({ light: "#0F172A", dark: "#FFFFFF" }, "text");

  /** Update the search query used to filter groups. */
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  /** Open the PIN prompt for the selected group. */
  const handleSelectGroup = useCallback((group: GroupeComptage) => {
    setPinPromptGroup(group);
    setPinValue("");
    setPinError(null);
  }, []);

  /** Navigate back to the campaign list and reset the selection. */
  const handleChangeCampaign = useCallback(() => {
    setCampaign(null);
    router.push("/(drawer)");
  }, [router, setCampaign]);

  /** Retry group list retrieval after an error. */
  const handleRetry = useCallback(() => {
    refetch(queryVariables);
  }, [queryVariables, refetch]);

  /** Refresh the group list via pull-to-refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch(queryVariables);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryVariables, refetch]);

  /** Update the PIN input value. */
  const handlePinChange = useCallback((value: string) => {
    setPinValue(value.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH));
    setPinError(null);
  }, []);

  /** Close the PIN prompt without selecting the group. */
  const handleClosePinPrompt = useCallback(() => {
    setPinPromptGroup(null);
    setPinValue("");
    setPinError(null);
  }, []);

  /** Focus the PIN input after opening the modal. */
  useEffect(() => {
    if (!pinPromptGroup) {
      return;
    }

    const timer = setTimeout(() => {
      pinInputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [pinPromptGroup]);

  /** Validate the PIN, store the selected group, and navigate to locations. */
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
        setPinError("PIN invalide. Reessayez.");
        pinInputRef.current?.focus();
        return;
      }

      setGroup(pinPromptGroup);
      setPinPromptGroup(null);
      setPinValue("");
      setPinError(null);
      router.push("/(drawer)/lieux");
    },
    [pinPromptGroup, router, setGroup, pinInputRef]
  );

  /** Auto-validate PIN once all digits are entered. */
  useEffect(() => {
    if (!pinPromptGroup) {
      return;
    }

    if (pinValue.length === PIN_LENGTH) {
      handleConfirmPin(pinValue);
    }
  }, [handleConfirmPin, pinPromptGroup, pinValue]);

  /** Render a single group list row. */
  const renderItem = useCallback(
    ({ item }: { item: GroupeComptage }) => (
      <GroupeListItem
        group={item}
        isSelected={item.id === selectedGroupId}
        onSelect={handleSelectGroup}
        borderColor={borderColor}
        backgroundColor={surfaceColor}
        highlightColor={highlightColor}
        mutedColor={mutedColor}
      />
    ),
    [
      borderColor,
      handleSelectGroup,
      highlightColor,
      mutedColor,
      selectedGroupId,
      surfaceColor,
    ]
  );

  /** Provide stable keys for the group list. */
  const keyExtractor = useCallback((item: GroupeComptage) => item.id, []);

  const showInitialLoading = loading && groups.length === 0 && !isRefreshing;
  const showInlineError = Boolean(errorMessage && groups.length > 0);

  /** Render the list header with campaign context and search. */
  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <ThemedText type="title">Groupes</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Selectionnez votre groupe de comptage.
          </ThemedText>
        </View>

        <View style={[styles.campaignBanner, { borderColor }]}>
          <View style={styles.campaignInfo}>
            <ThemedText type="defaultSemiBold">
              Campagne: {session.campaign?.nom}
            </ThemedText>
            <ThemedText style={[styles.cardMeta, { color: mutedColor }]}>
              Code: {session.campaign?.code_campagne}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.changeButton, { borderColor }]}
            onPress={handleChangeCampaign}
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
            placeholder="Rechercher un groupe"
            placeholderTextColor={placeholderColor}
            autoCapitalize="none"
            autoCorrect={false}
            value={searchText}
            onChangeText={handleSearchChange}
          />
        </View>

        {selectedGroupId ? (
          <View style={[styles.selectedBanner, { borderColor }]}>
            <ThemedText type="defaultSemiBold">Groupe selectionne</ThemedText>
            <ThemedText style={{ color: mutedColor }}>
              {session.group?.nom}
            </ThemedText>
          </View>
        ) : null}

        {showInlineError ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorTitle}>
              Impossible de charger les groupes.
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
    handleChangeCampaign,
    handleRetry,
    handleSearchChange,
    highlightColor,
    inputTextColor,
    mutedColor,
    placeholderColor,
    searchText,
    selectedGroupId,
    session.campaign?.code_campagne,
    session.campaign?.nom,
    session.group?.nom,
    showInlineError,
    surfaceColor,
  ]);

  /** Render the empty/loading state for the group list. */
  const renderEmptyComponent = useCallback(() => {
    if (showInitialLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={highlightColor} />
          <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
            Chargement des groupes...
          </ThemedText>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorTitle}>
            Impossible de charger les groupes.
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
        <ThemedText type="subtitle">Aucun groupe trouve.</ThemedText>
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

  if (!campaignId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <ThemedText type="title">Aucune campagne selectionnee</ThemedText>
          <ThemedText style={[styles.missingText, { color: mutedColor }]}>
            Retournez a la liste des campagnes pour continuer.
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: highlightColor }]}
            onPress={handleChangeCampaign}
          >
            <ThemedText style={styles.retryButtonText}>
              Voir les campagnes
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={groups}
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
      <Modal
        transparent
        visible={Boolean(pinPromptGroup)}
        animationType="fade"
        onRequestClose={handleClosePinPrompt}
      >
        <View style={[styles.modalOverlay, { backgroundColor: modalOverlayColor }]}>
          <View style={[styles.modalCard, { backgroundColor: modalSurfaceColor }]}>
            <ThemedText type="subtitle">Code PIN</ThemedText>
            <ThemedText style={[styles.modalSubtitle, { color: mutedColor }]}>
              Saisissez le PIN a 4 chiffres pour valider le groupe
              {pinPromptGroup ? ` ${pinPromptGroup.nom}` : ""}.
            </ThemedText>
            <PinCodeInput
              value={pinValue}
              length={PIN_LENGTH}
              onChange={handlePinChange}
              inputRef={pinInputRef}
              borderColor={borderColor}
              highlightColor={highlightColor}
              dotColor={pinDotColor}
            />
            {pinError ? (
              <ThemedText style={[styles.pinErrorText, { color: "#DC2626" }]}>
                {pinError}
              </ThemedText>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor }]}
                onPress={handleClosePinPrompt}
              >
                <ThemedText style={styles.modalButtonText}>Annuler</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  campaignBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  campaignInfo: {
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
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalSubtitle: {
    fontSize: 14,
  },
  pinInputContainer: {
    alignItems: "center",
  },
  pinBoxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  pinBox: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  hiddenPinInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  pinErrorText: {
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
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
