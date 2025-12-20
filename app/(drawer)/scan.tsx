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
  type EnregistrementInventaireInput,
  type EnregistrementInventaireResult,
} from "@/lib/graphql/inventory-operations";
import { useCreateEnregistrementInventaire } from "@/lib/graphql/inventory-hooks";
import { Text } from "react-native-gesture-handler";

/** Payload used to render recent scan entries. */
type RecentScan = {
  /** Unique identifier for the scan, if available. */
  id: string | null;
  /** Scanned article code. */
  code: string;
  /** Capture timestamp as an ISO string. */
  capturedAt: string;
};

/** Limits the number of recent scans shown. */
const RECENT_SCANS_LIMIT = 6;

/**
 * Format a timestamp for display in French locale.
 */
function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/**
 * Convert API scan response into a local list item.
 */
function buildRecentScan(
  result: EnregistrementInventaireResult | null,
  fallbackCode: string
): RecentScan {
  const now = new Date().toISOString();
  return {
    id: result?.id ?? null,
    code: result?.code_article ?? fallbackCode,
    capturedAt: result?.capture_le ?? now,
  };
}

/**
 * Scan capture screen for the comptage flow.
 */
export default function ScanScreen() {
  const router = useRouter();
  const { session, setLocation } = useComptageSession();
  const [codeValue, setCodeValue] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const locationId = session.location?.id ?? null;

  const { submit, loading, errorMessage, mutationErrors, ok } =
    useCreateEnregistrementInventaire();

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
  const buttonTextColor = useThemeColor(
    { light: "#FFFFFF", dark: "#0F172A" },
    "text"
  );
  const placeholderColor = useThemeColor(
    { light: "#94A3B8", dark: "#6B7280" },
    "icon"
  );

  /** Update the scanned code input value. */
  const handleCodeChange = useCallback((value: string) => {
    setCodeValue(value.trim());
    setLocalError(null);
  }, []);

  /** Navigate back to location selection and reset the location. */
  const handleChangeLocation = useCallback(() => {
    setLocation(null);
    router.push("/(drawer)/lieux");
  }, [router, setLocation]);

  /** Clear errors and reload the view state on refresh. */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setLocalError(null);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /** Create the scan record through the API. */
  const handleSubmit = useCallback(async () => {
    if (!campaignId || !groupId || !locationId) {
      setLocalError("Selection incomplete. Retournez aux selections.");
      return;
    }

    if (!codeValue.trim()) {
      setLocalError("Le code article est requis.");
      return;
    }

    setLocalError(null);

    const payload: EnregistrementInventaireInput = {
      campagne: campaignId,
      groupe: groupId,
      lieu: locationId,
      code_article: codeValue.trim(),
      capture_le: new Date().toISOString(),
      source_scan: "manual",
    };

    const response = await submit(payload);
    const created =
      response?.create_enregistrementinventaire?.enregistrementinventaire ??
      null;

    if (response?.create_enregistrementinventaire?.ok) {
      setRecentScans((current) => {
        const next = [buildRecentScan(created, codeValue), ...current];
        return next.slice(0, RECENT_SCANS_LIMIT);
      });
      setCodeValue("");
      return;
    }

    if (response?.create_enregistrementinventaire?.errors?.length) {
      const error = response.create_enregistrementinventaire.errors[0];
      setLocalError(`${error.field}: ${error.messages.join(", ")}`);
      return;
    }

    setLocalError("Le scan n'a pas pu etre enregistre.");
  }, [campaignId, codeValue, groupId, locationId, submit]);

  /** Derived error message to display in the UI. */
  const errorDisplay = useMemo(() => {
    if (localError) {
      return localError;
    }

    if (errorMessage) {
      return errorMessage;
    }

    if (mutationErrors && mutationErrors.length > 0) {
      const error = mutationErrors[0];
      return `${error.field}: ${error.messages.join(", ")}`;
    }

    if (ok === false) {
      return "Le scan n'a pas pu etre enregistre.";
    }

    return null;
  }, [errorMessage, localError, mutationErrors, ok]);

  /** Provide stable keys for the recent scan list. */
  const keyExtractor = useCallback(
    (item: RecentScan, index: number) => item.id ?? `${item.code}-${index}`,
    []
  );

  /** Render the recent scans list items. */
  const renderItem = useCallback(
    ({ item }: { item: RecentScan }) => (
      <View
        style={[
          styles.recentCard,
          { borderColor, backgroundColor: surfaceColor },
        ]}
      >
        <ThemedText type="defaultSemiBold">{item.code}</ThemedText>
        <ThemedText style={[styles.recentMeta, { color: mutedColor }]}>
          {formatTimestamp(item.capturedAt)}
        </ThemedText>
      </View>
    ),
    [borderColor, mutedColor, surfaceColor]
  );

  if (!campaignId || !groupId || !locationId) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <ThemedText type="title">Selection incomplete</ThemedText>
          <ThemedText style={[styles.missingText, { color: mutedColor }]}>
            Choisissez une campagne, un groupe et un lieu avant de scanner.
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: highlightColor }]}
            onPress={() => router.push("/(drawer)/lieux")}
          >
            <ThemedText style={styles.retryButtonText}>
              Reprendre la selection
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={recentScans}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View style={styles.header}>
              <ThemedText type="title">Scan</ThemedText>
              <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
                Saisissez ou scannez un code article.
              </ThemedText>
            </View>

            <View style={[styles.contextCard, { borderColor }]}>
              <ThemedText type="defaultSemiBold">
                Campagne: {session.campaign?.nom}
              </ThemedText>
              <ThemedText style={[styles.contextMeta, { color: mutedColor }]}>
                Groupe: {session.group?.nom}
              </ThemedText>
              <ThemedText style={[styles.contextMeta, { color: mutedColor }]}>
                Lieu: {session.location?.locationname}
              </ThemedText>
              <TouchableOpacity
                style={[styles.changeButton, { borderColor }]}
                onPress={handleChangeLocation}
              >
                <ThemedText style={styles.changeButtonText}>
                  Changer le lieu
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    borderColor,
                    color: inputTextColor,
                    backgroundColor: surfaceColor,
                  },
                ]}
                placeholder="Code article"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                value={codeValue}
                onChangeText={handleCodeChange}
              />
              <TouchableOpacity
                style={[styles.scanButton, { backgroundColor: highlightColor }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={buttonTextColor} />
                ) : (
                  <ThemedText
                    style={[styles.scanButtonText, { color: buttonTextColor }]}
                  >
                    Enregistrer
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>

            {errorDisplay ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorTitle}>
                  Erreur lors du scan
                </ThemedText>
                <ThemedText
                  style={[styles.errorMessage, { color: mutedColor }]}
                >
                  {errorDisplay}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Derniers scans</ThemedText>
              <ThemedText style={[styles.sectionMeta, { color: mutedColor }]}>
                {recentScans.length} enregistrement(s)
              </ThemedText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText type="subtitle">Aucun scan enregistre</ThemedText>
            <ThemedText style={[styles.emptyMessage, { color: mutedColor }]}>
              Scannez un premier article pour demarrer.
            </ThemedText>
          </View>
        }
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
    gap: 16,
  },
  header: {
    gap: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  contextMeta: {
    fontSize: 13,
  },
  changeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputContainer: {
    gap: 12,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  scanButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorMessage: {
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionMeta: {
    fontSize: 13,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  recentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  recentMeta: {
    fontSize: 12,
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
