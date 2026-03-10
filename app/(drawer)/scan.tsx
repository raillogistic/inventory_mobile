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
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  useCameraPermissions,
  type BarcodeScanningResult,
  type CameraView,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";

import { ThemedText } from "@/components/themed-text";
import {
  PremiumScreenWrapper,
  PREMIUM_COLORS,
} from "@/components/ui/premium-theme";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";

import {
  type EnregistrementInventaireEtat,
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

import {
  SCAN_STATUS_LIMIT,
} from "./scan-screen/constants";
import {
  type RecentScan,
  type ScanSource,
  type ScanCoordinates,
  type LocationArticleStatus,
  type LocationArticleItem,
  type ScanListTab,
  type ScanDetail,
  type ScanButtonLayout,
  type ScanFrameLayout,
  type CameraViewHandle,
} from "./scan-screen/types";
import {
  formatTimestamp,
  buildManualCode,
  buildOfflineArticleLookup,
  normalizeScanCode,
  getSilentScanCoordinates,
  getStatusLabel,
  isBarcodeInsideFrame,
} from "./scan-screen/utils";

import { ScanListItem } from "./scan-screen/components/scan-list-item";
import { ScanHeader } from "./scan-screen/components/scan-header";
import { CameraModal } from "./scan-screen/components/camera-modal";
import { ManualModal } from "./scan-screen/components/manual-modal";
import { ScanDetailModal } from "./scan-screen/components/scan-detail-modal";
import { ContextCard } from "./scan-screen/components/context-card";
import { RecapCard } from "./scan-screen/components/recap-card";
import { ScanTabs } from "./scan-screen/components/scan-tabs";

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
  const [manualImageUri2, setManualImageUri2] = useState<string | null>(null);
  const [manualImageUri3, setManualImageUri3] = useState<string | null>(null);
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
  
  const codeInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraViewHandle | null>(null);
  const manualCameraRef = useRef<CameraViewHandle | null>(null);
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

  const hasCameraPermission = cameraPermission?.granted ?? false;
  const canAskCameraPermission = cameraPermission?.canAskAgain ?? true;
  const isScanModalVisible = Boolean(scanDetail);
  const isScanBusy = isScanLocked || isSubmittingScan || isScanModalVisible;
  const isCameraButtonDisabled =
    !hasCameraPermission && !canAskCameraPermission;
  const manualStatusMessage = "Ajoutez un article manuellement.";
  
  const manualImageUris = useMemo(
    () =>
      [manualImageUri, manualImageUri2, manualImageUri3].filter(
        (uri): uri is string => Boolean(uri)
      ),
    [manualImageUri, manualImageUri2, manualImageUri3]
  );
  
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
            articleId: scan.articleId ?? lookup?.id ?? null,
            description: scan.articleDescription ?? lookup?.desc ?? null,
            customDesc: scan.customDesc ?? null,
            observation: scan.observation ?? null,
            serialNumber: scan.serialNumber ?? lookup?.serialnumber ?? null,
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

  useEffect(() => {
    if (!hasCameraPermission) {
      setIsCameraActive(false);
      setIsManualCaptureActive(false);
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
    setManualImageUri2(null);
    setManualImageUri3(null);
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
    setManualImageUri2(null);
    setManualImageUri3(null);
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
      if (manualImageUri && manualImageUri2 && manualImageUri3) {
        setManualError("Maximum 3 photos.");
        return;
      }

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
        if (!manualImageUri) {
          setManualImageUri(persistedUri);
        } else if (!manualImageUri2) {
          setManualImageUri2(persistedUri);
        } else {
          setManualImageUri3(persistedUri);
        }
        setManualError(null);
        return;
      }
      setManualError("Impossible de capturer l'image.");
    } catch {
      setManualError("Impossible de capturer l'image.");
    }
  }, [manualImageUri, manualImageUri2, manualImageUri3, persistManualCapture]);

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
      const scanCoordinates = await getSilentScanCoordinates();
      const record = await createInventoryScan({
        campaignId,
        groupId,
        locationId,
        locationName: session.location?.locationname ?? "Lieu inconnu",
        latitude: scanCoordinates?.latitude ?? null,
        longitude: scanCoordinates?.longitude ?? null,
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
        imageUri2: manualImageUri2,
        imageUri3: manualImageUri3,
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
    manualImageUri2,
    manualImageUri3,
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

      setIsSubmittingScan(true);
      try {
        let lookup = normalizedCode ? articleLookup.get(normalizedCode) : null;
        if (!lookup) {
          lookup = await loadInventoryArticleByCode(cleanedCode);
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
            articleId: existingScan.articleId ?? null,
            description: detailDescription,
            imageUri,
            customDesc: existingScan.customDesc ?? null,
            source: null,
            status,
            statusLabel,
            capturedAt: existingScan.capturedAt,
            alreadyScanned: true,
            observation: existingScan.observation ?? null,
            serialNumber:
              existingScan.serialNumber ?? lookup?.serialnumber ?? null,
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

        setScanDetail({
          id: null,
          code: cleanedCode,
          articleId: lookup?.id ?? null,
          description: detailDescription,
          imageUri,
          customDesc: null,
          source,
          status,
          statusLabel,
          capturedAt: new Date().toISOString(),
          alreadyScanned: false,
          observation: null,
          serialNumber:
            status === "missing" ? null : lookup?.serialnumber ?? null,
        });
        setIsCameraActive(false);
        setSelectedEtat(null);
        setEtatMessage(null);
        setCodeValue("");
        await triggerSuccessHaptic();
        return;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de charger l'article.";
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
      return <ScanListItem item={item} activeTab={activeTab} />;
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
    } else if (isDraft && !selectedEtat) {
      setEtatMessage("Choisissez un etat.");
      return;
    } else if (!isDraft && !selectedEtat && !shouldUpdate) {
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
        const normalizedCode = normalizeScanCode(scanDetail.code);
        const resolvedArticle =
          normalizedCode.length > 0 ? articleLookup.get(normalizedCode) : null;
        const scanCoordinates = await getSilentScanCoordinates();
        savedRecord = await createInventoryScan({
          campaignId,
          groupId,
          locationId,
          locationName,
          latitude: scanCoordinates?.latitude ?? null,
          longitude: scanCoordinates?.longitude ?? null,
          codeArticle: scanDetail.code,
          articleId: scanDetail.articleId ?? resolvedArticle?.id ?? null,
          articleDescription:
            scanDetail.description ?? resolvedArticle?.desc ?? null,
          customDesc: hasCustomDescription ? trimmedCustomDescription : null,
          observation: hasObservation ? trimmedObservation : null,
          serialNumber: hasSerialNumber ? trimmedSerialNumber : null,
          etat: selectedEtat ?? null,
          capturedAt: scanDetail.capturedAt,
          sourceScan: scanDetail.source ?? "manual",
          imageUri: scanDetail.imageUri,
          status: scanDetail.status as InventoryScanStatus,
          statusLabel: scanDetail.statusLabel,
        });

        if (savedRecord) {
            setScanRecords((current) => {
                const next = [savedRecord!, ...current];
                return next.slice(0, SCAN_STATUS_LIMIT);
            });
        }
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
    scanDetail,
    observationValue,
    serialNumberValue,
    selectedEtat,
    session.location?.id,
    session.location?.locationname,
    articleLookup,
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
            <ScanHeader
              hasCameraPermission={hasCameraPermission}
              isCameraButtonDisabled={isCameraButtonDisabled}
              isSubmittingScan={isSubmittingScan}
              isScanModalVisible={isScanModalVisible}
              codeValue={codeValue}
              onCodeChange={handleCodeChange}
              onCodeSubmit={handleCodeSubmit}
              onToggleCamera={handleToggleCamera}
              onRequestCamera={handleRequestCamera}
              onOpenManualCapture={handleOpenManualCapture}
              manualStatusMessage={manualStatusMessage}
              inputRef={codeInputRef}
            />

            <ContextCard onChangeLocation={handleChangeLocation} />

            <RecapCard totalScanCount={totalScanCount} lastScan={lastScan} />

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
                  {
                    backgroundColor: PREMIUM_COLORS.glass_bg,
                    borderColor: PREMIUM_COLORS.glass_border,
                  },
                ]}
              >
                <ThemedText style={styles.infoTitle}>
                  Code deja scanne
                </ThemedText>
                <ThemedText
                  style={[
                    styles.infoMessage,
                    { color: PREMIUM_COLORS.text_muted },
                  ]}
                >
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

            <ScanTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              scannedCountLabel={scannedTabCountLabel}
              articleCountLabel={articleCountLabel}
            />
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
      
      <ScanDetailModal
        visible={isScanModalVisible}
        scanDetail={scanDetail}
        customDesc={customDescriptionValue}
        observation={observationValue}
        serialNumber={serialNumberValue}
        selectedEtat={selectedEtat}
        isLoading={etatLoading}
        error={etatErrorDisplay}
        onClose={handleCloseScanModal}
        onConfirm={handleConfirmEtat}
        onCustomDescChange={handleCustomDescriptionChange}
        onObservationChange={handleObservationChange}
        onSerialNumberChange={handleSerialNumberChange}
        onEtatSelect={handleEtatSelect}
      />
      
      <CameraModal
        visible={hasCameraPermission && isCameraActive}
        onClose={() => setIsCameraActive(false)}
        onBarcodeScanned={handleBarcodeScanned}
        onLayoutFrame={(e: LayoutChangeEvent) =>
          setScanFrameLayout(e.nativeEvent.layout)
        }
        isScanBusy={isScanBusy}
        overlayLabel={cameraOverlayLabel}
        ref={cameraRef}
      />

      <CameraModal
        visible={isManualCaptureActive}
        onClose={handleManualCaptureClose}
        onBarcodeScanned={() => {}} 
        onLayoutFrame={() => {}} 
        isScanBusy={false}
        overlayLabel={null}
        ref={manualCameraRef}
      />
      
      {/* 
        NOTE: The original code had a separate manual capture modal which was basically a camera. 
        I reused CameraModal for consistency but manual capture had some specific UI (taking photos vs scanning).
        
        Actually, the original code had a specific UI for manual capture in the modal.
        Let's check if I should use ManualModal for the FORM part or the CAPTURE part.
        
        Original code had:
        1. Modal visible={isManualCaptureActive}: Camera view to take picture.
        2. Modal visible={isManualFormVisible}: Form to enter details.
        
        My ManualModal is the FORM part.
        I need to handle the CAPTURE part.
        
        The extracted CameraModal is for scanning barcodes.
        The manual capture needs a "Take Picture" button.
        
        I should revert using CameraModal for manual capture and restore the inline modal or create a specific component.
        For now, I'll inline the Manual Capture Camera Modal since it has specific logic (take photo button, continue button).
        
        Wait, I see I missed extracting `ManualCaptureCameraModal`.
        I will create it now quickly.
      */}
      
      <ManualCaptureCameraModal 
         visible={isManualCaptureActive}
         onClose={handleManualCaptureClose}
         onCapture={handleManualCapture}
         onContinue={handleManualContinue}
         imageCount={manualImageUris.length}
         error={manualError}
         canContinue={Boolean(manualImageUri)}
         ref={manualCameraRef}
      />

      <ManualModal
        visible={isManualFormVisible}
        imageUris={manualImageUris}
        customDesc={manualCustomDesc}
        observation={manualObservation}
        serialNumber={manualSerialNumber}
        etat={manualEtat}
        error={manualError}
        isSaving={isManualSaving}
        onClose={handleManualCancel}
        onSubmit={handleManualSubmit}
        onCustomDescChange={handleManualCustomDescChange}
        onObservationChange={handleManualObservationChange}
        onSerialNumberChange={handleManualSerialNumberChange}
        onEtatSelect={handleManualEtatSelect}
      />
    </PremiumScreenWrapper>
  );
}

// I need to define ManualCaptureCameraModal locally or create a file.
// I'll create a file for it.
import { ManualCaptureCameraModal } from "./scan-screen/components/manual-capture-camera-modal";

const styles = StyleSheet.create({
  headerContainer: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
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
});
