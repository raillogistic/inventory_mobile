import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { ApolloError, useApolloClient } from "@apollo/client";

import {
  CAMPAGNE_INVENTAIRE_LIST_QUERY,
  GROUPE_COMPTAGE_LIST_QUERY,
  LOCATION_LIST_QUERY,
  OFFLINE_ARTICLE_LIST_QUERY,
  type CampagneInventaireListData,
  type CampagneInventaireListVariables,
  type GroupeComptageListData,
  type GroupeComptageListVariables,
  type LocationListData,
  type LocationListVariables,
  type OfflineArticleEntry,
  type OfflineArticleListData,
  type OfflineArticleLocation,
  type OfflineArticleQueryItem,
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

/** Offline cache limits used during a full sync. */
const OFFLINE_SYNC_LIMITS = {
  campaigns: 500,
  groups: 500,
  locations: 2000,
  articles: 10000,
} as const;

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
  /** Error message captured during the last sync attempt. */
  syncError: string | null;
  /** Trigger a full offline sync of inventory data. */
  syncAll: () => Promise<void>;
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
      locations,
    };
  });
}

/**
 * Provide cached inventory data and a sync action for offline mode.
 */
export function InventoryOfflineProvider({
  children,
}: InventoryOfflineProviderProps) {
  const client = useApolloClient();
  const [cache, setCache] = useState<InventoryOfflineCache>(EMPTY_CACHE);
  const [metadata, setMetadata] = useState<InventoryOfflineMetadata>(EMPTY_METADATA);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
    setIsSyncing(true);
    setSyncError(null);

    try {
      const [
        campaignResult,
        groupResult,
        locationResult,
        articleResult,
      ] = await Promise.all([
        client.query<CampagneInventaireListData, CampagneInventaireListVariables>({
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
        client.query<OfflineArticleListData, { limit: number | null }>({
          query: OFFLINE_ARTICLE_LIST_QUERY,
          variables: { limit: OFFLINE_SYNC_LIMITS.articles },
          fetchPolicy: "network-only",
        }),
      ]);

      const nextCache: InventoryOfflineCache = {
        campaigns: campaignResult.data?.campagneinventaires ?? [],
        groups: groupResult.data?.groupecomptages ?? [],
        locations: locationResult.data?.locations ?? [],
        articles: mapOfflineArticles(articleResult.data?.articles ?? []),
      };

      const nextMetadata: InventoryOfflineMetadata = {
        lastSyncAt: new Date().toISOString(),
      };

      await Promise.all([
        saveInventoryOfflineCache(nextCache),
        saveInventoryOfflineMetadata(nextMetadata),
      ]);

      setCache(nextCache);
      setMetadata(nextMetadata);
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
  }, [client]);

  const contextValue = useMemo<InventoryOfflineContextValue>(
    () => ({
      cache,
      metadata,
      isHydrated,
      isSyncing,
      syncError,
      syncAll,
    }),
    [cache, isHydrated, isSyncing, metadata, syncAll, syncError]
  );

  return (
    <InventoryOfflineContext.Provider value={contextValue}>
      {children}
    </InventoryOfflineContext.Provider>
  );
}
