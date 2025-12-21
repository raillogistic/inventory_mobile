import type {
  CampagneInventaire,
  GroupeComptage,
  GroupeComptageCampagne,
  ComptageUser,
  Location,
  LocationParent,
  OfflineArticleEntry,
  OfflineArticleLocation,
} from "@/lib/graphql/inventory-operations";
import {
  ensureInventoryDatabase,
  getInventorySqlRows,
  runInventorySql,
  runInventorySqlBatch,
  type InventorySqlStatement,
} from "@/lib/offline/inventory-sqlite";

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

/** Metadata keys stored in SQLite. */
const INVENTORY_METADATA_KEYS = {
  lastSyncAt: "last_sync_at",
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

/** SQLite row for inventory campaigns. */
type InventoryCampaignRow = {
  /** Campaign identifier. */
  id: string;
  /** Campaign functional code. */
  code_campagne: string;
  /** Campaign display name. */
  nom: string;
  /** Optional start date. */
  date_debut: string | null;
  /** Optional end date. */
  date_fin: string | null;
};

/** SQLite row for inventory locations. */
type InventoryLocationRow = {
  /** Location identifier. */
  id: string;
  /** Location display name. */
  locationname: string;
  /** Optional location description. */
  desc: string | null;
  /** Optional barcode value. */
  barcode: string | null;
  /** Optional parent location id. */
  parent_id: string | null;
  /** Optional parent location name snapshot. */
  parent_locationname: string | null;
};

/** SQLite row for inventory groups. */
type InventoryGroupRow = {
  /** Group identifier. */
  id: string;
  /** Group display name. */
  nom: string;
  /** Device identifier bound to the group. */
  appareil_identifiant: string;
  /** PIN required to validate selection. */
  pin_code: string;
  /** Group role string. */
  role: string;
  /** User identifier assigned to the group. */
  utilisateur_id: string;
  /** Username assigned to the group. */
  utilisateur_username: string;
  /** Campaign identifier assigned to the group. */
  campagne_id: string;
  /** Optional campaign name snapshot. */
  campagne_nom: string | null;
};

/** SQLite row for group authorized location ids. */
type InventoryGroupLocationRow = {
  /** Group identifier. */
  group_id: string;
  /** Location identifier. */
  location_id: string;
};

/** SQLite row for inventory articles. */
type InventoryArticleRow = {
  /** Article identifier. */
  id: string;
  /** Article code. */
  code: string;
  /** Optional article description. */
  desc: string | null;
};

/** SQLite row for article location links. */
type InventoryArticleLocationRow = {
  /** Article identifier. */
  article_id: string;
  /** Location identifier. */
  location_id: string;
  /** Location display name snapshot. */
  locationname: string;
};

/** SQLite row for metadata key/value entries. */
type InventoryMetadataRow = {
  /** Metadata key. */
  key: string;
  /** Metadata value. */
  value: string | null;
};

/** Minimal location entry used for quick lookups. */
type InventoryLocationLookup = {
  /** Location identifier. */
  id: string;
  /** Location display name. */
  locationname: string;
};

/** Result of loading locations with lookup maps. */
type InventoryLocationLoadResult = {
  /** Fully mapped location list. */
  locations: Location[];
  /** Location map keyed by id. */
  locationMap: Map<string, Location>;
  /** Minimal lookup map keyed by id. */
  locationLookup: Map<string, InventoryLocationLookup>;
};

/**
 * Build a lookup of location ids to display labels.
 */
function buildLocationLookup(
  rows: InventoryLocationRow[]
): Map<string, InventoryLocationLookup> {
  const map = new Map<string, InventoryLocationLookup>();

  for (const row of rows) {
    map.set(row.id, { id: row.id, locationname: row.locationname });
  }

  return map;
}

/**
 * Build a parent location summary for a row.
 */
function buildParentLocation(
  row: InventoryLocationRow,
  lookup: Map<string, InventoryLocationLookup>
): LocationParent | null {
  if (!row.parent_id) {
    return null;
  }

  const fallbackLabel = lookup.get(row.parent_id)?.locationname ?? "Lieu inconnu";

  return {
    id: row.parent_id,
    locationname: row.parent_locationname ?? fallbackLabel,
  };
}

/**
 * Map a location row into the app location shape.
 */
function mapLocationRow(
  row: InventoryLocationRow,
  lookup: Map<string, InventoryLocationLookup>
): Location {
  return {
    id: row.id,
    locationname: row.locationname,
    desc: row.desc ?? null,
    barcode: row.barcode ?? null,
    parent: buildParentLocation(row, lookup),
  };
}

/**
 * Build a fallback location entry when cached details are missing.
 */
function buildFallbackLocation(id: string, name: string): Location {
  return {
    id,
    locationname: name,
    desc: null,
    barcode: null,
    parent: null,
  };
}

/**
 * Load raw location rows from SQLite.
 */
async function loadLocationRows(): Promise<InventoryLocationRow[]> {
  await ensureInventoryDatabase();
  const result = await runInventorySql(
    "SELECT id, locationname, desc, barcode, parent_id, parent_locationname FROM inventory_locations ORDER BY locationname"
  );
  return getInventorySqlRows<InventoryLocationRow>(result);
}

/**
 * Load locations and build lookup maps.
 */
async function loadLocationsWithMaps(): Promise<InventoryLocationLoadResult> {
  const rows = await loadLocationRows();
  const lookup = buildLocationLookup(rows);
  const locations = rows.map((row) => mapLocationRow(row, lookup));
  const locationMap = new Map<string, Location>(
    locations.map((location) => [location.id, location])
  );

  return { locations, locationMap, locationLookup: lookup };
}

/**
 * Load cached campaign list from SQLite.
 */
export async function loadInventoryCampaigns(): Promise<CampagneInventaire[]> {
  await ensureInventoryDatabase();
  const result = await runInventorySql(
    "SELECT id, code_campagne, nom, date_debut, date_fin FROM inventory_campaigns ORDER BY nom"
  );
  return getInventorySqlRows<InventoryCampaignRow>(result).map((row) => ({
    id: row.id,
    code_campagne: row.code_campagne,
    nom: row.nom,
    date_debut: row.date_debut ?? null,
    date_fin: row.date_fin ?? null,
  }));
}

/**
 * Load cached location list from SQLite.
 */
export async function loadInventoryLocations(): Promise<Location[]> {
  const { locations } = await loadLocationsWithMaps();
  return locations;
}

/**
 * Load cached group list from SQLite.
 */
async function loadInventoryGroupsWithMaps(
  locationMap: Map<string, Location>,
  locationLookup: Map<string, InventoryLocationLookup>
): Promise<GroupeComptage[]> {
  await ensureInventoryDatabase();

  const [groupResult, groupLocationResult] = await Promise.all([
    runInventorySql(
      "SELECT id, nom, appareil_identifiant, pin_code, role, utilisateur_id, utilisateur_username, campagne_id, campagne_nom FROM inventory_groups ORDER BY nom"
    ),
    runInventorySql(
      "SELECT group_id, location_id FROM inventory_group_locations"
    ),
  ]);

  const groupRows = getInventorySqlRows<InventoryGroupRow>(groupResult);
  const groupLocationRows =
    getInventorySqlRows<InventoryGroupLocationRow>(groupLocationResult);

  const locationsByGroup = new Map<string, string[]>();
  for (const row of groupLocationRows) {
    const existing = locationsByGroup.get(row.group_id) ?? [];
    existing.push(row.location_id);
    locationsByGroup.set(row.group_id, existing);
  }

  return groupRows.map((row) => {
    const groupLocations = locationsByGroup.get(row.id) ?? [];
    const lieux_autorises = groupLocations.map((locationId) => {
      const location =
        locationMap.get(locationId) ??
        buildFallbackLocation(
          locationId,
          locationLookup.get(locationId)?.locationname ?? "Lieu inconnu"
        );
      return location;
    });

    const campagne: GroupeComptageCampagne = {
      id: row.campagne_id,
      nom: row.campagne_nom ?? null,
    };
    const utilisateur: ComptageUser = {
      id: row.utilisateur_id,
      username: row.utilisateur_username,
    };

    return {
      id: row.id,
      nom: row.nom,
      appareil_identifiant: row.appareil_identifiant,
      pin_code: row.pin_code,
      role: row.role,
      lieux_autorises,
      utilisateur,
      campagne,
    };
  });
}

/**
 * Load cached group list from SQLite.
 */
export async function loadInventoryGroups(): Promise<GroupeComptage[]> {
  const { locationMap, locationLookup } = await loadLocationsWithMaps();
  return loadInventoryGroupsWithMaps(locationMap, locationLookup);
}

/**
 * Load cached article list from SQLite.
 */
async function loadInventoryArticlesWithMaps(
  locationLookup: Map<string, InventoryLocationLookup>
): Promise<OfflineArticleEntry[]> {
  await ensureInventoryDatabase();

  const [articleResult, articleLocationResult] = await Promise.all([
    runInventorySql("SELECT id, code, desc FROM inventory_articles ORDER BY code"),
    runInventorySql(
      "SELECT article_id, location_id, locationname FROM inventory_article_locations"
    ),
  ]);

  const articleRows = getInventorySqlRows<InventoryArticleRow>(articleResult);
  const articleLocationRows =
    getInventorySqlRows<InventoryArticleLocationRow>(articleLocationResult);

  const locationsByArticle = new Map<string, OfflineArticleLocation[]>();
  for (const row of articleLocationRows) {
    const locationLabel =
      row.locationname ??
      locationLookup.get(row.location_id)?.locationname ??
      "Lieu inconnu";
    const entries = locationsByArticle.get(row.article_id) ?? [];
    entries.push({ id: row.location_id, locationname: locationLabel });
    locationsByArticle.set(row.article_id, entries);
  }

  return articleRows.map((row) => ({
    id: row.id,
    code: row.code,
    desc: row.desc ?? null,
    locations: locationsByArticle.get(row.id) ?? [],
  }));
}

/**
 * Load cached article list from SQLite.
 */
export async function loadInventoryArticles(): Promise<OfflineArticleEntry[]> {
  const { locationLookup } = await loadLocationsWithMaps();
  return loadInventoryArticlesWithMaps(locationLookup);
}

/**
 * Load cached inventory datasets from SQLite.
 */
export async function loadInventoryOfflineCache(): Promise<InventoryOfflineCache> {
  const locationsResult = await loadLocationsWithMaps();
  const [campaigns, groups, articles] = await Promise.all([
    loadInventoryCampaigns(),
    loadInventoryGroupsWithMaps(
      locationsResult.locationMap,
      locationsResult.locationLookup
    ),
    loadInventoryArticlesWithMaps(locationsResult.locationLookup),
  ]);

  return {
    campaigns: campaigns ?? DEFAULT_CACHE.campaigns,
    groups: groups ?? DEFAULT_CACHE.groups,
    locations: locationsResult.locations ?? DEFAULT_CACHE.locations,
    articles: articles ?? DEFAULT_CACHE.articles,
  };
}

/**
 * Load offline inventory metadata from SQLite.
 */
export async function loadInventoryOfflineMetadata(): Promise<InventoryOfflineMetadata> {
  await ensureInventoryDatabase();
  const result = await runInventorySql(
    "SELECT key, value FROM inventory_metadata WHERE key = ?",
    [INVENTORY_METADATA_KEYS.lastSyncAt]
  );
  const row = getInventorySqlRows<InventoryMetadataRow>(result)[0] ?? null;

  return {
    lastSyncAt: row?.value ?? DEFAULT_METADATA.lastSyncAt,
  };
}

/**
 * Persist the full offline cache payload to SQLite.
 */
export async function saveInventoryOfflineCache(
  cache: InventoryOfflineCache
): Promise<void> {
  await ensureInventoryDatabase();

  const statements: InventorySqlStatement[] = [
    { sql: "DELETE FROM inventory_group_locations" },
    { sql: "DELETE FROM inventory_article_locations" },
    { sql: "DELETE FROM inventory_groups" },
    { sql: "DELETE FROM inventory_articles" },
    { sql: "DELETE FROM inventory_locations" },
    { sql: "DELETE FROM inventory_campaigns" },
  ];

  for (const campaign of cache.campaigns) {
    statements.push({
      sql:
        "INSERT OR REPLACE INTO inventory_campaigns " +
        "(id, code_campagne, nom, date_debut, date_fin) " +
        "VALUES (?, ?, ?, ?, ?)",
      params: [
        campaign.id,
        campaign.code_campagne,
        campaign.nom,
        campaign.date_debut,
        campaign.date_fin,
      ],
    });
  }

  for (const location of cache.locations) {
    statements.push({
      sql:
        "INSERT OR REPLACE INTO inventory_locations " +
        "(id, locationname, desc, barcode, parent_id, parent_locationname) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
      params: [
        location.id,
        location.locationname,
        location.desc ?? null,
        location.barcode ?? null,
        location.parent?.id ?? null,
        location.parent?.locationname ?? null,
      ],
    });
  }

  for (const group of cache.groups) {
    statements.push({
      sql:
        "INSERT OR REPLACE INTO inventory_groups " +
        "(id, nom, appareil_identifiant, pin_code, role, utilisateur_id, utilisateur_username, campagne_id, campagne_nom) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [
        group.id,
        group.nom,
        group.appareil_identifiant,
        group.pin_code,
        group.role,
        group.utilisateur.id,
        group.utilisateur.username,
        group.campagne.id,
        group.campagne.nom,
      ],
    });

    for (const location of group.lieux_autorises ?? []) {
      statements.push({
        sql:
          "INSERT OR REPLACE INTO inventory_group_locations " +
          "(group_id, location_id) VALUES (?, ?)",
        params: [group.id, location.id],
      });
    }
  }

  for (const article of cache.articles) {
    statements.push({
      sql:
        "INSERT OR REPLACE INTO inventory_articles " +
        "(id, code, desc) VALUES (?, ?, ?)",
      params: [article.id, article.code, article.desc ?? null],
    });

    for (const location of article.locations ?? []) {
      statements.push({
        sql:
          "INSERT OR REPLACE INTO inventory_article_locations " +
          "(article_id, location_id, locationname) VALUES (?, ?, ?)",
        params: [article.id, location.id, location.locationname],
      });
    }
  }

  await runInventorySqlBatch(statements);
}

/**
 * Persist offline metadata to SQLite.
 */
export async function saveInventoryOfflineMetadata(
  metadata: InventoryOfflineMetadata
): Promise<void> {
  await ensureInventoryDatabase();
  const statements: InventorySqlStatement[] = [
    {
      sql:
        "INSERT OR REPLACE INTO inventory_metadata (key, value) VALUES (?, ?)",
      params: [INVENTORY_METADATA_KEYS.lastSyncAt, metadata.lastSyncAt],
    },
  ];

  await runInventorySqlBatch(statements);
}
