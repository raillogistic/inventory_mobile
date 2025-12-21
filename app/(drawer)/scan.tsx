import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  BarcodeType,
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
  type ArticleLookup,
  type ArticleLookupVariables,
  type AffectationListVariables,
  type EnregistrementInventaireInput,
  type EnregistrementInventaireEtat,
  type EnregistrementInventaireListItem,
  type EnregistrementInventaireListVariables,
  type EnregistrementInventaireResult,
} from "@/lib/graphql/inventory-operations";
import {
  useAffectationList,
  useArticleLookupByCodes,
  useCreateEnregistrementInventaire,
  useEnregistrementInventaireList,
  useUpdateEnregistrementInventaire,
} from "@/lib/graphql/inventory-hooks";

/** Payload used to render recent scan entries. */
type RecentScan = {
  /** Unique identifier for the scan, if available. */
  id: string | null;
  /** Scanned article code. */
  code: string;
  /** Optional article description returned by the API. */
  description: string | null;
  /** Whether the scanned code matches a known article. */
  hasArticle: boolean;
  /** Capture timestamp as an ISO string. */
  capturedAt: string;
};

/** Scan payloads used to build local entries. */
type EnregistrementInventaireSummary =
  | EnregistrementInventaireResult
  | EnregistrementInventaireListItem;

/** Origin source of the scan capture. */
type ScanSource = "manual" | "camera";

/** Visual status applied to location article rows. */
type LocationArticleStatus = "pending" | "scanned" | "missing" | "other";

/** Payload used to render location article rows. */
type LocationArticleItem = {
  /** Unique identifier for the row, when available. */
  id: string | null;
  /** Article code displayed in the list. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Status used to drive list coloring. */
  status: LocationArticleStatus;
  /** Source list for the row. */
  source: "location" | "extra";
};

/** Payload used to render the scan detail modal. */
type ScanDetail = {
  /** Unique identifier for the scan record. */
  id: string | null;
  /** Scanned article code displayed in the modal. */
  code: string;
  /** Optional description for the scanned article. */
  description: string | null;
  /** Status used to highlight the scanned article. */
  status: LocationArticleStatus;
  /** Short label for the scan status. */
  statusLabel: string;
  /** Scan timestamp used for the modal subtitle. */
  capturedAt: string;
};

/** Etat option displayed in the scan modal. */
type EtatOption = {
  /** Etat value persisted in the backend. */
  value: EnregistrementInventaireEtat;
  /** Human-readable label shown in the UI. */
  label: string;
};

/** Layout rectangle used to validate barcode positions. */
type ScanFrameLayout = {
  /** Left position relative to the camera preview. */
  x: number;
  /** Top position relative to the camera preview. */
  y: number;
  /** Width of the scan frame. */
  width: number;
  /** Height of the scan frame. */
  height: number;
};

/** Limits the number of scans fetched to drive status updates. */
const SCAN_STATUS_LIMIT = 2000;
/** Limits the number of location articles fetched per request. */
const LOCATION_ARTICLE_LIMIT = 2000;
/** Supported 1D barcode formats for the camera scanner. */
const BARCODE_TYPES: BarcodeType[] = [
  BarcodeType.code128,
  BarcodeType.code39,
  BarcodeType.code93,
  BarcodeType.ean13,
  BarcodeType.ean8,
  BarcodeType.itf14,
  BarcodeType.upcA,
  BarcodeType.upcE,
  BarcodeType.upcEan,
  BarcodeType.codabar,
];
/** Etat options available when validating a scan. */
const ETAT_OPTIONS: EtatOption[] = [
  { value: "BIEN", label: "Bien" },
  { value: "MOYENNE", label: "Moyenne" },
  { value: "HORS_SERVICE", label: "Hors service" },
];

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
  result: EnregistrementInventaireSummary | null,
  fallbackCode: string
): RecentScan {
  const now = new Date().toISOString();
  return {
    id: result?.id ?? null,
    code: result?.code_article ?? fallbackCode,
    description: result?.article?.desc ?? null,
    hasArticle: Boolean(result?.article),
    capturedAt: result?.capture_le ?? now,
  };
}

/**
 * Convert a scan list item into a recent scan entry.
 */
function mapScanItemToRecentScan(
  item: EnregistrementInventaireListItem
): RecentScan {
  return buildRecentScan(item, item.code_article);
}

/**
 * Build a stable key for a scan entry.
 */
function getScanKey(scan: RecentScan): string {
  return scan.id ?? `${scan.code}-${scan.capturedAt}`;
}

/**
 * Merge scans, keeping unique entries in order.
 */
function mergeUniqueScans(
  primary: RecentScan[],
  secondary: RecentScan[]
): RecentScan[] {
  const seen = new Set<string>();
  const merged: RecentScan[] = [];

  for (const scan of primary) {
    const key = getScanKey(scan);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(scan);
  }

  for (const scan of secondary) {
    const key = getScanKey(scan);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(scan);
  }

  return merged;
}

/**
 * Normalize scan codes for comparison.
 */
function normalizeScanCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Convert a scan status to a short, human-readable label.
 */
function getStatusLabel(status: LocationArticleStatus): string {
  switch (status) {
    case "scanned":
      return "Article du lieu";
    case "other":
      return "Article hors lieu";
    case "missing":
      return "Article inconnu";
    default:
      return "Article en attente";
  }
}

/**
 * Validate that a scanned barcode sits inside the scan frame.
 */
function isBarcodeInsideFrame(
  bounds: BarcodeScanningResult["bounds"] | undefined,
  frame: ScanFrameLayout | null
): boolean {
  if (!bounds || !frame) {
    return false;
  }

  const hasOrigin = "origin" in bounds && Boolean(bounds.origin);
  const hasSize = "size" in bounds && Boolean(bounds.size);
  if (!hasOrigin || !hasSize) {
    return false;
  }

  const centerX = bounds.origin.x + bounds.size.width / 2;
  const centerY = bounds.origin.y + bounds.size.height / 2;
  return (
    centerX >= frame.x &&
    centerX <= frame.x + frame.width &&
    centerY >= frame.y &&
    centerY <= frame.y + frame.height
  );
}

/**
 * Scan capture screen for the comptage flow.
 */
export default function ScanScreen() {
  const router = useRouter();
  const { session, setLocation } = useComptageSession();
  const [codeValue, setCodeValue] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [etatMessage, setEtatMessage] = useState<string | null>(null);
  const [localScans, setLocalScans] = useState<RecentScan[]>([]);
  const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanLocked, setIsScanLocked] = useState(false);
  const [scanFrameLayout, setScanFrameLayout] =
    useState<ScanFrameLayout | null>(null);
  const [selectedEtat, setSelectedEtat] =
    useState<EnregistrementInventaireEtat | null>(null);
  const codeInputRef = useRef<TextInput>(null);
  const scanLockRef = useRef(false);

  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const locationId = session.location?.id ?? null;
  const scanQueryVariables = useMemo<EnregistrementInventaireListVariables>(
    () => ({
      campagne: campaignId,
      groupe: groupId,
      lieu: locationId,
      limit: SCAN_STATUS_LIMIT,
    }),
    [campaignId, groupId, locationId]
  );
  const scanQuerySkip = !campaignId || !groupId || !locationId;

  const locationArticleVariables = useMemo<AffectationListVariables>(
    () => ({
      location: locationId,
      limit: LOCATION_ARTICLE_LIMIT,
    }),
    [locationId]
  );
  const locationArticleSkip = !locationId;

  const {
    scans: serverScans,
    totalCount: serverCount,
    errorMessage: scansErrorMessage,
    refetch: refetchScans,
  } = useEnregistrementInventaireList(scanQueryVariables, {
    skip: scanQuerySkip,
  });

  const {
    affectations,
    loading: locationArticlesLoading,
    errorMessage: locationArticlesErrorMessage,
    refetch: refetchLocationArticles,
  } = useAffectationList(locationArticleVariables, { skip: locationArticleSkip });

  const { submit, loading, errorMessage, mutationErrors, ok } =
    useCreateEnregistrementInventaire();
  const {
    submit: submitEtat,
    loading: etatLoading,
    errorMessage: etatErrorMessage,
    mutationErrors: etatMutationErrors,
  } = useUpdateEnregistrementInventaire();

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
  const successBackgroundColor = useThemeColor(
    { light: "#16A34A", dark: "#22C55E" },
    "tint"
  );
  const warningBackgroundColor = useThemeColor(
    { light: "#FBBF24", dark: "#F59E0B" },
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
  const missingBackgroundColor = useThemeColor(
    { light: "#DC2626", dark: "#B91C1C" },
    "tint"
  );
  const missingTextColor = "#FFFFFF";
  const successTextColor = "#FFFFFF";
  const warningTextColor = useThemeColor(
    { light: "#1F2937", dark: "#0F172A" },
    "text"
  );
  const placeholderColor = useThemeColor(
    { light: "#94A3B8", dark: "#6B7280" },
    "icon"
  );
  const modalCardColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const modalOverlayColor = useThemeColor(
    { light: "rgba(15, 23, 42, 0.55)", dark: "rgba(15, 23, 42, 0.75)" },
    "background"
  );
  const hasCameraPermission = cameraPermission?.granted ?? false;
  const canAskCameraPermission = cameraPermission?.canAskAgain ?? true;
  const isScanModalVisible = Boolean(scanDetail);
  const isScanBusy = isScanLocked || loading || isScanModalVisible;
  const isCameraButtonDisabled =
    !hasCameraPermission && !canAskCameraPermission;
  const cameraButtonLabel = hasCameraPermission
    ? isCameraActive
      ? "Desactiver la camera"
      : "Activer la camera"
    : canAskCameraPermission
    ? "Autoriser la camera"
    : "Autorisation bloquee";
  const cameraStatusMessage = hasCameraPermission
    ? isCameraActive
      ? "Mode scan actif."
      : "Activez la camera pour scanner."
    : canAskCameraPermission
    ? "Autorisez la camera pour scanner."
    : "Autorisation refusee. Activez-la dans les reglages.";
  const serverScanItems = useMemo(
    () => serverScans.map(mapScanItemToRecentScan),
    [serverScans]
  );
  const mergedScans = useMemo(
    () => mergeUniqueScans(localScans, serverScanItems),
    [localScans, serverScanItems]
  );
  const existingCodes = useMemo(() => {
    const set = new Set<string>();
    for (const scan of mergedScans) {
      const normalized = normalizeScanCode(scan.code);
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [mergedScans]);
  const scanCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const scan of mergedScans) {
      const trimmed = scan.code.trim();
      if (!trimmed) {
        continue;
      }
      codes.add(trimmed);
      codes.add(trimmed.toUpperCase());
      codes.add(trimmed.toLowerCase());
    }
    return Array.from(codes);
  }, [mergedScans]);
  const articleQueryVariables = useMemo<ArticleLookupVariables>(
    () => ({
      codes: scanCodes,
      limit: scanCodes.length || null,
    }),
    [scanCodes]
  );
  const {
    articles: lookupArticles,
    errorMessage: articlesErrorMessage,
  } = useArticleLookupByCodes(articleQueryVariables, {
    skip: scanCodes.length === 0,
  });
  const articleLookup = useMemo(() => {
    const map = new Map<string, ArticleLookup>();
    for (const article of lookupArticles) {
      const normalized = normalizeScanCode(article.code);
      if (!normalized) {
        continue;
      }
      map.set(normalized, article);
    }
    return map;
  }, [lookupArticles]);
  const resolvedScans = useMemo(
    () =>
      mergedScans.map((scan) => {
        const normalized = normalizeScanCode(scan.code);
        const lookup = normalized ? articleLookup.get(normalized) : null;
        const description = scan.description ?? lookup?.desc ?? null;
        const hasArticle = scan.hasArticle || Boolean(lookup);
        return { ...scan, description, hasArticle };
      }),
    [articleLookup, mergedScans]
  );
  const locationArticles = useMemo(() => {
    const map = new Map<string, { id: string; code: string; description: string | null }>();

    for (const affectation of affectations) {
      const article = affectation.article;
      if (!article) {
        continue;
      }

      const normalized = normalizeScanCode(article.code);
      if (!normalized) {
        continue;
      }

      if (!map.has(normalized)) {
        map.set(normalized, {
          id: article.id,
          code: article.code,
          description: article.desc ?? null,
        });
      }
    }

    const items = Array.from(map.values());
    items.sort((a, b) => a.code.localeCompare(b.code));
    return items;
  }, [affectations]);
  const locationArticleCodeSet = useMemo(() => {
    const set = new Set<string>();
    for (const article of locationArticles) {
      const normalized = normalizeScanCode(article.code);
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [locationArticles]);
  const locationArticleItems = useMemo<LocationArticleItem[]>(
    () =>
      locationArticles.map((article) => {
        const normalized = normalizeScanCode(article.code);
        const isScanned = normalized ? existingCodes.has(normalized) : false;
        return {
          id: article.id,
          code: article.code,
          description: article.description,
          status: isScanned ? "scanned" : "pending",
          source: "location",
        };
      }),
    [existingCodes, locationArticles]
  );
  const extraScanItems = useMemo<LocationArticleItem[]>(
    () => {
      const items: LocationArticleItem[] = [];
      const seen = new Set<string>();

      for (const scan of resolvedScans) {
        const normalized = normalizeScanCode(scan.code);
        if (!normalized || locationArticleCodeSet.has(normalized)) {
          continue;
        }
        if (seen.has(normalized)) {
          continue;
        }

        seen.add(normalized);
        const status: LocationArticleStatus = scan.hasArticle ? "other" : "missing";

        items.push({
          id: scan.id,
          code: scan.code,
          description: scan.description ?? null,
          status,
          source: "extra",
        });
      }

      return items;
    },
    [locationArticleCodeSet, resolvedScans]
  );
  const articleListItems = useMemo<LocationArticleItem[]>(
    () => [...extraScanItems, ...locationArticleItems],
    [extraScanItems, locationArticleItems]
  );
  const scannedLocationCount = useMemo(() => {
    return locationArticleItems.filter((item) => item.status === "scanned").length;
  }, [locationArticleItems]);
  const articleCountLabel = useMemo(() => {
    if (locationArticleItems.length === 0) {
      return extraScanItems.length > 0
        ? `0 article | +${extraScanItems.length} hors lieu`
        : "0 article";
    }

    const extraLabel =
      extraScanItems.length > 0 ? ` | +${extraScanItems.length} hors lieu` : "";

    return `${scannedLocationCount}/${locationArticleItems.length} scannes${extraLabel}`;
  }, [extraScanItems.length, locationArticleItems.length, scannedLocationCount]);
  const totalScanCount = useMemo(() => {
    if (serverCount !== null) {
      return serverCount + localScans.length;
    }

    return mergedScans.length;
  }, [localScans.length, mergedScans.length, serverCount]);
  const lastScan = resolvedScans[0] ?? null;
  const showArticleLoading =
    locationArticlesLoading && articleListItems.length === 0 && !isRefreshing;
  const cameraOverlayLabel = loading ? "Scan en cours..." : null;

  useEffect(() => {
    if (!hasCameraPermission) {
      setIsCameraActive(false);
    }
  }, [hasCameraPermission]);

  useEffect(() => {
    if (!hasCameraPermission || !isCameraActive) {
      scanLockRef.current = false;
      setIsScanLocked(false);
      setScanFrameLayout(null);
    }
  }, [hasCameraPermission, isCameraActive]);

  useEffect(() => {
    setLocalScans([]);
    setScanDetail(null);
    setInfoMessage(null);
    setEtatMessage(null);
    setSelectedEtat(null);
    scanLockRef.current = false;
    setIsScanLocked(false);
  }, [campaignId, groupId, locationId]);

  useEffect(() => {
    if (localScans.length === 0) {
      return;
    }

    const serverKeys = new Set(serverScanItems.map(getScanKey));
    setLocalScans((current) => {
      if (current.length === 0) {
        return current;
      }

      const filtered = current.filter(
        (scan) => !serverKeys.has(getScanKey(scan))
      );

      return filtered.length === current.length ? current : filtered;
    });
  }, [localScans, serverScanItems]);

  /** Update the scanned code input value. */
  const handleCodeChange = useCallback((value: string) => {
    setCodeValue(value.trim());
    setLocalError(null);
    setInfoMessage(null);
    setEtatMessage(null);
  }, []);

  /** Close the scan detail modal and prepare for the next scan. */
  const handleCloseScanModal = useCallback(() => {
    setScanDetail(null);
    setLocalError(null);
    setInfoMessage(null);
    setEtatMessage(null);
    setCodeValue("");
    setSelectedEtat(null);
    if (hasCameraPermission) {
      setIsCameraActive(true);
    }
    codeInputRef.current?.focus();
  }, [hasCameraPermission]);

  /** Select the scan status before validating the scan. */
  const handleEtatSelect = useCallback((value: EnregistrementInventaireEtat) => {
    setSelectedEtat(value);
    setEtatMessage(null);
  }, []);

  /** Trigger a success haptic feedback on supported devices. */
  const triggerSuccessHaptic = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      const refreshCalls: Promise<unknown>[] = [];
      if (!scanQuerySkip) {
        refreshCalls.push(refetchScans(scanQueryVariables));
      }
      if (!locationArticleSkip) {
        refreshCalls.push(refetchLocationArticles(locationArticleVariables));
      }
      await Promise.all(refreshCalls);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    locationArticleSkip,
    locationArticleVariables,
    refetchLocationArticles,
    refetchScans,
    scanQuerySkip,
    scanQueryVariables,
  ]);

  /** Create the scan record through the API. */
  const submitScan = useCallback(
    async (rawCode: string, source: ScanSource) => {
      if (loading) {
        return;
      }

      if (isScanModalVisible) {
        return;
      }

      if (!campaignId || !groupId || !locationId) {
        setLocalError("Selection incomplete. Retournez aux selections.");
        return;
      }

      const cleanedCode = rawCode.trim();
      const normalizedCode = normalizeScanCode(cleanedCode);

      if (!normalizedCode) {
        setLocalError("Le code article est requis.");
        return;
      }

      if (existingCodes.has(normalizedCode)) {
        setLocalError(null);
        setInfoMessage("Code deja scanne pour ce lieu.");
        return;
      }

      setLocalError(null);
      setInfoMessage(null);

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
        setIsCameraActive(false);
        const nextScan = buildRecentScan(created, cleanedCode);
        const lookup = normalizedCode
          ? articleLookup.get(normalizedCode)
          : null;
        const isInLocation = normalizedCode
          ? locationArticleCodeSet.has(normalizedCode)
          : false;
        const hasKnownArticle = Boolean(created?.article) || Boolean(lookup);
        const status: LocationArticleStatus = isInLocation
          ? "scanned"
          : hasKnownArticle
          ? "other"
          : "missing";
        const statusLabel = getStatusLabel(status);
        const detailDescription =
          nextScan.description ?? lookup?.desc ?? null;

        setLocalScans((current) => {
          const next = [nextScan, ...current];
          return next.slice(0, SCAN_STATUS_LIMIT);
        });
        setScanDetail({
          id: created?.id ?? null,
          code: cleanedCode,
          description: detailDescription,
          status,
          statusLabel,
          capturedAt: nextScan.capturedAt,
        });
        setSelectedEtat(null);
        setEtatMessage(null);
        setCodeValue("");
        await triggerSuccessHaptic();
        void refetchScans(scanQueryVariables);
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
      articleLookup,
      campaignId,
      existingCodes,
      groupId,
      isScanModalVisible,
      locationArticleCodeSet,
      locationId,
      loading,
      refetchScans,
      scanQueryVariables,
      submit,
      triggerSuccessHaptic,
    ]
  );

  /** Handle barcode events from the camera view. */
  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (
        scanLockRef.current ||
        loading ||
        isScanModalVisible ||
        !hasCameraPermission ||
        !isCameraActive
      ) {
        return;
      }

      const scannedCode = result.data?.trim();
      const normalizedCode = normalizeScanCode(scannedCode ?? "");
      if (!normalizedCode) {
        return;
      }

      if (!isBarcodeInsideFrame(result.bounds, scanFrameLayout)) {
        return;
      }

      scanLockRef.current = true;
      setIsScanLocked(true);
      setCodeValue(scannedCode);
      void (async () => {
        await submitScan(scannedCode, "camera");
        scanLockRef.current = false;
        setIsScanLocked(false);
      })();
    },
    [
      hasCameraPermission,
      isCameraActive,
      isScanModalVisible,
      loading,
      scanFrameLayout,
      submitScan,
    ]
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
  const etatErrorDisplay = useMemo(() => {
    if (etatMessage) {
      return etatMessage;
    }

    if (etatMutationErrors && etatMutationErrors.length > 0) {
      const error = etatMutationErrors[0];
      return `${error.field}: ${error.messages.join(", ")}`;
    }

    if (etatErrorMessage) {
      return etatErrorMessage;
    }

    return null;
  }, [etatErrorMessage, etatMessage, etatMutationErrors]);
  const infoDisplay = useMemo(() => infoMessage, [infoMessage]);

  /** Derived error message for list loading. */
  const listErrorDisplay = useMemo(() => {
    const errors: string[] = [];

    if (locationArticlesErrorMessage) {
      errors.push(`Articles: ${locationArticlesErrorMessage}`);
    }

    if (scansErrorMessage) {
      errors.push(`Scans: ${scansErrorMessage}`);
    }

    if (articlesErrorMessage) {
      errors.push(`Recherche: ${articlesErrorMessage}`);
    }

    return errors.length > 0 ? errors.join(" | ") : null;
  }, [articlesErrorMessage, locationArticlesErrorMessage, scansErrorMessage]);

  /** Provide stable keys for the article list. */
  const keyExtractor = useCallback(
    (item: LocationArticleItem) => `${item.source}-${item.code}`,
    []
  );

  /** Render the location article list items. */
  const renderItem = useCallback(
    ({ item }: { item: LocationArticleItem }) => {
      const isMissing = item.status === "missing";
      const isOtherLocation = item.status === "other";
      const isScanned = item.status === "scanned";
      const cardBorderColor = isMissing
        ? missingBackgroundColor
        : isOtherLocation
        ? warningBackgroundColor
        : isScanned
        ? successBackgroundColor
        : borderColor;
      const cardBackgroundColor = isMissing
        ? missingBackgroundColor
        : isOtherLocation
        ? warningBackgroundColor
        : isScanned
        ? successBackgroundColor
        : surfaceColor;
      const primaryTextColor = isMissing
        ? missingTextColor
        : isOtherLocation
        ? warningTextColor
        : isScanned
        ? successTextColor
        : undefined;
      const secondaryTextColor = isMissing
        ? missingTextColor
        : isOtherLocation
        ? warningTextColor
        : isScanned
        ? successTextColor
        : mutedColor;

      return (
        <View
          style={[
            styles.recentCard,
            { borderColor: cardBorderColor, backgroundColor: cardBackgroundColor },
          ]}
        >
          <ThemedText type="defaultSemiBold" style={{ color: primaryTextColor }}>
            {item.code}
          </ThemedText>
          {item.description ? (
            <ThemedText
              style={[styles.recentDescription, { color: secondaryTextColor }]}
            >
              {item.description}
            </ThemedText>
          ) : null}
        </View>
      );
    },
    [
      borderColor,
      missingBackgroundColor,
      missingTextColor,
      mutedColor,
      successBackgroundColor,
      successTextColor,
      surfaceColor,
      warningBackgroundColor,
      warningTextColor,
    ]
  );

  /** Persist the selected state and move to the next scan. */
  const handleConfirmEtat = useCallback(async () => {
    if (!scanDetail?.id) {
      setEtatMessage("Impossible d'identifier l'enregistrement.");
      return;
    }

    if (!selectedEtat) {
      setEtatMessage("Choisissez un etat avant de continuer.");
      return;
    }

    setEtatMessage(null);
    const response = await submitEtat({
      id: scanDetail.id,
      etat: selectedEtat,
    });
    if (response?.update_enregistrementinventaire?.ok) {
      handleCloseScanModal();
      return;
    }

    if (response?.update_enregistrementinventaire?.errors?.length) {
      const error = response.update_enregistrementinventaire.errors[0];
      setEtatMessage(`${error.field}: ${error.messages.join(", ")}`);
      return;
    }

    setEtatMessage("L'etat n'a pas pu etre enregistre.");
  }, [handleCloseScanModal, scanDetail?.id, selectedEtat, submitEtat]);
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
        data={articleListItems}
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
                styles.recapCard,
                { borderColor, backgroundColor: surfaceColor },
              ]}
            >
              <View style={styles.recapRow}>
                <ThemedText style={[styles.recapLabel, { color: mutedColor }]}>
                  Scans enregistres
                </ThemedText>
                <ThemedText type="defaultSemiBold">{totalScanCount}</ThemedText>
              </View>
              {lastScan ? (
                <View style={styles.recapRow}>
                  <ThemedText
                    style={[styles.recapLabel, { color: mutedColor }]}
                  >
                    Dernier scan
                  </ThemedText>
                  <View style={styles.recapValueColumn}>
                    <ThemedText type="defaultSemiBold">
                      {lastScan.code}
                    </ThemedText>
                    <ThemedText
                      style={[styles.recapMeta, { color: mutedColor }]}
                    >
                      {formatTimestamp(lastScan.capturedAt)}
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <ThemedText style={[styles.recapEmpty, { color: mutedColor }]}>
                  Aucun scan enregistre pour l'instant.
                </ThemedText>
              )}
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
                    hasCameraPermission
                      ? handleToggleCamera
                      : handleRequestCamera
                  }
                  disabled={isCameraButtonDisabled}
                >
                  <ThemedText
                    style={[
                      styles.cameraButtonText,
                      { color: buttonTextColor },
                    ]}
                  >
                    {cameraButtonLabel}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={[styles.cameraMeta, { color: mutedColor }]}>
                {cameraStatusMessage}
              </ThemedText>
              <Modal
                transparent
                visible={hasCameraPermission && isCameraActive}
                animationType="fade"
                onRequestClose={() => setIsCameraActive(false)}
              >
                <View style={styles.cameraModalOverlay}>
                  <CameraView
                    style={styles.cameraPreview}
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                  />
                  <View style={styles.scanFrameOverlay} pointerEvents="none">
                    <View
                      style={styles.scanFrame}
                      onLayout={({ nativeEvent }) =>
                        setScanFrameLayout(nativeEvent.layout)
                      }
                    />
                  </View>
                  <View style={styles.cameraHud}>
                    <ThemedText style={styles.cameraHudTitle}>
                      Mode scan
                    </ThemedText>
                    <ThemedText style={[styles.cameraHint, { color: mutedColor }]}>
                      Placez le code-barres dans le cadre pour le scanner.
                    </ThemedText>
                    <TouchableOpacity
                      style={[
                        styles.cameraCloseButton,
                        { backgroundColor: highlightColor },
                      ]}
                      onPress={() => setIsCameraActive(false)}
                    >
                      <ThemedText
                        style={[
                          styles.cameraCloseButtonText,
                          { color: buttonTextColor },
                        ]}
                      >
                        Fermer
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  {isScanBusy && cameraOverlayLabel ? (
                    <View style={styles.cameraOverlay}>
                      <ThemedText
                        style={[
                          styles.cameraOverlayText,
                          { color: buttonTextColor },
                        ]}
                      >
                        {cameraOverlayLabel}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Modal>
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
                editable={!isScanModalVisible}
                ref={codeInputRef}
              />
              <TouchableOpacity
                style={[styles.scanButton, { backgroundColor: highlightColor }]}
                onPress={handleManualSubmit}
                disabled={loading || isScanModalVisible}
                accessibilityRole="button"
                accessibilityLabel="Enregistrer le code article"
              >
                {loading ? (
                  <ActivityIndicator color={buttonTextColor} size="small" />
                ) : (
                  <ThemedText
                    style={[styles.scanButtonText, { color: buttonTextColor }]}
                  >
                    &gt;
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

            {infoDisplay ? (
              <View
                style={[
                  styles.infoContainer,
                  { backgroundColor: surfaceColor, borderColor },
                ]}
              >
                <ThemedText style={styles.infoTitle}>
                  Code deja scanne
                </ThemedText>
                <ThemedText style={[styles.infoMessage, { color: mutedColor }]}>
                  {infoDisplay}
                </ThemedText>
              </View>
            ) : null}

            {listErrorDisplay ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorTitle}>
                  Impossible de charger les articles.
                </ThemedText>
                <ThemedText
                  style={[styles.errorMessage, { color: mutedColor }]}
                >
                  {listErrorDisplay}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">Articles du lieu</ThemedText>
              <ThemedText style={[styles.sectionMeta, { color: mutedColor }]}>
                {articleCountLabel}
              </ThemedText>
            </View>
          </View>
        }
        ListEmptyComponent={
          showArticleLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={highlightColor} />
              <ThemedText style={[styles.emptyMessage, { color: mutedColor }]}>
                Chargement des articles...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <ThemedText type="subtitle">Aucun article pour ce lieu</ThemedText>
              <ThemedText style={[styles.emptyMessage, { color: mutedColor }]}>
                Verifiez les affectations ou contactez l'administrateur.
              </ThemedText>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        alwaysBounceVertical
      />
      <Modal
        transparent
        visible={isScanModalVisible}
        animationType="fade"
        onRequestClose={handleConfirmEtat}
      >
        <View style={[styles.modalOverlay, { backgroundColor: modalOverlayColor }]}>
          {scanDetail ? (
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: modalCardColor,
                  borderColor:
                    scanDetail.status === "missing"
                      ? missingBackgroundColor
                      : scanDetail.status === "other"
                      ? warningBackgroundColor
                      : scanDetail.status === "scanned"
                      ? successBackgroundColor
                      : borderColor,
                },
              ]}
            >
              <View style={styles.modalContent}>
                <View
                  style={[
                    styles.modalStatusBadge,
                    {
                      backgroundColor:
                        scanDetail.status === "missing"
                          ? missingBackgroundColor
                          : scanDetail.status === "other"
                          ? warningBackgroundColor
                          : scanDetail.status === "scanned"
                          ? successBackgroundColor
                          : borderColor,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.modalStatusText,
                      {
                        color:
                          scanDetail.status === "missing"
                            ? missingTextColor
                            : scanDetail.status === "other"
                            ? warningTextColor
                            : scanDetail.status === "scanned"
                            ? successTextColor
                            : mutedColor,
                      },
                    ]}
                  >
                    {scanDetail.statusLabel}
                  </ThemedText>
                </View>
                <ThemedText type="title" style={styles.modalCodeText}>
                  {scanDetail.code}
                </ThemedText>
                {scanDetail.description ? (
                  <ThemedText style={styles.modalDescription}>
                    {scanDetail.description}
                  </ThemedText>
                ) : (
                  <ThemedText
                    style={[styles.modalDescription, { color: mutedColor }]}
                  >
                    Description inconnue
                  </ThemedText>
                )}
                <ThemedText style={[styles.modalMeta, { color: mutedColor }]}>
                  Scanne a {formatTimestamp(scanDetail.capturedAt)}
                </ThemedText>
                <View style={styles.etatSection}>
                  <ThemedText type="subtitle">Etat du materiel</ThemedText>
                  <View style={styles.etatOptions}>
                    {ETAT_OPTIONS.map((option) => {
                      const isSelected = selectedEtat === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.etatOption,
                            {
                              borderColor,
                              backgroundColor: isSelected
                                ? highlightColor
                                : "transparent",
                            },
                          ]}
                          onPress={() => handleEtatSelect(option.value)}
                        >
                          <ThemedText
                            style={[
                              styles.etatOptionText,
                              { color: isSelected ? buttonTextColor : mutedColor },
                            ]}
                          >
                            {option.label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {etatErrorDisplay ? (
                    <ThemedText style={styles.etatErrorText}>
                      {etatErrorDisplay}
                    </ThemedText>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: highlightColor,
                    opacity: selectedEtat && !etatLoading ? 1 : 0.6,
                  },
                ]}
                onPress={handleConfirmEtat}
                disabled={!selectedEtat || etatLoading}
              >
                {etatLoading ? (
                  <ActivityIndicator color={buttonTextColor} size="small" />
                ) : (
                  <ThemedText style={styles.modalButtonText}>
                    Scanner suivant
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
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
  recapCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recapLabel: {
    fontSize: 13,
  },
  recapValueColumn: {
    alignItems: "flex-end",
    gap: 2,
  },
  recapMeta: {
    fontSize: 12,
  },
  recapEmpty: {
    fontSize: 13,
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
  cameraPreview: {
    height: "100%",
    width: "100%",
  },
  cameraModalOverlay: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  cameraCloseButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cameraCloseButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cameraHint: {
    fontSize: 13,
  },
  cameraHud: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    gap: 8,
    alignItems: "center",
  },
  cameraHudTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
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
  scanFrameOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: "80%",
    height: "28%",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 12,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: "600",
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  infoContainer: {
    borderRadius: 12,
    borderWidth: 1,
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
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  infoMessage: {
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
  recentDescription: {
    fontSize: 13,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    minHeight: "70%",
    justifyContent: "space-between",
    gap: 16,
  },
  modalContent: {
    alignItems: "center",
    gap: 12,
  },
  modalStatusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalCodeText: {
    textAlign: "center",
  },
  modalDescription: {
    fontSize: 18,
    textAlign: "center",
  },
  modalMeta: {
    fontSize: 14,
    textAlign: "center",
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  etatSection: {
    width: "100%",
    gap: 10,
    paddingTop: 4,
  },
  etatOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  etatOption: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  etatOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  etatErrorText: {
    fontSize: 13,
    textAlign: "center",
    color: "#FCA5A5",
  },
});
