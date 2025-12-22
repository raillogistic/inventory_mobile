import { useCallback, useEffect, useMemo, useState } from "react";

import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import {
  type EnregistrementInventaireListVariables,
  type EnregistrementInventaireEtat,
  type OfflineArticleEntry,
} from "@/lib/graphql/inventory-operations";
import {
  loadInventoryScans,
  type InventoryScanRecord,
} from "@/lib/offline/inventory-scan-storage";

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
 * Transform local scan records into recap-ready records.
 */
function mapScans(scans: InventoryScanRecord[]): RecapScanItem[] {
  return scans.map((scan) => ({
    id: scan.id,
    code: scan.codeArticle,
    description: scan.articleDescription ?? null,
    etat: scan.etat ?? null,
    capturedAt: scan.capturedAt ?? null,
    locationId: scan.locationId,
    locationName: scan.locationName,
  }));
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
  const [scans, setScans] = useState<InventoryScanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recapScans = useMemo(() => mapScans(scans), [scans]);
  const scansByLocation = useMemo(
    () => groupScansByLocation(recapScans),
    [recapScans]
  );
  const scannedCodeSet = useMemo(() => {
    const set = new Set<NormalizedCode>();
    for (const scan of recapScans) {
      const normalized = normalizeCode(scan.code);
      if (normalized) {
        set.add(normalized);
      }
    }
    return set;
  }, [recapScans]);
  const articleLookup = useMemo(
    () => buildArticleLookup(cache.articles),
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
    for (const article of cache.articles) {
      const normalized = normalizeCode(article.code);
      if (!normalized || scannedCodeSet.has(normalized)) {
        continue;
      }

      const fallbackLocation = article.locations[0] ?? null;
      const locationId =
        article.currentLocation?.id ?? fallbackLocation?.id ?? "unknown";
      const locationName =
        article.currentLocation?.locationname ??
        fallbackLocation?.locationname ??
        "Lieu inconnu";

      items.push({
        code: article.code,
        description: article.desc ?? null,
        locationId,
        locationName,
      });
    }

    return items;
  }, [cache.articles, isHydrated, scannedCodeSet]);

  const refresh = useCallback(async () => {
    if (skip) {
      setScans([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const records = await loadInventoryScans({
        campaignId,
        groupId,
        limit: variables.limit ?? RECAP_SCAN_LIMIT,
      });
      setScans(records);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de charger le recap.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [campaignId, groupId, skip, variables.limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
