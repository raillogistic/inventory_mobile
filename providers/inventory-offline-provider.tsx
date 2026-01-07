import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, ToastAndroid } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { ApolloError, useApolloClient } from "@apollo/client";

import { useAuth } from "@/hooks/use-auth";
import {
  CAMPAGNE_INVENTAIRE_LIST_QUERY,
  GROUPE_COMPTAGE_LIST_QUERY,
  LOCATION_LIST_QUERY,
  OFFLINE_ARTICLE_PAGES_QUERY,
  SYNC_INVENTORY_SCAN_IMAGES_MUTATION,
  SYNC_INVENTORY_SCANS_MUTATION,
  type CampagneInventaireListData,
  type CampagneInventaireListVariables,
  type GroupeComptageListData,
  type GroupeComptageListVariables,
  type InventoryScanImageSyncInput,
  type InventoryScanSyncInput,
  type OfflineArticlePageData,
  type OfflineArticlePageVariables,
  type LocationListData,
  type LocationListVariables,
  type OfflineArticleEntry,
  type OfflineArticleLocation,
  type OfflineArticleQueryItem,
  type SyncInventoryScanImagesData,
  type SyncInventoryScanImagesVariables,
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
  loadInventoryScanById,
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
const SCAN_SYNC_BATCH_SIZE = 2;

/** JPEG quality used for scan image compression (0..1). */
const SCAN_IMAGE_COMPRESSION_QUALITY = 0.7;

/** MIME type for compressed scan images. */
const SCAN_IMAGE_MIME_TYPE = "image/jpeg";

/** Base64 metadata payload used for scan image sync. */
type ScanCapturePayload = {
  /** Image payload with base64 and mime metadata. */
  image?: {
    /** Base64 encoded image data. */
    data_base64: string;
    /** Image mime type derived from the file extension. */
    mime_type: string;
    /** Optional filename derived from the local URI. */
    filename: string | null;
  };
  /** Optional list of images for multi-photo captures. */
  images?: {
    /** Base64 encoded image data. */
    data_base64: string;
    /** Image mime type derived from the file extension. */
    mime_type: string;
    /** Optional filename derived from the local URI. */
    filename: string | null;
  }[];
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
  /** Optional error details for failed scans. */
  errors?: string[];
};

/** Options for scan synchronization. */
type InventoryScanSyncOptions = {
  /** Whether to include image payloads in the sync. */
  includeImages?: boolean;
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
 * Extract a filename from a file URI if possible.
 */
function extractFileName(uri: string): string | null {
  const trimmed = uri.split("?")[0] ?? "";
  const parts = trimmed.split("/");
  return parts.length > 0 ? parts[parts.length - 1] ?? null : null;
}

/**
 * Normalize a filename to a .jpg extension when compressing.
 */
function normalizeJpegFileName(name: string | null): string | null {
  if (!name) {
    return null;
  }

  const baseName = name.split(".")[0] ?? "scan";
  return `${baseName}.jpg`;
}

/**
 * Compress a scan image and return base64 payload with metadata.
 * @param uri - Local image URI.
 * @returns Base64 data and metadata for GraphQL payload.
 */
async function compressImageForSync(
  uri: string
): Promise<{ base64: string; mimeType: string; filename: string | null }> {
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: SCAN_IMAGE_COMPRESSION_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error("Image compression failed.");
  }

  return {
    base64: result.base64,
    mimeType: SCAN_IMAGE_MIME_TYPE,
    filename: normalizeJpegFileName(extractFileName(uri)),
  };
}

/**
 * Build the capture payload for a scan image when present.
 */
async function buildScanCapturePayload(
  scan: InventoryScanRecord
): Promise<string | undefined> {
  const imageUris = [scan.imageUri, scan.imageUri2, scan.imageUri3].filter(
    (uri): uri is string => Boolean(uri)
  );
  if (imageUris.length === 0) {
    return undefined;
  }

  const images: ScanCapturePayload["images"] = [];

  for (const uri of imageUris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error("Image introuvable pour le scan.");
    }

    let compressed;
    try {
      compressed = await compressImageForSync(uri);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Compression image impossible.";
      throw new Error(message);
    }

    images.push({
      data_base64: compressed.base64,
      mime_type: compressed.mimeType,
      filename: compressed.filename,
    });
  }

  const payload: ScanCapturePayload = {
    image: images[0],
    images,
  };

  return JSON.stringify(payload);
}

/**
 * Map a scan record into the GraphQL sync payload.
 */
async function buildScanSyncInput(
  scan: InventoryScanRecord,
  options?: InventoryScanSyncOptions
): Promise<InventoryScanSyncInput> {
  const includeImages = options?.includeImages ?? true;
  return {
    local_id: scan.id,
    campagne: scan.campaignId,
    groupe: scan.groupId,
    lieu: scan.locationId,
    code_article: scan.codeArticle,
    capture_le: scan.capturedAt,
    source_scan: scan.sourceScan ?? undefined,
    latitude: scan.latitude ?? undefined,
    longitude: scan.longitude ?? undefined,
    donnees_capture: includeImages
      ? (await buildScanCapturePayload(scan)) ?? undefined
      : undefined,
    custom_desc: scan.customDesc ?? undefined,
    observation: scan.observation ?? undefined,
    serial_number: scan.serialNumber ?? undefined,
    etat: scan.etat ?? undefined,
    article: scan.articleId ?? undefined,
  };
}

/**
 * Build the payload for syncing images to an existing scan.
 * @param scan - Scan record with a remote identifier.
 * @returns Image-only sync payload.
 */
async function buildScanImageSyncInput(
  scan: InventoryScanRecord
): Promise<InventoryScanImageSyncInput> {
  if (!scan.remoteId) {
    throw new Error("Identifiant distant manquant.");
  }

  const capturePayload = await buildScanCapturePayload(scan);
  if (!capturePayload) {
    throw new Error("Aucune image a synchroniser.");
  }

  return {
    local_id: scan.id,
    remote_id: scan.remoteId,
    donnees_capture: capturePayload,
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
  /** Upload a single scan record by id to the backend. */
  syncScanById: (
    scanId: string,
    options?: InventoryScanSyncOptions
  ) => Promise<InventoryScanSyncSummary>;
  /** Upload images for a previously synced scan. */
  syncScanImageById: (scanId: string) => Promise<InventoryScanSyncSummary>;
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
      serialnumber: item.serialnumber ?? null,
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

  /** Upload a single scan record to the backend API. */
  const syncScanById = useCallback(
    async (
      scanId: string,
      options?: InventoryScanSyncOptions
    ): Promise<InventoryScanSyncSummary> => {
      if (!isAuthenticated || !accessToken) {
        const message = "Connexion requise pour synchroniser.";
        setScanSyncError(message);
        throw new Error(message);
      }

      setIsScanSyncing(true);
      setScanSyncError(null);

      try {
        const scan = await loadInventoryScanById(scanId);
        if (!scan) {
          const message = "Scan introuvable.";
          setScanSyncError(message);
          return {
            totalCount: 0,
            syncedCount: 0,
            failedCount: 0,
            errors: [message],
          };
        }

        if (scan.isSynced) {
          return { totalCount: 1, syncedCount: 1, failedCount: 0 };
        }

        let payload: InventoryScanSyncInput;
        try {
          payload = await buildScanSyncInput(scan, options);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Preparation image impossible.";
          setScanSyncError(message);
          return {
            totalCount: 1,
            syncedCount: 0,
            failedCount: 1,
            errors: [message],
          };
        }

        const response = await client.mutate<
          SyncInventoryScansData,
          SyncInventoryScansVariables
        >({
          mutation: SYNC_INVENTORY_SCANS_MUTATION,
          variables: { input: [payload] },
          fetchPolicy: "no-cache",
        });

        const results = response.data?.sync_inventory_scans?.results ?? [];
        const result = results.find((item) => item.local_id === scan.id);

        if (result?.ok && result.remote_id) {
          const syncedWithoutImage = options?.includeImages === false;
          await markInventoryScansSynced([
            {
              id: scan.id,
              remoteId: result.remote_id,
              syncedWithoutImage,
            },
          ]);
          return { totalCount: 1, syncedCount: 1, failedCount: 0 };
        }

        const reason =
          result?.errors && result.errors.length > 0
            ? result.errors.join(", ")
            : "Reponse manquante.";
        const errorMessage = `${scan.codeArticle}: ${reason}`;
        setScanSyncError(errorMessage);
        return {
          totalCount: 1,
          syncedCount: 0,
          failedCount: 1,
          errors: [errorMessage],
        };
      } catch (error) {
        const message =
          error instanceof ApolloError
            ? getApolloErrorMessage(error)
            : error instanceof Error
            ? error.message
            : "La synchronisation du scan a echoue.";
        setScanSyncError(message);
        throw new Error(message);
      } finally {
        setIsScanSyncing(false);
      }
    },
    [accessToken, client, isAuthenticated]
  );

  /** Upload images for a previously synced scan record. */
  const syncScanImageById = useCallback(
    async (scanId: string): Promise<InventoryScanSyncSummary> => {
      if (!isAuthenticated || !accessToken) {
        const message = "Connexion requise pour synchroniser.";
        setScanSyncError(message);
        throw new Error(message);
      }

      setIsScanSyncing(true);
      setScanSyncError(null);

      try {
        const scan = await loadInventoryScanById(scanId);
        if (!scan) {
          const message = "Scan introuvable.";
          setScanSyncError(message);
          return {
            totalCount: 0,
            syncedCount: 0,
            failedCount: 0,
            errors: [message],
          };
        }

        if (!scan.isSynced || !scan.syncedWithoutImage) {
          const message = "Le scan est deja complet.";
          setScanSyncError(message);
          return {
            totalCount: 1,
            syncedCount: 0,
            failedCount: 1,
            errors: [message],
          };
        }

        let payload: InventoryScanImageSyncInput;
        try {
          payload = await buildScanImageSyncInput(scan);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Preparation image impossible.";
          setScanSyncError(message);
          return {
            totalCount: 1,
            syncedCount: 0,
            failedCount: 1,
            errors: [message],
          };
        }

        const response = await client.mutate<
          SyncInventoryScanImagesData,
          SyncInventoryScanImagesVariables
        >({
          mutation: SYNC_INVENTORY_SCAN_IMAGES_MUTATION,
          variables: { input: [payload] },
          fetchPolicy: "no-cache",
        });

        const results =
          response.data?.sync_inventory_scan_images?.results ?? [];
        const result = results.find((item) => item.local_id === scan.id);

        if (result?.ok && result.remote_id) {
          await markInventoryScansSynced([
            {
              id: scan.id,
              remoteId: scan.remoteId,
              syncedWithoutImage: false,
            },
          ]);
          return { totalCount: 1, syncedCount: 1, failedCount: 0 };
        }

        const reason =
          result?.errors && result.errors.length > 0
            ? result.errors.join(", ")
            : "Reponse manquante.";
        const errorMessage = `${scan.codeArticle}: ${reason}`;
        setScanSyncError(errorMessage);
        return {
          totalCount: 1,
          syncedCount: 0,
          failedCount: 1,
          errors: [errorMessage],
        };
      } catch (error) {
        const message =
          error instanceof ApolloError
            ? getApolloErrorMessage(error)
            : error instanceof Error
            ? error.message
            : "La synchronisation de l'image a echoue.";
        setScanSyncError(message);
        throw new Error(message);
      } finally {
        setIsScanSyncing(false);
      }
    },
    [accessToken, client, isAuthenticated]
  );

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
      const errorDetails: string[] = [];
      let failedCount = 0;

      for (const batch of chunkItems(pendingScans, SCAN_SYNC_BATCH_SIZE)) {
        const input: InventoryScanSyncInput[] = [];
        const syncBatchScans: InventoryScanRecord[] = [];

        for (const scan of batch) {
          try {
            const payload = await buildScanSyncInput(scan);
            input.push(payload);
            syncBatchScans.push(scan);
          } catch (error) {
            failedCount += 1;
            const message =
              error instanceof Error
                ? error.message
                : "Preparation image impossible.";
            errorDetails.push(`${scan.codeArticle}: ${message}`);
          }
        }

        if (input.length === 0) {
          continue;
        }

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

        for (const scan of syncBatchScans) {
          const result = resultMap.get(scan.id);
          if (result?.ok && result.remote_id) {
            syncUpdates.push({
              id: scan.id,
              remoteId: result.remote_id,
              syncedWithoutImage: false,
            });
          } else {
            failedCount += 1;
            const reason =
              result?.errors && result.errors.length > 0
                ? result.errors.join(", ")
                : "Reponse manquante.";
            errorDetails.push(`${scan.codeArticle}: ${reason}`);
          }
        }
      }

      if (syncUpdates.length > 0) {
        await markInventoryScansSynced(syncUpdates);
      }

      if (errorDetails.length > 0) {
        const sample = errorDetails.slice(0, 3).join(" | ");
        const suffix =
          errorDetails.length > 3
            ? ` (+${errorDetails.length - 3} autres)`
            : "";
        setScanSyncError(`Echecs de sync: ${sample}${suffix}`);
      }

      const syncedCount = syncUpdates.length;
      return {
        totalCount: pendingScans.length,
        syncedCount,
        failedCount,
        errors: errorDetails.length > 0 ? errorDetails : undefined,
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
      syncScanImageById,
      syncScanById,
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
      syncScanImageById,
      syncScanById,
      syncScans,
    ]
  );

  return (
    <InventoryOfflineContext.Provider value={contextValue}>
      {children}
    </InventoryOfflineContext.Provider>
  );
}
