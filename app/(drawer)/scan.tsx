import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  type EnregistrementInventaireInput,
  type EnregistrementInventaireResult,
} from "@/lib/graphql/inventory-operations";
import { useCreateEnregistrementInventaire } from "@/lib/graphql/inventory-hooks";

/** Payload used to render recent scan entries. */
type RecentScan = {
  /** Unique identifier for the scan, if available. */
  id: string | null;
  /** Scanned article code. */
  code: string;
  /** Capture timestamp as an ISO string. */
  capturedAt: string;
};

/** Origin source of the scan capture. */
type ScanSource = "manual" | "camera";

/** Limits the number of recent scans shown. */
const RECENT_SCANS_LIMIT = 6;
/** Cooldown used to avoid duplicate camera scans. */
const CAMERA_SCAN_LOCK_MS = 1500;

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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanLocked, setIsScanLocked] = useState(false);
  const scanCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const hasCameraPermission = cameraPermission?.granted ?? false;
  const canAskCameraPermission = cameraPermission?.canAskAgain ?? true;
  const isScanBusy = isScanLocked || loading;
  const isCameraButtonDisabled = !hasCameraPermission && !canAskCameraPermission;
  const cameraButtonLabel = hasCameraPermission
    ? isCameraActive
      ? "Desactiver la camera"
      : "Activer la camera"
    : canAskCameraPermission
      ? "Autoriser la camera"
      : "Autorisation bloquee";
  const cameraStatusMessage = hasCameraPermission
    ? isCameraActive
      ? "Visez un code-barres pour scanner."
      : "Activez la camera pour scanner."
    : canAskCameraPermission
      ? "Autorisez la camera pour scanner."
      : "Autorisation refusee. Activez-la dans les reglages.";

  useEffect(() => {
    if (!hasCameraPermission) {
      setIsCameraActive(false);
    }
  }, [hasCameraPermission]);

  useEffect(() => {
    return () => {
      if (scanCooldownRef.current) {
        clearTimeout(scanCooldownRef.current);
      }
    };
  }, []);

  /** Update the scanned code input value. */
  const handleCodeChange = useCallback((value: string) => {
    setCodeValue(value.trim());
    setLocalError(null);
  }, []);

  /** Trigger a success haptic feedback on supported devices. */
  const triggerSuccessHaptic = useCallback(async () => {
    try {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch {
      // Ignore haptic errors on unsupported devices.
    }
  }, []);

  /** Request camera permission and start preview when allowed. */
  const handleRequestCamera = useCallback(async () => {
    const response = await requestCameraPermission();
    if (response.granted) {
      setIsCameraActive(true);
    }
  }, [requestCameraPermission]);

  /** Toggle the camera preview when permission is granted. */
  const handleToggleCamera = useCallback(() => {
    if (!hasCameraPermission) {
      return;
    }

    setIsCameraActive((previous) => !previous);
  }, [hasCameraPermission]);

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
  const submitScan = useCallback(
    async (rawCode: string, source: ScanSource) => {
      if (loading) {
        return;
      }

      if (!campaignId || !groupId || !locationId) {
        setLocalError("Selection incomplete. Retournez aux selections.");
        return;
      }

      const cleanedCode = rawCode.trim();
      if (!cleanedCode) {
        setLocalError("Le code article est requis.");
        return;
      }

      setLocalError(null);

      const payload: EnregistrementInventaireInput = {
        campagne: campaignId,
        groupe: groupId,
        lieu: locationId,
        code_article: cleanedCode,
        capture_le: new Date().toISOString(),
        source_scan: source,
      };

      const response = await submit(payload);
      const created =
        response?.create_enregistrementinventaire?.enregistrementinventaire ??
        null;

      if (response?.create_enregistrementinventaire?.ok) {
        setRecentScans((current) => {
          const next = [buildRecentScan(created, cleanedCode), ...current];
          return next.slice(0, RECENT_SCANS_LIMIT);
        });
        setCodeValue("");
        await triggerSuccessHaptic();
        return;
      }

      if (response?.create_enregistrementinventaire?.errors?.length) {
        const error = response.create_enregistrementinventaire.errors[0];
        setLocalError(`${error.field}: ${error.messages.join(", ")}`);
        return;
      }

      setLocalError("Le scan n'a pas pu etre enregistre.");
    },
    [
      campaignId,
      groupId,
      locationId,
      loading,
      submit,
      triggerSuccessHaptic,
    ]
  );

  /** Handle barcode events from the camera view. */
  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (isScanLocked || loading) {
        return;
      }

      const scannedCode = result.data?.trim();
      if (!scannedCode) {
        return;
      }

      setIsScanLocked(true);
      setCodeValue(scannedCode);
      void submitScan(scannedCode, "camera");

      if (scanCooldownRef.current) {
        clearTimeout(scanCooldownRef.current);
      }

      scanCooldownRef.current = setTimeout(() => {
        setIsScanLocked(false);
      }, CAMERA_SCAN_LOCK_MS);
    },
    [isScanLocked, loading, submitScan]
  );

  /** Create the scan record through the API from the manual input. */
  const handleManualSubmit = useCallback(async () => {
    await submitScan(codeValue, "manual");
  }, [codeValue, submitScan]);

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

            <View
              style={[
                styles.cameraCard,
                { borderColor, backgroundColor: surfaceColor },
              ]}
            >
              <View style={styles.cameraHeader}>
                <ThemedText type="defaultSemiBold">Camera</ThemedText>
                <TouchableOpacity
                  style={[
                    styles.cameraButton,
                    {
                      backgroundColor: highlightColor,
                      opacity: isCameraButtonDisabled ? 0.5 : 1,
                    },
                  ]}
                  onPress={
                    hasCameraPermission ? handleToggleCamera : handleRequestCamera
                  }
                  disabled={isCameraButtonDisabled}
                >
                  <ThemedText
                    style={[styles.cameraButtonText, { color: buttonTextColor }]}
                  >
                    {cameraButtonLabel}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={[styles.cameraMeta, { color: mutedColor }]}>
                {cameraStatusMessage}
              </ThemedText>

              {hasCameraPermission && isCameraActive ? (
                <View style={styles.cameraPreviewWrapper}>
                  <CameraView
                    style={styles.cameraPreview}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                  {isScanBusy ? (
                    <View style={styles.cameraOverlay}>
                      <ThemedText
                        style={[
                          styles.cameraOverlayText,
                          { color: buttonTextColor },
                        ]}
                      >
                        Scan en cours...
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}
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
                onPress={handleManualSubmit}
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
  cameraCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cameraButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cameraButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cameraMeta: {
    fontSize: 13,
  },
  cameraPreviewWrapper: {
    borderRadius: 12,
    overflow: "hidden",
  },
  cameraPreview: {
    height: 220,
    width: "100%",
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  cameraOverlayText: {
    fontSize: 14,
    fontWeight: "600",
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
