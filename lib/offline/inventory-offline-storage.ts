import {
  getStoredJson,
  setStoredJson,
} from "@/lib/auth/auth-storage";
import type {
  CampagneInventaire,
  GroupeComptage,
  Location,
  OfflineArticleEntry,
} from "@/lib/graphql/inventory-operations";

/** Offline cache payload stored for the inventory module. */
export type InventoryOfflineCache = {
  /** Cached inventory campaigns. */
  campaigns: CampagneInventaire[];
  /** Cached comptage groups. */
  groups: GroupeComptage[];
  /** Cached locations with parent relations. */
  locations: Location[];
  /** Cached articles with linked locations. */
  articles: OfflineArticleEntry[];
};

/** Offline cache metadata for inventory data. */
export type InventoryOfflineMetadata = {
  /** ISO timestamp of the last full offline sync. */
  lastSyncAt: string | null;
};

/** Storage keys for offline inventory cache data. */
const INVENTORY_OFFLINE_KEYS = {
  campaigns: "inventory.offline.campaigns",
  groups: "inventory.offline.groups",
  locations: "inventory.offline.locations",
  articles: "inventory.offline.articles",
  metadata: "inventory.offline.metadata",
} as const;

/** Default empty cache payload for offline inventory data. */
const DEFAULT_CACHE: InventoryOfflineCache = {
  campaigns: [],
  groups: [],
  locations: [],
  articles: [],
};

/** Default metadata for offline inventory cache. */
const DEFAULT_METADATA: InventoryOfflineMetadata = {
  lastSyncAt: null,
};

/**
 * Load cached inventory datasets from storage.
 */
export async function loadInventoryOfflineCache(): Promise<InventoryOfflineCache> {
  const [campaigns, groups, locations, articles] = await Promise.all([
    getStoredJson<CampagneInventaire[]>(INVENTORY_OFFLINE_KEYS.campaigns),
    getStoredJson<GroupeComptage[]>(INVENTORY_OFFLINE_KEYS.groups),
    getStoredJson<Location[]>(INVENTORY_OFFLINE_KEYS.locations),
    getStoredJson<OfflineArticleEntry[]>(INVENTORY_OFFLINE_KEYS.articles),
  ]);

  return {
    campaigns: campaigns ?? DEFAULT_CACHE.campaigns,
    groups: groups ?? DEFAULT_CACHE.groups,
    locations: locations ?? DEFAULT_CACHE.locations,
    articles: articles ?? DEFAULT_CACHE.articles,
  };
}

/**
 * Load offline inventory metadata from storage.
 */
export async function loadInventoryOfflineMetadata(): Promise<InventoryOfflineMetadata> {
  const metadata = await getStoredJson<InventoryOfflineMetadata>(
    INVENTORY_OFFLINE_KEYS.metadata
  );

  return metadata ?? DEFAULT_METADATA;
}

/**
 * Persist the full offline cache payload to storage.
 */
export async function saveInventoryOfflineCache(
  cache: InventoryOfflineCache
): Promise<void> {
  await Promise.all([
    setStoredJson(INVENTORY_OFFLINE_KEYS.campaigns, cache.campaigns),
    setStoredJson(INVENTORY_OFFLINE_KEYS.groups, cache.groups),
    setStoredJson(INVENTORY_OFFLINE_KEYS.locations, cache.locations),
    setStoredJson(INVENTORY_OFFLINE_KEYS.articles, cache.articles),
  ]);
}

/**
 * Persist offline metadata to storage.
 */
export async function saveInventoryOfflineMetadata(
  metadata: InventoryOfflineMetadata
): Promise<void> {
  await setStoredJson(INVENTORY_OFFLINE_KEYS.metadata, metadata);
}
