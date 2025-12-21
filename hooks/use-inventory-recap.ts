import { useCallback, useMemo } from "react";

import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import {
  type EnregistrementInventaireListItem,
  type EnregistrementInventaireListVariables,
  type EnregistrementInventaireEtat,
  type OfflineArticleEntry,
} from "@/lib/graphql/inventory-operations";
import { useEnregistrementInventaireList } from "@/lib/graphql/inventory-hooks";

/** Max number of scans to load for recap aggregation. */
const RECAP_SCAN_LIMIT = 5000;

/** Normalized scan code used for comparisons. */
type NormalizedCode = string;

/** Recap scan item normalized for aggregation. */
export type RecapScanItem = {
  /** Scan id from the backend. */
  id: string;
  /** Raw scanned code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Optional material state. */
  etat: EnregistrementInventaireEtat | null;
  /** Capture timestamp. */
  capturedAt: string | null;
  /** Location identifier. */
  locationId: string;
  /** Location label. */
  locationName: string;
};

/** Scans grouped by a single location. */
export type RecapLocationGroup = {
  /** Location identifier. */
  locationId: string;
  /** Location label. */
  locationName: string;
  /** Scans associated with this location. */
  scans: RecapScanItem[];
};

/** Scan that is not expected in the scanned location. */
export type EcartPositiveItem = {
  /** Scanned code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Location identifier where it was scanned. */
  locationId: string;
  /** Location label where it was scanned. */
  locationName: string;
  /** Known expected location labels for the article. */
  expectedLocations: string[];
};

/** Expected article missing from scans. */
export type EcartNegativeItem = {
  /** Expected article code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Location identifier where the article is expected. */
  locationId: string;
  /** Location label where the article is expected. */
  locationName: string;
};

/** Scanned code without a matching article. */
export type MissingArticleItem = {
  /** Scanned code. */
  code: string;
  /** Location identifier where it was scanned. */
  locationId: string;
  /** Location label where it was scanned. */
  locationName: string;
  /** Capture timestamp. */
  capturedAt: string | null;
};

/** Aggregated recap payload for the inventory group. */
export type InventoryRecapData = {
  /** Scans grouped by location. */
  scansByLocation: RecapLocationGroup[];
  /** Positive variances (scanned but not expected in location). */
  ecartPositive: EcartPositiveItem[];
  /** Negative variances (expected but not scanned). */
  ecartNegative: EcartNegativeItem[];
  /** Scanned codes without a matching article. */
  missingArticles: MissingArticleItem[];
  /** Whether scan data is still loading. */
  loading: boolean;
  /** Error message if scan loading fails. */
  errorMessage: string | null;
  /** Refetch the recap scan data. */
  refresh: () => Promise<void>;
};

/**
 * Normalize a scan code for comparison.
 */
function normalizeCode(value: string): NormalizedCode {
  return value.trim().toUpperCase();
}

/**
 * Build a lookup table of offline articles by normalized code.
 */
function buildArticleLookup(
  articles: OfflineArticleEntry[]
): Map<NormalizedCode, OfflineArticleEntry> {
  const map = new Map<NormalizedCode, OfflineArticleEntry>();

  for (const article of articles) {
    const normalized = normalizeCode(article.code);
    if (!normalized) {
      continue;
    }
    map.set(normalized, article);
  }

  return map;
}

/**
 * Build a lookup of expected articles per location.
 */
function buildLocationArticleIndex(
  articles: OfflineArticleEntry[]
): Map<string, OfflineArticleEntry[]> {
  const map = new Map<string, OfflineArticleEntry[]>();

  for (const article of articles) {
    for (const location of article.locations) {
      const entries = map.get(location.id) ?? [];
      entries.push(article);
      map.set(location.id, entries);
    }
  }

  return map;
}

/**
 * Transform raw scan items into recap-ready records.
 */
function mapScans(scans: EnregistrementInventaireListItem[]): RecapScanItem[] {
  return scans.map((scan) => ({
    id: scan.id,
    code: scan.code_article,
    description: scan.article?.desc ?? null,
    etat: scan.etat ?? null,
    capturedAt: scan.capture_le ?? null,
    locationId: scan.lieu.id,
    locationName: scan.lieu.locationname,
  }));
}

/**
 * Build unique scan sets per location for variance checks.
 */
function buildScanIndex(scans: RecapScanItem[]): Map<string, Set<NormalizedCode>> {
  const map = new Map<string, Set<NormalizedCode>>();

  for (const scan of scans) {
    const normalized = normalizeCode(scan.code);
    const existing = map.get(scan.locationId) ?? new Set<NormalizedCode>();
    existing.add(normalized);
    map.set(scan.locationId, existing);
  }

  return map;
}

/**
 * Group scans by location for recap display.
 */
function groupScansByLocation(scans: RecapScanItem[]): RecapLocationGroup[] {
  const grouped = new Map<string, RecapLocationGroup>();

  for (const scan of scans) {
    const existing = grouped.get(scan.locationId) ?? {
      locationId: scan.locationId,
      locationName: scan.locationName,
      scans: [],
    };
    existing.scans.push(scan);
    grouped.set(scan.locationId, existing);
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.locationName.localeCompare(b.locationName)
  );
}

/**
 * Build recap data for the selected campaign and group.
 */
export function useInventoryRecap(
  campaignId: string | null,
  groupId: string | null
): InventoryRecapData {
  const variables = useMemo<EnregistrementInventaireListVariables>(
    () => ({
      campagne: campaignId,
      groupe: groupId,
      limit: RECAP_SCAN_LIMIT,
    }),
    [campaignId, groupId]
  );
  const skip = !campaignId || !groupId;
  const { cache, isHydrated } = useInventoryOffline();
  const { scans, loading, errorMessage, refetch } =
    useEnregistrementInventaireList(variables, { skip });

  const recapScans = useMemo(() => mapScans(scans), [scans]);
  const scansByLocation = useMemo(
    () => groupScansByLocation(recapScans),
    [recapScans]
  );
  const scanIndexByLocation = useMemo(
    () => buildScanIndex(recapScans),
    [recapScans]
  );
  const articleLookup = useMemo(
    () => buildArticleLookup(cache.articles),
    [cache.articles]
  );
  const locationArticleIndex = useMemo(
    () => buildLocationArticleIndex(cache.articles),
    [cache.articles]
  );

  const missingArticles = useMemo<MissingArticleItem[]>(() => {
    const items: MissingArticleItem[] = [];

    for (const scan of recapScans) {
      const normalized = normalizeCode(scan.code);
      if (!articleLookup.has(normalized)) {
        items.push({
          code: scan.code,
          locationId: scan.locationId,
          locationName: scan.locationName,
          capturedAt: scan.capturedAt,
        });
      }
    }

    return items;
  }, [articleLookup, recapScans]);

  const ecartPositive = useMemo<EcartPositiveItem[]>(() => {
    const items: EcartPositiveItem[] = [];

    for (const scan of recapScans) {
      const normalized = normalizeCode(scan.code);
      const article = articleLookup.get(normalized);
      if (!article) {
        continue;
      }

      const isExpected = article.locations.some(
        (location) => location.id === scan.locationId
      );
      if (!isExpected) {
        items.push({
          code: scan.code,
          description: article.desc ?? scan.description ?? null,
          locationId: scan.locationId,
          locationName: scan.locationName,
          expectedLocations: article.locations.map(
            (location) => location.locationname
          ),
        });
      }
    }

    return items;
  }, [articleLookup, recapScans]);

  const ecartNegative = useMemo<EcartNegativeItem[]>(() => {
    if (!isHydrated) {
      return [];
    }

    const items: EcartNegativeItem[] = [];

    for (const [locationId, scannedCodes] of scanIndexByLocation.entries()) {
      const expectedArticles = locationArticleIndex.get(locationId) ?? [];
      const locationName =
        recapScans.find((scan) => scan.locationId === locationId)?.locationName ??
        "Lieu inconnu";

      for (const article of expectedArticles) {
        const normalized = normalizeCode(article.code);
        if (!scannedCodes.has(normalized)) {
          items.push({
            code: article.code,
            description: article.desc ?? null,
            locationId,
            locationName,
          });
        }
      }
    }

    return items;
  }, [isHydrated, locationArticleIndex, recapScans, scanIndexByLocation]);

  const refresh = useCallback(async () => {
    if (skip) {
      return;
    }
    await refetch(variables);
  }, [refetch, skip, variables]);

  return {
    scansByLocation,
    ecartPositive,
    ecartNegative,
    missingArticles,
    loading,
    errorMessage,
    refresh,
  };
}
