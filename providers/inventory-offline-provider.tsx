import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, ToastAndroid } from "react-native";
import * as FileSystem from "expo-file-system";
import { ApolloError, useApolloClient } from "@apollo/client";

import { useAuth } from "@/hooks/use-auth";
import {
  CAMPAGNE_INVENTAIRE_LIST_QUERY,
  GROUPE_COMPTAGE_LIST_QUERY,
  LOCATION_LIST_QUERY,
  OFFLINE_ARTICLE_PAGES_QUERY,
  SYNC_INVENTORY_SCANS_MUTATION,
  type CampagneInventaireListData,
  type CampagneInventaireListVariables,
  type GroupeComptageListData,
  type GroupeComptageListVariables,
  type InventoryScanSyncInput,
  type OfflineArticlePageData,
  type OfflineArticlePageVariables,
  type LocationListData,
  type LocationListVariables,
  type OfflineArticleEntry,
  type OfflineArticleLocation,
  type OfflineArticleQueryItem,
  type SyncInventoryScansData,
  type SyncInventoryScansVariables,
} from "@/lib/graphql/inventory-operations";
import { getApolloErrorMessage } from "@/lib/graphql/inventory-hooks";
import {
  loadInventoryOfflineCache,
  loadInventoryOfflineMetadata,
  saveInventoryOfflineCache,
  saveInventoryOfflineMetadata,
  type InventoryOfflineCache,
  type InventoryOfflineMetadata,
} from "@/lib/offline/inventory-offline-storage";
import {
  loadInventoryScans,
  markInventoryScansSynced,
  type InventoryScanRecord,
  type InventoryScanSyncUpdateInput,
} from "@/lib/offline/inventory-scan-storage";

/** Offline cache limits used during a full sync. */
const OFFLINE_SYNC_LIMITS = {
  campaigns: 500,
  groups: 500,
  locations: 2000,
  articles: 1000,
} as const;

/** Max number of scan records to sync per request. */
const SCAN_SYNC_BATCH_SIZE = 100;

/** Base64 metadata payload used for scan image sync. */
type ScanCapturePayload = {
  /** Image payload with base64 and mime metadata. */
  image: {
    /** Base64 encoded image data. */
    data_base64: string;
    /** Image mime type derived from the file extension. */
    mime_type: string;
    /** Optional filename derived from the local URI. */
    filename: string | null;
  };
};

/** Default empty cache payload for the inventory offline provider. */
const EMPTY_CACHE: InventoryOfflineCache = {
  campaigns: [],
  groups: [],
  locations: [],
  articles: [],
};

/** Default metadata for the inventory offline provider. */
const EMPTY_METADATA: InventoryOfflineMetadata = {
  lastSyncAt: null,
};

/** Summary returned after syncing local scan records. */
export type InventoryScanSyncSummary = {
  /** Total number of scans considered for sync. */
  totalCount: number;
  /** Number of scans successfully synced. */
  syncedCount: number;
  /** Number of scans that failed to sync. */
  failedCount: number;
};

/**
 * Display a toast notification when data is loaded locally.
 */
function showLocalSyncToast(): void {
  if (Platform.OS !== "android") {
    return;
  }

  ToastAndroid.show("Donnees chargees localement.", ToastAndroid.SHORT);
}

/**
 * Split a list into chunks for batched requests.
 */
function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Infer the mime type from a local image URI.
 */
function guessImageMimeType(uri: string): string {
  const lowered = uri.toLowerCase();
  if (lowered.endsWith(".png")) {
    return "image/png";
  }
  if (lowered.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowered.endsWith(".heic") || lowered.endsWith(".heif")) {
    return "image/heic";
  }
  return "image/jpeg";
}

/**
 * Extract a filename from a file URI if possible.
 */
function extractFileName(uri: string): string | null {
  const trimmed = uri.split("?")[0] ?? "";
  const parts = trimmed.split("/");
  return parts.length > 0 ? parts[parts.length - 1] ?? null : null;
}

/**
 * Build the capture payload for a scan image when present.
 */
async function buildScanCapturePayload(
  scan: InventoryScanRecord
): Promise<string | undefined> {
  if (!scan.imageUri) {
    return undefined;
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(scan.imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64) {
      return undefined;
    }

    const payload: ScanCapturePayload = {
      image: {
        data_base64: base64,
        mime_type: guessImageMimeType(scan.imageUri),
        filename: extractFileName(scan.imageUri),
      },
    };

    return JSON.stringify(payload);
  } catch {
    return undefined;
  }
}

/**
 * Map a scan record into the GraphQL sync payload.
 */
async function buildScanSyncInput(
  scan: InventoryScanRecord
): Promise<InventoryScanSyncInput> {
  return {
    local_id: scan.id,
    campagne: scan.campaignId,
    groupe: scan.groupId,
    lieu: scan.locationId,
    code_article: scan.codeArticle,
    capture_le: scan.capturedAt,
    source_scan: scan.sourceScan ?? undefined,
    donnees_capture: (await buildScanCapturePayload(scan)) ?? undefined,
    custom_desc: scan.customDesc ?? undefined,
    observation: scan.observation ?? undefined,
    serial_number: scan.serialNumber ?? undefined,
    etat: scan.etat ?? undefined,
    article: scan.articleId ?? undefined,
  };
}

/** Context shape for offline inventory data. */
export type InventoryOfflineContextValue = {
  /** Cached datasets for offline usage. */
  cache: InventoryOfflineCache;
  /** Metadata about the offline cache. */
  metadata: InventoryOfflineMetadata;
  /** Whether cache hydration from storage has completed. */
  isHydrated: boolean;
  /** Whether a full offline sync is in progress. */
  isSyncing: boolean;
  /** Whether a scan upload sync is in progress. */
  isScanSyncing: boolean;
  /** Error message captured during the last sync attempt. */
  syncError: string | null;
  /** Error message captured during the last scan sync attempt. */
  scanSyncError: string | null;
  /** Trigger a full offline sync of inventory data. */
  syncAll: () => Promise<void>;
  /** Upload local scan records to the backend. */
  syncScans: () => Promise<InventoryScanSyncSummary>;
};

/** Props for the InventoryOfflineProvider component. */
export type InventoryOfflineProviderProps = {
  /** React child nodes rendered within the provider. */
  children: React.ReactNode;
};

/** Inventory offline context instance. */
export const InventoryOfflineContext =
  createContext<InventoryOfflineContextValue | null>(null);

/**
 * Build offline article payloads with unique location lists.
 */
function mapOfflineArticles(
  items: OfflineArticleQueryItem[]
): OfflineArticleEntry[] {
  return items.map((item) => {
    const locationsById = new Map<string, OfflineArticleLocation>();

    for (const affectation of item.affectation_set ?? []) {
      const location = affectation.location;
      if (!location) {
        continue;
      }

      locationsById.set(location.id, location);
    }

    const locations = Array.from(locationsById.values()).sort((a, b) =>
      a.locationname.localeCompare(b.locationname)
    );

    return {
      id: item.id,
      code: item.code,
      desc: item.desc ?? null,
      currentLocation: item.current_location ?? null,
      locations,
    };
  });
}

/**
 * Load all articles for offline usage via paginated API calls.
 */
async function loadOfflineArticles(client: ReturnType<typeof useApolloClient>) {
  const items: OfflineArticleQueryItem[] = [];
  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= totalPages) {
    const response = await client.query<
      OfflineArticlePageData,
      OfflineArticlePageVariables
    >({
      query: OFFLINE_ARTICLE_PAGES_QUERY,
      variables: { page: currentPage, page_size: OFFLINE_SYNC_LIMITS.articles },
      fetchPolicy: "network-only",
    });
    console.log({ page: currentPage, page_size: OFFLINE_SYNC_LIMITS.articles });

    const pagePayload = response.data?.article_pages ?? null;
    const pageItems = pagePayload?.data ?? [];
    items.push(...pageItems);

    totalPages = pagePayload?.totalPages ?? currentPage;
    currentPage += 1;
  }

  return items;
}

/**
 * Provide cached inventory data and a sync action for offline mode.
 */
export function InventoryOfflineProvider({
  children,
}: InventoryOfflineProviderProps) {
  const client = useApolloClient();
  const [cache, setCache] = useState<InventoryOfflineCache>(EMPTY_CACHE);
  const [metadata, setMetadata] =
    useState<InventoryOfflineMetadata>(EMPTY_METADATA);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanSyncing, setIsScanSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [scanSyncError, setScanSyncError] = useState<string | null>(null);
  const { accessToken, isAuthenticated } = useAuth();
  const lastSyncTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    /** Load cached inventory data on startup. */
    const hydrateCache = async () => {
      const [storedCache, storedMetadata] = await Promise.all([
        loadInventoryOfflineCache(),
        loadInventoryOfflineMetadata(),
      ]);

      if (!isMounted) {
        return;
      }

      setCache(storedCache);
      setMetadata(storedMetadata);
      setIsHydrated(true);
    };

    hydrateCache();

    return () => {
      isMounted = false;
    };
  }, []);

  /** Trigger a full offline sync against the GraphQL API. */
  const syncAll = useCallback(async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const [campaignResult, groupResult, locationResult, articleItems] =
        await Promise.all([
          client.query<
            CampagneInventaireListData,
            CampagneInventaireListVariables
          >({
            query: CAMPAGNE_INVENTAIRE_LIST_QUERY,
            variables: { limit: OFFLINE_SYNC_LIMITS.campaigns },
            fetchPolicy: "network-only",
          }),
          client.query<GroupeComptageListData, GroupeComptageListVariables>({
            query: GROUPE_COMPTAGE_LIST_QUERY,
            variables: { role: "COMPTAGE", limit: OFFLINE_SYNC_LIMITS.groups },
            fetchPolicy: "network-only",
          }),
          client.query<LocationListData, LocationListVariables>({
            query: LOCATION_LIST_QUERY,
            variables: { limit: OFFLINE_SYNC_LIMITS.locations },
            fetchPolicy: "network-only",
          }),
          loadOfflineArticles(client),
        ]);

      const nextCache: InventoryOfflineCache = {
        campaigns: campaignResult.data?.campagneinventaires ?? [],
        groups: groupResult.data?.groupecomptages ?? [],
        locations: locationResult.data?.locations ?? [],
        articles: mapOfflineArticles(articleItems),
      };

      const nextMetadata: InventoryOfflineMetadata = {
        lastSyncAt: new Date().toISOString(),
      };

      await saveInventoryOfflineCache(nextCache);
      await saveInventoryOfflineMetadata(nextMetadata);

      setCache(nextCache);
      setMetadata(nextMetadata);
      showLocalSyncToast();
    } catch (error) {
      const message =
        error instanceof ApolloError
          ? getApolloErrorMessage(error)
          : error instanceof Error
          ? error.message
          : null;
      setSyncError(message ?? "La synchronisation hors-ligne a echoue.");
    } finally {
      setIsSyncing(false);
    }
  }, [client, isSyncing]);

  /** Upload local scan records to the backend API. */
  const syncScans = useCallback(async (): Promise<InventoryScanSyncSummary> => {
    if (!isAuthenticated || !accessToken) {
      const message = "Connexion requise pour synchroniser.";
      setScanSyncError(message);
      throw new Error(message);
    }

    setIsScanSyncing(true);
    setScanSyncError(null);

    try {
      const pendingScans = await loadInventoryScans({ isSynced: false });
      if (pendingScans.length === 0) {
        return { totalCount: 0, syncedCount: 0, failedCount: 0 };
      }

      const syncUpdates: InventoryScanSyncUpdateInput[] = [];
      let failedCount = 0;

      for (const batch of chunkItems(pendingScans, SCAN_SYNC_BATCH_SIZE)) {
        const input = await Promise.all(batch.map(buildScanSyncInput));
        const response = await client.mutate<
          SyncInventoryScansData,
          SyncInventoryScansVariables
        >({
          mutation: SYNC_INVENTORY_SCANS_MUTATION,
          variables: { input },
          fetchPolicy: "no-cache",
        });

        const results = response.data?.sync_inventory_scans?.results ?? [];
        const resultMap = new Map(
          results.map((result) => [result.local_id, result])
        );

        for (const scan of batch) {
          const result = resultMap.get(scan.id);
          if (result?.ok && result.remote_id) {
            syncUpdates.push({ id: scan.id, remoteId: result.remote_id });
          } else {
            failedCount += 1;
          }
        }
      }

      if (syncUpdates.length > 0) {
        await markInventoryScansSynced(syncUpdates);
      }

      const syncedCount = syncUpdates.length;
      return {
        totalCount: pendingScans.length,
        syncedCount,
        failedCount,
      };
    } catch (error) {
      const message =
        error instanceof ApolloError
          ? getApolloErrorMessage(error)
          : error instanceof Error
          ? error.message
          : "La synchronisation des scans a echoue.";
      setScanSyncError(message);
      throw new Error(message);
    } finally {
      setIsScanSyncing(false);
    }
  }, [accessToken, client, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      lastSyncTokenRef.current = null;
      return;
    }

    if (!isHydrated || !accessToken) {
      return;
    }

    if (lastSyncTokenRef.current === accessToken) {
      return;
    }

    lastSyncTokenRef.current = accessToken;
    void syncAll();
  }, [accessToken, isAuthenticated, isHydrated, syncAll]);

  const contextValue = useMemo<InventoryOfflineContextValue>(
    () => ({
      cache,
      metadata,
      isHydrated,
      isSyncing,
      isScanSyncing,
      syncError,
      scanSyncError,
      syncAll,
      syncScans,
    }),
    [
      cache,
      isHydrated,
      isScanSyncing,
      isSyncing,
      metadata,
      scanSyncError,
      syncAll,
      syncError,
      syncScans,
    ]
  );

  return (
    <InventoryOfflineContext.Provider value={contextValue}>
      {children}
    </InventoryOfflineContext.Provider>
  );
}
