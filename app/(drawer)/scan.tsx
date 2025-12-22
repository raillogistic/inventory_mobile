import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Image,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  type BarcodeScanningResult,
  type BarcodeType,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
} from "@/components/ui/premium-theme";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  type EnregistrementInventaireEtat,
  type OfflineArticleEntry,
} from "@/lib/graphql/inventory-operations";
import { loadInventoryArticleByCode } from "@/lib/offline/inventory-offline-storage";
import {
  createInventoryScan,
  loadInventoryScans,
  updateInventoryScanDetails,
  type InventoryScanRecord,
  type InventoryScanStatus,
} from "@/lib/offline/inventory-scan-storage";
import {
  addScanHistoryItem,
  type ScanHistoryItem,
} from "@/lib/storage/scan-history";

/** Payload used to render recent scan entries. */
type RecentScan = {
  /** Unique identifier for the scan, if available. */
  id: string;
  /** Scanned article code. */
  code: string;
  /** Optional article description returned by the API. */
  description: string | null;
  /** Whether the scanned code matches a known article. */
  hasArticle: boolean;
  /** Optional current location name of the article at load time. */
  previousLocationName: string | null;
  /** Capture timestamp as an ISO string. */
  capturedAt: string;
};

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
  /** Previous location name captured from the offline cache. */
  previousLocationName: string | null;
  /** New location name based on the current selection. */
  nextLocationName: string | null;
  /** Status used to drive list coloring. */
  status: LocationArticleStatus;
  /** Source list for the row. */
  source: "location" | "extra";
};

/** Tab keys for the scan list. */
type ScanListTab = "scanned" | "location";

/** Tab metadata for the scan list UI. */
type ScanListTabConfig = {
  /** Unique tab identifier. */
  id: ScanListTab;
  /** Label displayed for the tab. */
  label: string;
};

/** Payload used to render the scan detail modal. */
type ScanDetail = {
  /** Unique identifier for the scan record. */
  id: string | null;
  /** Scanned article code displayed in the modal. */
  code: string;
  /** Optional description for the scanned article. */
  description: string | null;
  /** Optional captured image URI. */
  imageUri: string | null;
  /** Optional short description for temporary articles. */
  customDesc: string | null;
  /** Source of the scan capture. */
  source: ScanSource | null;
  /** Status used to highlight the scanned article. */
  status: LocationArticleStatus;
  /** Short label for the scan status. */
  statusLabel: string;
  /** Scan timestamp used for the modal subtitle. */
  capturedAt: string;
  /** Whether this scan was already recorded for the location. */
  alreadyScanned: boolean;
  /** Optional observation captured for the scan. */
  observation: string | null;
  /** Optional serial number captured for the scan. */
  serialNumber: string | null;
};

/** Etat option displayed in the scan modal. */
type EtatOption = {
  /** Etat value persisted in the backend. */
  value: EnregistrementInventaireEtat;
  /** Human-readable label shown in the UI. */
  label: string;
};

/** Camera view handle used for capturing scan images. */
type CameraViewHandle = React.ElementRef<typeof CameraView>;

/** Layout info for positioning the scan button border runner. */
type ScanButtonLayout = {
  /** Width of the scan button wrapper. */
  width: number;
  /** Height of the scan button wrapper. */
  height: number;
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
/** Supported 1D barcode formats for the camera scanner. */
const BARCODE_TYPES: BarcodeType[] = [
  "code128",
  "code39",
  "code93",
  "ean13",
  "ean8",
  "itf14",
  "upc_a",
  "upc_e",
  "codabar",
];
/** Etat options available when validating a scan. */
const ETAT_OPTIONS: EtatOption[] = [
  { value: "BIEN", label: "Bien" },
  { value: "MOYENNE", label: "Moyenne" },
  { value: "HORS_SERVICE", label: "Hors service" },
];
/** Tabs available for the scan list view. */
const SCAN_LIST_TABS: ScanListTabConfig[] = [
  { id: "scanned", label: "Articles scannes" },
  { id: "location", label: "Articles du lieu" },
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
 * Build a unique code for manual entries without barcodes.
 */
function buildManualCode(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MANUEL-${timePart}-${randomPart}`;
}

/**
 * Build a lookup table for offline articles keyed by normalized code.
 */
function buildOfflineArticleLookup(
  articles: OfflineArticleEntry[]
): Map<string, OfflineArticleEntry> {
  const map = new Map<string, OfflineArticleEntry>();

  for (const article of articles) {
    const normalized = normalizeScanCode(article.code);
    if (!normalized) {
      continue;
    }
    map.set(normalized, article);
  }

  return map;
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
  const { cache, isHydrated, isSyncing, syncError } = useInventoryOffline();
  const [codeValue, setCodeValue] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [scanSubmitError, setScanSubmitError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [etatMessage, setEtatMessage] = useState<string | null>(null);
  const [scanRecords, setScanRecords] = useState<InventoryScanRecord[]>([]);
  const [scansLoading, setScansLoading] = useState(false);
  const [scansErrorMessage, setScansErrorMessage] = useState<string | null>(
    null
  );
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
  const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
  const [etatLoading, setEtatLoading] = useState(false);
  const [etatErrorMessage, setEtatErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isManualCaptureActive, setIsManualCaptureActive] = useState(false);
  const [isManualFormVisible, setIsManualFormVisible] = useState(false);
  const [manualImageUri, setManualImageUri] = useState<string | null>(null);
  const [manualCustomDesc, setManualCustomDesc] = useState<string>("");
  const [manualObservation, setManualObservation] = useState<string>("");
  const [manualSerialNumber, setManualSerialNumber] = useState<string>("");
  const [manualEtat, setManualEtat] =
    useState<EnregistrementInventaireEtat | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [isScanLocked, setIsScanLocked] = useState(false);
  const [scanFrameLayout, setScanFrameLayout] =
    useState<ScanFrameLayout | null>(null);
  const [selectedEtat, setSelectedEtat] =
    useState<EnregistrementInventaireEtat | null>(null);
  const [observationValue, setObservationValue] = useState<string>("");
  const [serialNumberValue, setSerialNumberValue] = useState<string>("");
  const [customDescriptionValue, setCustomDescriptionValue] =
    useState<string>("");
  const [activeTab, setActiveTab] = useState<ScanListTab>("scanned");
  const [scanButtonLayout, setScanButtonLayout] =
    useState<ScanButtonLayout | null>(null);
  const codeInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraViewHandle | null>(null);
  const manualCameraRef = useRef<CameraViewHandle | null>(null);
  const scanBorderAnim = useRef(new Animated.Value(0)).current;
  const scanLockRef = useRef(false);

  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const locationId = session.location?.id ?? null;
  const shouldReturnToLocations = Boolean(campaignId && groupId);

  /** Handle Android back press by returning to locations. */
  const handleHardwareBack = useCallback(() => {
    if (shouldReturnToLocations) {
      router.replace("/(drawer)/lieux");
      return true;
    }

    return false;
  }, [router, shouldReturnToLocations]);

  /** Ensure Android back button returns to locations for active sessions. */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleHardwareBack
      );
      return () => subscription.remove();
    }, [handleHardwareBack])
  );

  /** Load local scans for the selected campaign/group/location. */
  const loadScans = useCallback(async () => {
    if (!campaignId || !groupId || !locationId) {
      setScanRecords([]);
      return;
    }

    setScansLoading(true);
    setScansErrorMessage(null);
    try {
      const records = await loadInventoryScans({
        campaignId,
        groupId,
        locationId,
        limit: SCAN_STATUS_LIMIT,
      });
      setScanRecords(records);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de charger les scans.";
      setScansErrorMessage(message);
    } finally {
      setScansLoading(false);
    }
  }, [campaignId, groupId, locationId]);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

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
  const manualActionColor = useThemeColor(
    { light: "#F97316", dark: "#FB923C" },
    "tint"
  );
  const mutedColor = useThemeColor(
    { light: "#64748B", dark: "#94A3B8" },
    "icon"
  );
  const textColor = useThemeColor({}, "text");
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
  const isScanBusy = isScanLocked || isSubmittingScan || isScanModalVisible;
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
  const manualStatusMessage = "Ajoutez un article manuellement.";
  const manualGlowColor = "rgba(249,115,22,0.45)";
  const locationArticlesLoading =
    !isHydrated || (isSyncing && cache.articles.length === 0);
  const locationArticlesErrorMessage = syncError;
  const selectedLocationName = session.location?.locationname ?? "Lieu inconnu";
  const articleLookup = useMemo(
    () => buildOfflineArticleLookup(cache.articles),
    [cache.articles]
  );
  const resolvedScans = useMemo<RecentScan[]>(
    () =>
      scanRecords.map((scan) => {
        const normalized = normalizeScanCode(scan.codeArticle);
        const lookup = normalized ? articleLookup.get(normalized) : null;
        const description = scan.articleDescription ?? lookup?.desc ?? null;
        const hasArticle = Boolean(scan.articleId) || Boolean(lookup);
        return {
          id: scan.id,
          code: scan.codeArticle,
          description,
          hasArticle,
          previousLocationName: lookup?.currentLocation?.locationname ?? null,
          capturedAt: scan.capturedAt,
        };
      }),
    [articleLookup, scanRecords]
  );
  const existingCodes = useMemo(() => {
    const set = new Set<string>();
    for (const scan of scanRecords) {
      const normalized = normalizeScanCode(scan.codeArticle);
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [scanRecords]);
  const locationArticles = useMemo(() => {
    if (!locationId) {
      return [];
    }

    const map = new Map<
      string,
      {
        id: string;
        code: string;
        description: string | null;
        previousLocationName: string | null;
      }
    >();

    for (const article of cache.articles) {
      const isAssigned = article.locations.some(
        (location) => location.id === locationId
      );
      if (!isAssigned) {
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
          previousLocationName: article.currentLocation?.locationname ?? null,
        });
      }
    }

    const items = Array.from(map.values());
    items.sort((a, b) => a.code.localeCompare(b.code));
    return items;
  }, [cache.articles, locationId]);
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
          previousLocationName: article.previousLocationName ?? null,
          nextLocationName: selectedLocationName,
          status: isScanned ? "scanned" : "pending",
          source: "location",
        };
      }),
    [existingCodes, locationArticles, selectedLocationName]
  );
  const extraScanItems = useMemo<LocationArticleItem[]>(() => {
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
      const status: LocationArticleStatus = scan.hasArticle
        ? "other"
        : "missing";

      items.push({
        id: scan.id,
        code: scan.code,
        description: scan.description ?? null,
        previousLocationName: scan.previousLocationName ?? null,
        nextLocationName: selectedLocationName,
        status,
        source: "extra",
      });
    }

    return items;
  }, [locationArticleCodeSet, resolvedScans, selectedLocationName]);
  const scannedTabItems = useMemo<LocationArticleItem[]>(() => {
    const scannedLocationItems = locationArticleItems.filter(
      (item) => item.status === "scanned"
    );
    return [...extraScanItems, ...scannedLocationItems];
  }, [extraScanItems, locationArticleItems]);
  const activeListItems =
    activeTab === "scanned" ? scannedTabItems : locationArticleItems;
  const scannedLocationCount = useMemo(() => {
    return locationArticleItems.filter((item) => item.status === "scanned")
      .length;
  }, [locationArticleItems]);
  const scannedTabCountLabel = useMemo(
    () => `${scannedTabItems.length} scanne(s)`,
    [scannedTabItems.length]
  );
  const articleCountLabel = useMemo(() => {
    if (locationArticleItems.length === 0) {
      return extraScanItems.length > 0
        ? `0 article | +${extraScanItems.length} hors lieu`
        : "0 article";
    }

    const extraLabel =
      extraScanItems.length > 0 ? ` | +${extraScanItems.length} hors lieu` : "";

    return `${scannedLocationCount}/${locationArticleItems.length} scannes${extraLabel}`;
  }, [
    extraScanItems.length,
    locationArticleItems.length,
    scannedLocationCount,
  ]);
  const totalScanCount = scanRecords.length;
  const lastScan = resolvedScans[0] ?? null;
  const showArticleLoading =
    (locationArticlesLoading || scansLoading) &&
    activeListItems.length === 0 &&
    !isRefreshing;
  const cameraOverlayLabel = isSubmittingScan ? "Scan en cours..." : null;
  const isMissingDraft = Boolean(
    scanDetail && scanDetail.status === "missing" && !scanDetail.id
  );
  const canSubmitScanDetail = useMemo(() => {
    if (!scanDetail) {
      return false;
    }

    const trimmedObservation = observationValue.trim();
    const trimmedSerialNumber = serialNumberValue.trim();
    const trimmedCustomDescription = customDescriptionValue.trim();
    const hasUpdate =
      Boolean(selectedEtat) ||
      trimmedObservation.length > 0 ||
      trimmedSerialNumber.length > 0 ||
      trimmedCustomDescription.length > 0;

    if (scanDetail.status === "missing" && !scanDetail.id) {
      return (
        Boolean(selectedEtat) &&
        trimmedCustomDescription.length > 0 &&
        Boolean(scanDetail.imageUri) &&
        !etatLoading
      );
    }

    return hasUpdate && !etatLoading;
  }, [
    customDescriptionValue,
    etatLoading,
    observationValue,
    scanDetail,
    selectedEtat,
    serialNumberValue,
  ]);
  const scanBorderColor = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
        outputRange: [
          "#EF4444",
          "#F59E0B",
          "#EAB308",
          "#22C55E",
          "#38BDF8",
          "#A855F7",
        ],
      }),
    [scanBorderAnim]
  );
  const scanGlowColor = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [
          "rgba(239,68,68,0.4)",
          "rgba(34,197,94,0.45)",
          "rgba(168,85,247,0.5)",
        ],
      }),
    [scanBorderAnim]
  );
  const scanBackgroundPulse = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [
          "rgba(15,23,42,0.85)",
          "rgba(30,41,59,0.7)",
          "rgba(15,23,42,0.85)",
        ],
      }),
    [scanBorderAnim]
  );
  const scanBackgroundScale = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.05, 1],
      }),
    [scanBorderAnim]
  );
  const scanLineHeight = 6;

  /** Find the latest scan detail for a code already scanned. */
  const findExistingScan = useCallback(
    (normalizedCode: string) => {
      for (const scan of scanRecords) {
        if (normalizeScanCode(scan.codeArticle) === normalizedCode) {
          const lookup = normalizedCode
            ? articleLookup.get(normalizedCode)
            : null;
          return {
            id: scan.id,
            code: scan.codeArticle,
            description: scan.articleDescription ?? lookup?.desc ?? null,
            customDesc: scan.customDesc ?? null,
            observation: scan.observation ?? null,
            serialNumber: scan.serialNumber ?? null,
            capturedAt: scan.capturedAt,
            hasArticle: Boolean(scan.articleId) || Boolean(lookup),
            status: scan.status,
            statusLabel: scan.statusLabel,
          };
        }
      }

      return null;
    },
    [articleLookup, scanRecords]
  );
  const scanLineTranslateY = useMemo(() => {
    const height = scanButtonLayout?.height ?? 0;
    const maxY = Math.max(0, height - scanLineHeight);
    return scanBorderAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, maxY],
    });
  }, [scanBorderAnim, scanButtonLayout?.height]);

  useEffect(() => {
    if (!hasCameraPermission) {
      setIsCameraActive(false);
      setIsManualCaptureActive(false);
    }
  }, [hasCameraPermission]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanBorderAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(scanBorderAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scanBorderAnim]);

  useEffect(() => {
    if (!hasCameraPermission || !isCameraActive) {
      scanLockRef.current = false;
      setIsScanLocked(false);
      setScanFrameLayout(null);
    }
  }, [hasCameraPermission, isCameraActive]);

  useEffect(() => {
    setScanRecords([]);
    setScanDetail(null);
    setInfoMessage(null);
    setEtatMessage(null);
    setSelectedEtat(null);
    setLocalError(null);
    setScanSubmitError(null);
    setScansErrorMessage(null);
    setEtatErrorMessage(null);
    setCustomDescriptionValue("");
    setIsManualCaptureActive(false);
    setIsManualFormVisible(false);
    setManualImageUri(null);
    setManualObservation("");
    setManualSerialNumber("");
    setManualEtat(null);
    setManualError(null);
    setIsManualSaving(false);
    scanLockRef.current = false;
    setIsScanLocked(false);
  }, [campaignId, groupId, locationId]);

  /** Update the scanned code input value. */
  const handleCodeChange = useCallback((value: string) => {
    setCodeValue(value.trim());
    setLocalError(null);
    setScanSubmitError(null);
    setInfoMessage(null);
    setEtatMessage(null);
    setEtatErrorMessage(null);
    setCustomDescriptionValue("");
  }, []);

  /** Close the scan detail modal and prepare for the next scan. */
  const handleCloseScanModal = useCallback(() => {
    setScanDetail(null);
    setLocalError(null);
    setInfoMessage(null);
    setEtatMessage(null);
    setCodeValue("");
    setSelectedEtat(null);
    setObservationValue("");
    setSerialNumberValue("");
    setCustomDescriptionValue("");
    if (hasCameraPermission) {
      setIsCameraActive(true);
    }
    codeInputRef.current?.focus();
  }, [hasCameraPermission]);

  /** Reset the manual entry draft state. */
  const resetManualDraft = useCallback(() => {
    setManualImageUri(null);
    setManualCustomDesc("");
    setManualObservation("");
    setManualSerialNumber("");
    setManualEtat(null);
    setManualError(null);
  }, []);

  /** Persist the manual capture so it remains available for sync. */
  const persistManualCapture = useCallback(async (uri: string | null) => {
    if (!uri) {
      return null;
    }

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      return uri;
    }

    const match = uri.match(/\.(\w+)(?:\?|$)/);
    const extension = match ? `.${match[1]}` : ".jpg";
    const targetDir = `${baseDir}manual_scans`;
    const targetUri = `${targetDir}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}${extension}`;

    try {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    } catch {
      // Ignore directory creation errors.
    }

    try {
      await FileSystem.copyAsync({ from: uri, to: targetUri });
      return targetUri;
    } catch {
      return uri;
    }
  }, []);

  /** Capture a still image of the scanned barcode. */
  const captureScanImage = useCallback(async (): Promise<string | null> => {
    try {
      const camera = cameraRef.current;
      if (!camera?.takePictureAsync) {
        return null;
      }

      const snapshotPromise = camera.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 1200);
      });
      const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);
      return snapshot && typeof snapshot === "object" && "uri" in snapshot
        ? snapshot.uri ?? null
        : null;
    } catch {
      return null;
    }
  }, []);

  /** Select the scan status before validating the scan. */
  const handleEtatSelect = useCallback(
    (value: EnregistrementInventaireEtat) => {
      setSelectedEtat(value);
      setEtatMessage(null);
      setEtatErrorMessage(null);
    },
    []
  );

  /** Update the observation value. */
  const handleObservationChange = useCallback((value: string) => {
    setObservationValue(value);
    setEtatMessage(null);
    setEtatErrorMessage(null);
  }, []);

  /** Update the manual observation value. */
  const handleManualObservationChange = useCallback((value: string) => {
    setManualObservation(value);
    setManualError(null);
  }, []);

  /** Update the manual custom description value. */
  const handleManualCustomDescChange = useCallback((value: string) => {
    setManualCustomDesc(value);
    setManualError(null);
  }, []);

  /** Update the custom description value. */
  const handleCustomDescriptionChange = useCallback((value: string) => {
    setCustomDescriptionValue(value);
    setEtatMessage(null);
    setEtatErrorMessage(null);
  }, []);

  /** Update the serial number value. */
  const handleSerialNumberChange = useCallback((value: string) => {
    setSerialNumberValue(value);
    setEtatMessage(null);
    setEtatErrorMessage(null);
  }, []);

  /** Update the manual serial number value. */
  const handleManualSerialNumberChange = useCallback((value: string) => {
    setManualSerialNumber(value);
    setManualError(null);
  }, []);

  /** Select the manual etat value. */
  const handleManualEtatSelect = useCallback(
    (value: EnregistrementInventaireEtat) => {
      setManualEtat(value);
      setManualError(null);
    },
    []
  );

  /** Sync observation and serial number with the current scan detail. */
  useEffect(() => {
    if (!scanDetail) {
      return;
    }
    setObservationValue(scanDetail.observation ?? "");
    setSerialNumberValue(scanDetail.serialNumber ?? "");
    setCustomDescriptionValue(scanDetail.customDesc ?? "");
  }, [scanDetail]);

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

  /** Open the manual capture flow. */
  const handleOpenManualCapture = useCallback(async () => {
    if (isManualSaving) {
      return;
    }

    if (!hasCameraPermission && canAskCameraPermission) {
      const response = await requestCameraPermission();
      if (!response.granted) {
        return;
      }
    }

    resetManualDraft();
    setIsCameraActive(false);
    setIsManualFormVisible(false);
    setIsManualCaptureActive(true);
  }, [
    canAskCameraPermission,
    hasCameraPermission,
    isManualSaving,
    requestCameraPermission,
    resetManualDraft,
  ]);

  /** Capture a photo for the manual entry. */
  const handleManualCapture = useCallback(async () => {
    try {
      const camera = manualCameraRef.current;
      if (!camera?.takePictureAsync) {
        setManualError("Camera indisponible.");
        return;
      }

      const snapshot = await camera.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (snapshot && typeof snapshot === "object" && "uri" in snapshot) {
        const persistedUri = await persistManualCapture(snapshot.uri ?? null);
        setManualImageUri(persistedUri);
        setManualError(null);
        return;
      }
      setManualError("Impossible de capturer l'image.");
    } catch {
      setManualError("Impossible de capturer l'image.");
    }
  }, [persistManualCapture]);

  /** Continue from the manual capture to the form. */
  const handleManualContinue = useCallback(() => {
    if (!manualImageUri) {
      setManualError("Veuillez prendre une photo avant de continuer.");
      return;
    }
    setManualError(null);
    setIsManualCaptureActive(false);
    setIsManualFormVisible(true);
  }, [manualImageUri]);

  /** Close the manual capture modal and reset the draft. */
  const handleManualCaptureClose = useCallback(() => {
    setIsManualCaptureActive(false);
    resetManualDraft();
  }, [resetManualDraft]);

  /** Close the manual form without saving. */
  const handleManualCancel = useCallback(() => {
    setIsManualFormVisible(false);
    resetManualDraft();
  }, [resetManualDraft]);

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
      setScanSubmitError(null);
      setInfoMessage(null);
      setEtatMessage(null);
      setEtatErrorMessage(null);
      setScansErrorMessage(null);
      await loadScans();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadScans]);

  /** Persist a manual entry locally for later sync. */
  const handleManualSubmit = useCallback(async () => {
    if (!campaignId || !groupId || !locationId) {
      setManualError("Selection incomplete. Retournez aux selections.");
      return;
    }

    const trimmedCustomDesc = manualCustomDesc.trim();
    const trimmedObservation = manualObservation.trim();
    const trimmedSerial = manualSerialNumber.trim();

    if (!manualImageUri) {
      setManualError("Une photo est requise.");
      return;
    }
    if (!manualEtat) {
      setManualError("Choisissez un etat.");
      return;
    }

    setIsManualSaving(true);
    setManualError(null);
    try {
      const record = await createInventoryScan({
        campaignId,
        groupId,
        locationId,
        locationName: session.location?.locationname ?? "Lieu inconnu",
        codeArticle: buildManualCode(),
        articleId: null,
        articleDescription: null,
        customDesc: trimmedCustomDesc || null,
        observation: trimmedObservation || null,
        serialNumber: trimmedSerial || null,
        etat: manualEtat,
        capturedAt: new Date().toISOString(),
        sourceScan: "manual",
        imageUri: manualImageUri,
        status: "missing",
        statusLabel: "Article manuel",
      });

      setScanRecords((current) => {
        const next = [record, ...current];
        return next.slice(0, SCAN_STATUS_LIMIT);
      });

      const historyItem: ScanHistoryItem = {
        id: `${record.id}-${record.capturedAt}`,
        code: record.codeArticle,
        description: record.articleDescription,
        imageUri: record.imageUri,
        status: record.status,
        statusLabel: record.statusLabel,
        capturedAt: record.capturedAt,
        locationId: session.location?.id ?? null,
        locationName: session.location?.locationname ?? "Lieu inconnu",
        etat: record.etat ?? null,
        observation: record.observation ?? null,
        serialNumber: record.serialNumber ?? null,
      };
      await addScanHistoryItem(historyItem);
      setIsManualFormVisible(false);
      resetManualDraft();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "L'enregistrement manuel a echoue.";
      setManualError(message);
    } finally {
      setIsManualSaving(false);
    }
  }, [
    campaignId,
    createInventoryScan,
    addScanHistoryItem,
    groupId,
    locationId,
    manualEtat,
    manualImageUri,
    manualCustomDesc,
    manualObservation,
    manualSerialNumber,
    resetManualDraft,
    session.location?.id,
    session.location?.locationname,
  ]);

  /** Create the scan record locally in SQLite. */
  const submitScan = useCallback(
    async (
      rawCode: string,
      source: ScanSource,
      imageUri: string | null = null
    ) => {
      if (isSubmittingScan || isScanModalVisible) {
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

      let lookup = normalizedCode ? articleLookup.get(normalizedCode) : null;
      if (!lookup) {
        try {
          lookup = await loadInventoryArticleByCode(cleanedCode);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Impossible de charger l'article.";
          setScanSubmitError(message);
          return;
        }
      }
      const isInLocation = normalizedCode
        ? locationArticleCodeSet.has(normalizedCode)
        : false;
      const existingScan = existingCodes.has(normalizedCode)
        ? findExistingScan(normalizedCode)
        : null;
      const hasKnownArticle =
        Boolean(existingScan?.hasArticle) || Boolean(lookup);
      const status: InventoryScanStatus = isInLocation
        ? "scanned"
        : hasKnownArticle
        ? "other"
        : "missing";
      const statusLabel = getStatusLabel(status);
      const detailDescription =
        existingScan?.description ?? lookup?.desc ?? null;

      if (existingScan) {
        setLocalError(null);
        setScanSubmitError(null);
        setInfoMessage("Code deja scanne pour ce lieu.");
        setScanDetail({
          id: existingScan.id,
          code: existingScan.code,
          description: detailDescription,
          imageUri,
          customDesc: existingScan.customDesc ?? null,
          source: null,
          status,
          statusLabel,
          capturedAt: existingScan.capturedAt,
          alreadyScanned: true,
          observation: existingScan.observation ?? null,
          serialNumber: existingScan.serialNumber ?? null,
        });
        setIsCameraActive(false);
        setSelectedEtat(null);
        setEtatMessage(null);
        setCodeValue("");
        await triggerSuccessHaptic();
        return;
      }

      setLocalError(null);
      setScanSubmitError(null);
      setInfoMessage(null);

      const locationName = session.location?.locationname ?? "Lieu inconnu";
      if (status === "missing") {
        setScanDetail({
          id: null,
          code: cleanedCode,
          description: detailDescription,
          imageUri,
          customDesc: null,
          source,
          status,
          statusLabel,
          capturedAt: new Date().toISOString(),
          alreadyScanned: false,
          observation: null,
          serialNumber: null,
        });
        setIsCameraActive(false);
        setSelectedEtat(null);
        setEtatMessage(null);
        setCodeValue("");
        await triggerSuccessHaptic();
        return;
      }
      setIsSubmittingScan(true);
      try {
        const record = await createInventoryScan({
          campaignId,
          groupId,
          locationId,
          locationName,
          codeArticle: cleanedCode,
          articleId: lookup?.id ?? null,
          articleDescription: lookup?.desc ?? null,
          capturedAt: new Date().toISOString(),
          sourceScan: source,
          imageUri,
          status,
          statusLabel,
        });

        setScanRecords((current) => {
          const next = [record, ...current];
          return next.slice(0, SCAN_STATUS_LIMIT);
        });
        setScanDetail({
          id: record.id,
          code: record.codeArticle,
          description: record.articleDescription ?? detailDescription,
          imageUri: record.imageUri,
          customDesc: record.customDesc ?? null,
          source: source,
          status,
          statusLabel,
          capturedAt: record.capturedAt,
          alreadyScanned: false,
          observation: null,
          serialNumber: null,
        });
        setIsCameraActive(false);
        setSelectedEtat(null);
        setEtatMessage(null);
        setCodeValue("");
        await triggerSuccessHaptic();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Le scan n'a pas pu etre enregistre.";
        setScanSubmitError(message);
      } finally {
        setIsSubmittingScan(false);
      }
    },
    [
      articleLookup,
      campaignId,
      existingCodes,
      findExistingScan,
      groupId,
      isScanModalVisible,
      isSubmittingScan,
      locationArticleCodeSet,
      locationId,
      session.location?.locationname,
      triggerSuccessHaptic,
    ]
  );

  /** Handle barcode events from the camera view. */
  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (
        scanLockRef.current ||
        isSubmittingScan ||
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
        const imageUri = await captureScanImage();
        await submitScan(scannedCode, "camera", imageUri);
        scanLockRef.current = false;
        setIsScanLocked(false);
      })();
    },
    [
      captureScanImage,
      hasCameraPermission,
      isCameraActive,
      isScanModalVisible,
      isSubmittingScan,
      scanFrameLayout,
      submitScan,
    ]
  );

  /** Create the scan record from the typed code input. */
  const handleCodeSubmit = useCallback(async () => {
    await submitScan(codeValue, "manual");
  }, [codeValue, submitScan]);

  /** Derived error message to display in the UI. */
  const errorDisplay = useMemo(() => {
    if (localError) {
      return localError;
    }

    if (scanSubmitError) {
      return scanSubmitError;
    }

    return null;
  }, [localError, scanSubmitError]);
  const etatErrorDisplay = useMemo(() => {
    if (etatMessage) {
      return etatMessage;
    }

    if (etatErrorMessage) {
      return etatErrorMessage;
    }

    return null;
  }, [etatErrorMessage, etatMessage]);
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

    return errors.length > 0 ? errors.join(" | ") : null;
  }, [locationArticlesErrorMessage, scansErrorMessage]);

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

      // Premium status-based colors
      const cardBorderColor = isMissing
        ? PREMIUM_COLORS.error
        : isOtherLocation
        ? PREMIUM_COLORS.warning
        : isScanned
        ? PREMIUM_COLORS.success
        : PREMIUM_COLORS.glass_border;
      const cardBackgroundColor = isMissing
        ? "rgba(239, 68, 68, 0.15)"
        : isOtherLocation
        ? "rgba(245, 158, 11, 0.15)"
        : isScanned
        ? "rgba(16, 185, 129, 0.15)"
        : PREMIUM_COLORS.glass_bg;
      const primaryTextColor = isMissing
        ? "#FCA5A5"
        : isOtherLocation
        ? "#FCD34D"
        : isScanned
        ? "#6EE7B7"
        : PREMIUM_COLORS.text_primary;
      const secondaryTextColor = isMissing
        ? "#FCA5A5"
        : isOtherLocation
        ? "#FCD34D"
        : isScanned
        ? "#6EE7B7"
        : PREMIUM_COLORS.text_muted;

      return (
        <View
          style={[
            styles.recentCard,
            {
              borderColor: cardBorderColor,
              backgroundColor: cardBackgroundColor,
            },
          ]}
        >
          <ThemedText
            type="defaultSemiBold"
            style={{ color: primaryTextColor }}
          >
            {item.code}
          </ThemedText>
          {item.description ? (
            <ThemedText
              style={[styles.recentDescription, { color: secondaryTextColor }]}
            >
              {item.description}
            </ThemedText>
          ) : null}
          {activeTab === "scanned" ? (
            <>
              <ThemedText
                style={[styles.recentMeta, { color: secondaryTextColor }]}
              >
                Ancien lieu: {item.previousLocationName ?? "Inconnu"}
              </ThemedText>
              <ThemedText
                style={[styles.recentMeta, { color: secondaryTextColor }]}
              >
                Nouveau lieu: {item.nextLocationName ?? "Lieu inconnu"}
              </ThemedText>
            </>
          ) : null}
        </View>
      );
    },
    [activeTab]
  );

  /** Change the active list tab. */
  const handleTabChange = useCallback((tab: ScanListTab) => {
    setActiveTab(tab);
  }, []);

  /** Persist the selected state and move to the next scan. */
  const handleConfirmEtat = useCallback(async () => {
    if (!scanDetail) {
      setEtatMessage("Impossible d'identifier l'enregistrement.");
      return;
    }

    const trimmedObservation = observationValue.trim();
    const trimmedSerialNumber = serialNumberValue.trim();
    const trimmedCustomDescription = customDescriptionValue.trim();
    const hasObservation = trimmedObservation.length > 0;
    const hasSerialNumber = trimmedSerialNumber.length > 0;
    const hasCustomDescription = trimmedCustomDescription.length > 0;
    const isMissing = scanDetail.status === "missing";
    const isDraft = !scanDetail.id;
    const shouldUpdate =
      Boolean(selectedEtat) ||
      hasObservation ||
      hasSerialNumber ||
      hasCustomDescription;

    if (isMissing) {
      if (!selectedEtat) {
        setEtatMessage("Choisissez un etat.");
        return;
      }
      if (isDraft && !hasCustomDescription) {
        setEtatMessage("Le libelle court est requis.");
        return;
      }
      if (isDraft && !scanDetail.imageUri) {
        setEtatMessage("Une image est requise pour l'article inconnu.");
        return;
      }
    } else if (!selectedEtat && !shouldUpdate) {
      setEtatMessage("Choisissez un etat ou ajoutez une observation.");
      return;
    }

    setEtatMessage(null);

    let savedRecord: InventoryScanRecord | null = null;
    const locationName = session.location?.locationname ?? "Lieu inconnu";

    if (isDraft) {
      if (!campaignId || !groupId || !locationId) {
        setEtatMessage("Selection incomplete. Retournez aux selections.");
        return;
      }

      setEtatLoading(true);
      setEtatErrorMessage(null);
      try {
        savedRecord = await createInventoryScan({
          campaignId,
          groupId,
          locationId,
          locationName,
          codeArticle: scanDetail.code,
          articleId: null,
          articleDescription: scanDetail.description ?? null,
          customDesc: hasCustomDescription ? trimmedCustomDescription : null,
          observation: hasObservation ? trimmedObservation : null,
          serialNumber: hasSerialNumber ? trimmedSerialNumber : null,
          etat: selectedEtat ?? null,
          capturedAt: scanDetail.capturedAt,
          sourceScan: scanDetail.source ?? "manual",
          imageUri: scanDetail.imageUri,
          status: scanDetail.status,
          statusLabel: scanDetail.statusLabel,
        });

        setScanRecords((current) => {
          const next = [savedRecord, ...current];
          return next.slice(0, SCAN_STATUS_LIMIT);
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Les informations n'ont pas pu etre enregistrees.";
        setEtatErrorMessage(message);
        return;
      } finally {
        setEtatLoading(false);
      }
    } else if (shouldUpdate && scanDetail.id) {
      setEtatLoading(true);
      setEtatErrorMessage(null);
      try {
        await updateInventoryScanDetails({
          id: scanDetail.id,
          etat: selectedEtat ?? null,
          observation: hasObservation ? trimmedObservation : null,
          customDesc: hasCustomDescription
            ? trimmedCustomDescription
            : scanDetail.customDesc ?? null,
          serialNumber: hasSerialNumber ? trimmedSerialNumber : null,
        });

        setScanRecords((current) =>
          current.map((record) =>
            record.id === scanDetail.id
              ? {
                  ...record,
                  etat: selectedEtat ?? record.etat ?? null,
                  observation: hasObservation
                    ? trimmedObservation
                    : record.observation ?? null,
                  customDesc: hasCustomDescription
                    ? trimmedCustomDescription
                    : record.customDesc ?? null,
                  serialNumber: hasSerialNumber
                    ? trimmedSerialNumber
                    : record.serialNumber ?? null,
                }
              : record
          )
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Les informations n'ont pas pu etre enregistrees.";
        setEtatErrorMessage(message);
        return;
      } finally {
        setEtatLoading(false);
      }
    }

    const recordId = savedRecord?.id ?? scanDetail.id;
    if (!recordId) {
      setEtatErrorMessage("Impossible d'enregistrer l'article.");
      return;
    }

    const historyItem: ScanHistoryItem = {
      id: `${recordId}-${scanDetail.capturedAt}`,
      code: scanDetail.code,
      description: scanDetail.description,
      imageUri: scanDetail.imageUri,
      status: scanDetail.status,
      statusLabel: scanDetail.statusLabel,
      capturedAt: scanDetail.capturedAt,
      locationId: session.location?.id ?? null,
      locationName: locationName,
      etat: selectedEtat ?? null,
      observation: hasObservation ? trimmedObservation : null,
      serialNumber: hasSerialNumber ? trimmedSerialNumber : null,
    };
    await addScanHistoryItem(historyItem);
    handleCloseScanModal();
  }, [
    campaignId,
    customDescriptionValue,
    groupId,
    handleCloseScanModal,
    locationId,
    scanDetail?.capturedAt,
    scanDetail?.code,
    scanDetail?.customDesc,
    scanDetail?.description,
    scanDetail?.id,
    scanDetail?.imageUri,
    scanDetail?.source,
    scanDetail?.status,
    scanDetail?.statusLabel,
    observationValue,
    serialNumberValue,
    selectedEtat,
    session.location?.id,
    session.location?.locationname,
    createInventoryScan,
    updateInventoryScanDetails,
  ]);
  if (!campaignId || !groupId || !locationId) {
    return (
      <PremiumScreenWrapper>
        <View style={styles.missingContainer}>
          <ThemedText type="title">Selection incomplete</ThemedText>
          <ThemedText
            style={[styles.missingText, { color: PREMIUM_COLORS.text_muted }]}
          >
            Choisissez une campagne, un groupe et un lieu avant de scanner.
          </ThemedText>
          <TouchableOpacity
            style={[
              styles.retryButton,
              { backgroundColor: PREMIUM_COLORS.accent_primary },
            ]}
            onPress={() => router.push("/(drawer)/lieux")}
          >
            <ThemedText style={styles.retryButtonText}>
              Reprendre la selection
            </ThemedText>
          </TouchableOpacity>
        </View>
      </PremiumScreenWrapper>
    );
  }

  return (
    <PremiumScreenWrapper>
      <FlatList
        data={activeListItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View>
              <Animated.View
                style={[
                  styles.scanModeButton,
                  {
                    borderColor: scanBorderColor,
                    shadowColor: scanGlowColor,
                  },
                ]}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scanModeGlow,
                    { backgroundColor: scanGlowColor },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.scanModeRadial,
                    { backgroundColor: scanGlowColor },
                  ]}
                />
                <TouchableOpacity
                  style={[
                    styles.scanModeButtonInner,
                    { backgroundColor: "transparent" },
                  ]}
                  onLayout={({ nativeEvent }) =>
                    setScanButtonLayout({
                      width: nativeEvent.layout.width,
                      height: nativeEvent.layout.height,
                    })
                  }
                  onPress={
                    hasCameraPermission
                      ? handleToggleCamera
                      : handleRequestCamera
                  }
                  disabled={isCameraButtonDisabled}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.scanModeBackground,
                      {
                        backgroundColor: scanBackgroundPulse,
                        transform: [{ scale: scanBackgroundScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.scanModeScanLine,
                      {
                        backgroundColor: scanBorderColor,
                        transform: [{ translateY: scanLineTranslateY }],
                      },
                    ]}
                  />
                  <View style={styles.scanModeButtonContent}>
                    <ThemedText style={styles.scanModeButtonTitle}>
                      Scan mode
                    </ThemedText>
                    <ThemedText style={styles.scanModeButtonSubtitle}>
                      Lancer la camera
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              </Animated.View>
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
                  style={[
                    styles.scanButton,
                    { backgroundColor: highlightColor },
                  ]}
                  onPress={handleCodeSubmit}
                  disabled={isSubmittingScan || isScanModalVisible}
                  accessibilityRole="button"
                  accessibilityLabel="Enregistrer le code article"
                >
                  {isSubmittingScan ? (
                    <ActivityIndicator color={buttonTextColor} size="small" />
                  ) : (
                    <ThemedText
                      style={[
                        styles.scanButtonText,
                        { color: buttonTextColor },
                      ]}
                    >
                      &gt;
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.manualContainer}>
                <View
                  style={[
                    styles.scanModeButton,
                    {
                      borderColor: manualActionColor,
                      shadowColor: manualGlowColor,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.scanModeButtonInner,
                      { backgroundColor: "transparent" },
                    ]}
                    onPress={handleOpenManualCapture}
                    disabled={!hasCameraPermission && !canAskCameraPermission}
                  >
                    <View style={styles.scanModeButtonContent}>
                      <ThemedText
                        style={[
                          styles.scanModeButtonTitle,
                          { color: manualActionColor },
                        ]}
                      >
                        Nouvel article manuel
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.scanModeButtonSubtitle,
                          { color: manualActionColor },
                        ]}
                      >
                        {manualStatusMessage}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
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
                    ref={cameraRef}
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
                    <ThemedText
                      style={[styles.cameraHint, { color: mutedColor }]}
                    >
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
              <Modal
                transparent
                visible={isManualCaptureActive}
                animationType="fade"
                onRequestClose={handleManualCaptureClose}
              >
                <View style={styles.cameraModalOverlay}>
                  <CameraView
                    style={styles.cameraPreview}
                    ref={manualCameraRef}
                  />
                  <View style={styles.cameraHud}>
                    <ThemedText style={styles.cameraHudTitle}>
                      Photo article
                    </ThemedText>
                    <ThemedText style={styles.cameraHint}>
                      Cadrez l&apos;article puis prenez la photo.
                    </ThemedText>
                    {manualError ? (
                      <ThemedText style={styles.manualErrorText}>
                        {manualError}
                      </ThemedText>
                    ) : null}
                    <View style={styles.manualCaptureActions}>
                      <TouchableOpacity
                        style={[
                          styles.manualCaptureButton,
                          { backgroundColor: manualActionColor },
                        ]}
                        onPress={handleManualCapture}
                      >
                        <ThemedText
                          style={[
                            styles.cameraCloseButtonText,
                            { color: "#FFFFFF" },
                          ]}
                        >
                          Prendre photo
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.manualContinueButton,
                          {
                            backgroundColor: highlightColor,
                            opacity: manualImageUri ? 1 : 0.6,
                          },
                        ]}
                        onPress={handleManualContinue}
                        disabled={!manualImageUri}
                      >
                        <ThemedText
                          style={[
                            styles.cameraCloseButtonText,
                            { color: "#FFFFFF" },
                          ]}
                        >
                          Continuer
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.cameraCloseButton,
                        { backgroundColor: highlightColor },
                      ]}
                      onPress={handleManualCaptureClose}
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
                </View>
              </Modal>
            </View>

            <View style={styles.contextCard}>
              <ThemedText
                type="defaultSemiBold"
                style={{ color: PREMIUM_COLORS.text_primary }}
              >
                Campagne: {session.campaign?.nom}
              </ThemedText>
              <ThemedText style={styles.contextMeta}>
                Groupe: {session.group?.nom}
              </ThemedText>
              <ThemedText style={styles.contextMeta}>
                Lieu: {session.location?.locationname}
              </ThemedText>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handleChangeLocation}
              >
                <ThemedText style={styles.changeButtonText}>
                  Changer le lieu
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.recapCard}>
              <View style={styles.recapRow}>
                <ThemedText style={styles.recapLabel}>
                  Scans enregistres
                </ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={{ color: PREMIUM_COLORS.text_primary }}
                >
                  {totalScanCount}
                </ThemedText>
              </View>
              {lastScan ? (
                <View style={styles.recapRow}>
                  <ThemedText style={styles.recapLabel}>
                    Dernier scan
                  </ThemedText>
                  <View style={styles.recapValueColumn}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={{ color: PREMIUM_COLORS.text_primary }}
                    >
                      {lastScan.code}
                    </ThemedText>
                    <ThemedText style={styles.recapMeta}>
                      {formatTimestamp(lastScan.capturedAt)}
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <ThemedText style={styles.recapEmpty}>
                  Aucun scan enregistre pour l&apos;instant.
                </ThemedText>
              )}
            </View>

            {errorDisplay ? (
              <View style={styles.errorContainer}>
                <ThemedText style={styles.errorTitle}>
                  Erreur lors du scan
                </ThemedText>
                <ThemedText style={styles.errorMessage}>
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
                <ThemedText style={styles.errorMessage}>
                  {listErrorDisplay}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <ThemedText
                type="subtitle"
                style={{ color: PREMIUM_COLORS.text_primary }}
              >
                {activeTab === "scanned"
                  ? "Articles scannes"
                  : "Articles du lieu"}
              </ThemedText>
              <ThemedText style={styles.sectionMeta}>
                {activeTab === "scanned"
                  ? scannedTabCountLabel
                  : articleCountLabel}
              </ThemedText>
            </View>
            <View style={styles.tabRow}>
              {SCAN_LIST_TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.tabButton,
                      isActive && {
                        backgroundColor: PREMIUM_COLORS.accent_primary,
                      },
                    ]}
                    onPress={() => handleTabChange(tab.id)}
                  >
                    <ThemedText
                      style={[
                        styles.tabButtonText,
                        {
                          color: isActive
                            ? PREMIUM_COLORS.text_primary
                            : PREMIUM_COLORS.text_muted,
                        },
                      ]}
                    >
                      {tab.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          showArticleLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator
                size="large"
                color={PREMIUM_COLORS.accent_primary}
              />
              <ThemedText style={styles.emptyMessage}>
                Chargement des articles...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              {activeTab === "scanned" ? (
                <>
                  <ThemedText
                    type="subtitle"
                    style={{ color: PREMIUM_COLORS.text_secondary }}
                  >
                    Aucun scan enregistre
                  </ThemedText>
                  <ThemedText style={styles.emptyMessage}>
                    Commencez a scanner pour remplir cette liste.
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText
                    type="subtitle"
                    style={{ color: PREMIUM_COLORS.text_secondary }}
                  >
                    Aucun article pour ce lieu
                  </ThemedText>
                  <ThemedText style={styles.emptyMessage}>
                    Verifiez les affectations ou contactez
                    l&apos;administrateur.
                  </ThemedText>
                </>
              )}
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
        onRequestClose={handleCloseScanModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseScanModal}>
          {scanDetail ? (
            <Pressable
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
              onPress={() => {}}
            >
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseScanModal}
                accessibilityRole="button"
                accessibilityLabel="Fermer la fiche article"
              >
                <IconSymbol name="xmark" size={16} color={mutedColor} />
              </TouchableOpacity>
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
                {scanDetail.alreadyScanned ? (
                  <ThemedText
                    style={[styles.alreadyScannedText, { color: mutedColor }]}
                  >
                    Deja scanne. Vous pouvez modifier l'etat ci-dessous.
                  </ThemedText>
                ) : null}
                {scanDetail.status === "missing" ? (
                  <View style={styles.modalField}>
                    <ThemedText
                      style={[styles.modalFieldLabel, { color: mutedColor }]}
                    >
                      Libelle court
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.modalInput,
                        {
                          borderColor,
                          color: inputTextColor,
                          backgroundColor: surfaceColor,
                        },
                      ]}
                      placeholder="Saisir un libelle court"
                      placeholderTextColor={placeholderColor}
                      value={customDescriptionValue}
                      onChangeText={handleCustomDescriptionChange}
                    />
                  </View>
                ) : null}
                <View style={styles.modalField}>
                  <ThemedText
                    style={[styles.modalFieldLabel, { color: mutedColor }]}
                  >
                    Observation
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        borderColor,
                        color: inputTextColor,
                        backgroundColor: surfaceColor,
                      },
                    ]}
                    placeholder="Ajouter une observation"
                    placeholderTextColor={placeholderColor}
                    value={observationValue}
                    onChangeText={handleObservationChange}
                    multiline
                  />
                </View>
                <View style={styles.modalField}>
                  <ThemedText
                    style={[styles.modalFieldLabel, { color: mutedColor }]}
                  >
                    Numero de serie (optionnel)
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        borderColor,
                        color: inputTextColor,
                        backgroundColor: surfaceColor,
                      },
                    ]}
                    placeholder="Saisir un numero de serie"
                    placeholderTextColor={placeholderColor}
                    value={serialNumberValue}
                    onChangeText={handleSerialNumberChange}
                    autoCapitalize="characters"
                  />
                </View>
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
                                ? "rgba(34,197,94,0.18)"
                                : "transparent",
                            },
                          ]}
                          onPress={() => handleEtatSelect(option.value)}
                        >
                          <View style={styles.etatOptionContent}>
                            <ThemedText
                              style={[
                                styles.etatOptionText,
                                {
                                  color: isSelected ? textColor : mutedColor,
                                },
                              ]}
                            >
                              {option.label}
                            </ThemedText>
                            <IconSymbol
                              name="checkmark.circle.fill"
                              size={22}
                              color={isSelected ? "#22C55E" : "#94A3B8"}
                            />
                          </View>
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

              {isMissingDraft ? (
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalButtonSecondary,
                      { borderColor: highlightColor },
                    ]}
                    onPress={handleCloseScanModal}
                    disabled={etatLoading}
                  >
                    <ThemedText
                      style={[
                        styles.modalButtonSecondaryText,
                        { color: textColor },
                      ]}
                    >
                      Ne pas enregistrer
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      {
                        backgroundColor: highlightColor,
                        opacity: canSubmitScanDetail ? 1 : 0.6,
                      },
                    ]}
                    onPress={handleConfirmEtat}
                    disabled={!canSubmitScanDetail}
                  >
                    {etatLoading ? (
                      <ActivityIndicator color={buttonTextColor} size="small" />
                    ) : (
                      <ThemedText style={styles.modalButtonText}>
                        Creer article temporaire
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: highlightColor,
                      opacity: canSubmitScanDetail ? 1 : 0.6,
                    },
                  ]}
                  onPress={handleConfirmEtat}
                  disabled={!canSubmitScanDetail}
                >
                  {etatLoading ? (
                    <ActivityIndicator color={buttonTextColor} size="small" />
                  ) : (
                    <ThemedText style={styles.modalButtonText}>
                      Scanner suivant
                    </ThemedText>
                  )}
                </TouchableOpacity>
              )}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={isManualFormVisible}
        animationType="fade"
        onRequestClose={handleManualCancel}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: modalOverlayColor }]}
          onPress={handleManualCancel}
        >
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: modalCardColor,
                borderColor: manualActionColor,
              },
            ]}
            onPress={() => {}}
          >
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleManualCancel}
              accessibilityRole="button"
              accessibilityLabel="Fermer le formulaire manuel"
            >
              <IconSymbol name="xmark" size={16} color={mutedColor} />
            </TouchableOpacity>
            <ScrollView
              style={styles.manualFormScroll}
              contentContainerStyle={styles.manualFormContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText type="title" style={styles.modalCodeText}>
                Enregistrement manuel
              </ThemedText>
              {manualImageUri ? (
                <Image
                  source={{ uri: manualImageUri }}
                  style={styles.manualPreview}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.modalField}>
                <ThemedText
                  style={[styles.modalFieldLabel, { color: mutedColor }]}
                >
                  Libelle court
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      borderColor,
                      color: inputTextColor,
                      backgroundColor: surfaceColor,
                    },
                  ]}
                  placeholder="Ajouter un libelle court"
                  placeholderTextColor={placeholderColor}
                  value={manualCustomDesc}
                  onChangeText={handleManualCustomDescChange}
                />
              </View>
              <View style={styles.modalField}>
                <ThemedText
                  style={[styles.modalFieldLabel, { color: mutedColor }]}
                >
                  Observation
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      borderColor,
                      color: inputTextColor,
                      backgroundColor: surfaceColor,
                    },
                  ]}
                  placeholder="Ajouter une observation (optionnel)"
                  placeholderTextColor={placeholderColor}
                  value={manualObservation}
                  onChangeText={handleManualObservationChange}
                  multiline
                />
              </View>
              <View style={styles.modalField}>
                <ThemedText
                  style={[styles.modalFieldLabel, { color: mutedColor }]}
                >
                  Numero de serie
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      borderColor,
                      color: inputTextColor,
                      backgroundColor: surfaceColor,
                    },
                  ]}
                  placeholder="Saisir un numero de serie (optionnel)"
                  placeholderTextColor={placeholderColor}
                  value={manualSerialNumber}
                  onChangeText={handleManualSerialNumberChange}
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.etatSection}>
                <ThemedText type="subtitle">Etat du materiel</ThemedText>
                <View style={styles.etatOptions}>
                  {ETAT_OPTIONS.map((option) => {
                    const isSelected = manualEtat === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.etatOption,
                          {
                            borderColor,
                            backgroundColor: isSelected
                              ? "rgba(34,197,94,0.18)"
                              : "transparent",
                          },
                        ]}
                        onPress={() => handleManualEtatSelect(option.value)}
                      >
                        <View style={styles.etatOptionContent}>
                          <ThemedText
                            style={[
                              styles.etatOptionText,
                              {
                                color: isSelected ? textColor : mutedColor,
                              },
                            ]}
                          >
                            {option.label}
                          </ThemedText>
                          <IconSymbol
                            name="checkmark.circle.fill"
                            size={22}
                            color={isSelected ? "#22C55E" : "#94A3B8"}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {manualError ? (
                <ThemedText style={styles.etatErrorText}>
                  {manualError}
                </ThemedText>
              ) : null}
            </ScrollView>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[
                  styles.modalButtonSecondary,
                  { borderColor: highlightColor },
                ]}
                onPress={handleManualCancel}
                disabled={isManualSaving}
              >
                <ThemedText
                  style={[
                    styles.modalButtonSecondaryText,
                    { color: textColor },
                  ]}
                >
                  Annuler
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: highlightColor,
                    opacity: isManualSaving ? 0.6 : 1,
                  },
                ]}
                onPress={handleManualSubmit}
                disabled={isManualSaving}
              >
                {isManualSaving ? (
                  <ActivityIndicator color={buttonTextColor} size="small" />
                ) : (
                  <ThemedText style={styles.modalButtonText}>
                    Enregistrer
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </PremiumScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    gap: 6,
  },
  subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },
  contextCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  cameraCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  recapCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  recapLabel: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  recapValueColumn: {
    alignItems: "flex-end",
    gap: 2,
  },
  recapMeta: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  recapEmpty: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    fontStyle: "italic",
  },
  cameraMeta: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  scanModeButton: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 3,
    borderColor: PREMIUM_COLORS.accent_primary,
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    overflow: "hidden",
  },
  scanModeGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    opacity: 0.3,
    borderRadius: 24,
    backgroundColor: PREMIUM_COLORS.accent_primary,
  },
  scanModeRadial: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    left: "50%",
    marginLeft: -110,
    opacity: 0.15,
    backgroundColor: PREMIUM_COLORS.accent_primary,
  },
  scanModeButtonInner: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scanModeBackground: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 14,
    opacity: 0.45,
  },
  scanModeScanLine: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 6,
    borderRadius: 999,
    opacity: 0.8,
  },
  scanModeButtonContent: {
    alignItems: "center",
    gap: 4,
  },
  scanModeButtonTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: PREMIUM_COLORS.text_primary,
  },
  scanModeButtonSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: PREMIUM_COLORS.text_muted,
  },
  manualContainer: {
    marginTop: 12,
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
    color: PREMIUM_COLORS.text_primary,
  },
  manualCaptureActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 12,
  },
  manualCaptureButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualContinueButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualErrorText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    color: PREMIUM_COLORS.error,
  },
  cameraHint: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
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
    color: PREMIUM_COLORS.text_muted,
  },
  changeButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.accent_primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.accent_primary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: PREMIUM_COLORS.text_primary,
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: PREMIUM_COLORS.accent_primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  errorContainer: {
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginTop: 6,
  },
  infoContainer: {
    backgroundColor: "rgba(255, 107, 0, 0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 0, 0.2)",
    padding: 16,
    gap: 8,
    marginTop: 6,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.error,
  },
  errorMessage: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.accent_primary,
  },
  infoMessage: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionMeta: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 999,
    padding: 4,
    marginTop: 12,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_muted,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  recentCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  recentDescription: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  recentMeta: {
    fontSize: 12,
    color: PREMIUM_COLORS.text_muted,
  },
  emptyContainer: {
    paddingVertical: 32,
    gap: 8,
    alignItems: "center",
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
    color: PREMIUM_COLORS.text_muted,
  },
  missingContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  missingText: {
    fontSize: 14,
    textAlign: "center",
    color: PREMIUM_COLORS.text_muted,
  },
  retryButton: {
    backgroundColor: PREMIUM_COLORS.accent_primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
    alignItems: "center",
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10, 22, 40, 0.92)",
  },
  modalCard: {
    backgroundColor: PREMIUM_COLORS.gradient_start,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 24,
    padding: 24,
    minHeight: "65%",
    justifyContent: "space-between",
    gap: 20,
  },
  manualFormScroll: {
    flex: 1,
  },
  manualFormContent: {
    gap: 16,
    paddingBottom: 12,
  },
  modalCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modalContent: {
    alignItems: "center",
    gap: 14,
  },
  modalStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalCodeText: {
    textAlign: "center",
    color: PREMIUM_COLORS.text_primary,
  },
  modalDescription: {
    fontSize: 18,
    textAlign: "center",
    color: PREMIUM_COLORS.text_secondary,
  },
  manualPreview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PREMIUM_COLORS.glass_border,
  },
  modalMeta: {
    fontSize: 14,
    textAlign: "center",
    color: PREMIUM_COLORS.text_muted,
  },
  alreadyScannedText: {
    fontSize: 13,
    textAlign: "center",
    color: PREMIUM_COLORS.warning,
  },
  modalField: {
    width: "100%",
    gap: 8,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_muted,
  },
  modalInput: {
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: PREMIUM_COLORS.text_primary,
  },
  modalButton: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.accent_primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalButtonSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  etatSection: {
    width: "100%",
    gap: 12,
    paddingTop: 8,
  },
  etatOptions: {
    gap: 10,
  },
  etatOption: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  etatOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  etatOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  etatErrorText: {
    fontSize: 13,
    textAlign: "center",
    color: PREMIUM_COLORS.error,
    marginTop: 4,
  },
});
