import type { EnregistrementInventaireEtat } from "@/lib/graphql/inventory-operations";
import {
  ensureInventoryDatabase,
  getInventorySqlRows,
  runInventorySql,
  runInventorySqlBatch,
  type InventorySqlValue,
} from "@/lib/offline/inventory-sqlite";

/** Status values captured for a scan record. */
export type InventoryScanStatus = "scanned" | "other" | "missing";

/** Scan record stored locally in SQLite. */
export type InventoryScanRecord = {
  /** Local unique identifier for the scan. */
  id: string;
  /** Backend identifier once the record is synced. */
  remoteId: string | null;
  /** Campaign identifier associated with the scan. */
  campaignId: string;
  /** Group identifier associated with the scan. */
  groupId: string;
  /** Location identifier associated with the scan. */
  locationId: string;
  /** Location label captured at scan time. */
  locationName: string;
  /** Scanned article code. */
  codeArticle: string;
  /** Optional article identifier when the code matches the catalog. */
  articleId: string | null;
  /** Optional article description snapshot. */
  articleDescription: string | null;
  /** Optional observation attached to the scan. */
  observation: string | null;
  /** Optional serial number captured during scan. */
  serialNumber: string | null;
  /** Optional material state for the scan. */
  etat: EnregistrementInventaireEtat | null;
  /** Capture timestamp as ISO string. */
  capturedAt: string;
  /** Origin of the scan (camera/manual). */
  sourceScan: string | null;
  /** Optional image URI captured at scan time. */
  imageUri: string | null;
  /** Status derived for the scan. */
  status: InventoryScanStatus;
  /** Human-readable status label. */
  statusLabel: string;
  /** Whether the record has been synced to the backend. */
  isSynced: boolean;
  /** Last update timestamp for the record. */
  updatedAt: string;
};

/** Filters used to query scan records. */
export type InventoryScanFilter = {
  /** Optional campaign id filter. */
  campaignId?: string | null;
  /** Optional group id filter. */
  groupId?: string | null;
  /** Optional location id filter. */
  locationId?: string | null;
  /** Optional sync status filter. */
  isSynced?: boolean | null;
  /** Optional maximum number of records to return. */
  limit?: number | null;
};

/** Input payload for creating a scan record. */
export type InventoryScanCreateInput = {
  /** Campaign identifier. */
  campaignId: string;
  /** Group identifier. */
  groupId: string;
  /** Location identifier. */
  locationId: string;
  /** Location label for display. */
  locationName: string;
  /** Scanned article code. */
  codeArticle: string;
  /** Optional article identifier. */
  articleId?: string | null;
  /** Optional article description snapshot. */
  articleDescription?: string | null;
  /** Capture timestamp (ISO). */
  capturedAt?: string | null;
  /** Scan origin. */
  sourceScan?: string | null;
  /** Optional captured image URI. */
  imageUri?: string | null;
  /** Status derived for the scan. */
  status: InventoryScanStatus;
  /** Human-readable status label. */
  statusLabel: string;
};

/** Payload for updating scan details locally. */
export type InventoryScanUpdateInput = {
  /** Scan record identifier. */
  id: string;
  /** Optional material state. */
  etat?: EnregistrementInventaireEtat | null;
  /** Optional observation update. */
  observation?: string | null;
  /** Optional serial number update. */
  serialNumber?: string | null;
};

/** Input payload used to mark scans as synced. */
export type InventoryScanSyncUpdateInput = {
  /** Local scan identifier. */
  id: string;
  /** Remote identifier returned by the backend. */
  remoteId: string | null;
};

/** SQLite row representation for scan records. */
type InventoryScanRow = {
  /** Local scan identifier. */
  id: string;
  /** Backend id when synced. */
  remote_id: string | null;
  /** Campaign identifier. */
  campagne_id: string;
  /** Group identifier. */
  groupe_id: string;
  /** Location identifier. */
  lieu_id: string;
  /** Location label snapshot. */
  lieu_name: string;
  /** Scanned article code. */
  code_article: string;
  /** Article identifier. */
  article_id: string | null;
  /** Article description snapshot. */
  article_desc: string | null;
  /** Observation text. */
  observation: string | null;
  /** Serial number text. */
  serial_number: string | null;
  /** Etat value. */
  etat: EnregistrementInventaireEtat | null;
  /** Capture timestamp. */
  capture_le: string;
  /** Scan origin. */
  source_scan: string | null;
  /** Optional image URI. */
  image_uri: string | null;
  /** Status value. */
  status: InventoryScanStatus;
  /** Status label text. */
  status_label: string;
  /** Sync flag stored as integer. */
  is_synced: number;
  /** Updated timestamp. */
  updated_at: string;
};

/**
 * Build a unique local identifier for a scan.
 */
function buildInventoryScanId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${timePart}-${randomPart}`;
}

/**
 * Map a SQLite row into an inventory scan record.
 */
function mapInventoryScanRow(row: InventoryScanRow): InventoryScanRecord {
  return {
    id: row.id,
    remoteId: row.remote_id ?? null,
    campaignId: row.campagne_id,
    groupId: row.groupe_id,
    locationId: row.lieu_id,
    locationName: row.lieu_name,
    codeArticle: row.code_article,
    articleId: row.article_id ?? null,
    articleDescription: row.article_desc ?? null,
    observation: row.observation ?? null,
    serialNumber: row.serial_number ?? null,
    etat: row.etat ?? null,
    capturedAt: row.capture_le,
    sourceScan: row.source_scan ?? null,
    imageUri: row.image_uri ?? null,
    status: row.status,
    statusLabel: row.status_label,
    isSynced: row.is_synced === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Build SQL filters and parameters for scan queries.
 */
function buildScanFilters(
  filter: InventoryScanFilter
): { whereClause: string; params: InventorySqlValue[] } {
  const conditions: string[] = [];
  const params: InventorySqlValue[] = [];

  if (filter.campaignId) {
    conditions.push("campagne_id = ?");
    params.push(filter.campaignId);
  }

  if (filter.groupId) {
    conditions.push("groupe_id = ?");
    params.push(filter.groupId);
  }

  if (filter.locationId) {
    conditions.push("lieu_id = ?");
    params.push(filter.locationId);
  }

  if (typeof filter.isSynced === "boolean") {
    conditions.push("is_synced = ?");
    params.push(filter.isSynced ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereClause, params };
}

/**
 * Load scan records matching the provided filters.
 */
export async function loadInventoryScans(
  filter: InventoryScanFilter
): Promise<InventoryScanRecord[]> {
  await ensureInventoryDatabase();
  const { whereClause, params } = buildScanFilters(filter);
  const limitClause = filter.limit ? "LIMIT ?" : "";
  const sql =
    "SELECT id, remote_id, campagne_id, groupe_id, lieu_id, lieu_name, code_article, " +
    "article_id, article_desc, observation, serial_number, etat, capture_le, source_scan, " +
    "image_uri, status, status_label, is_synced, updated_at " +
    `FROM inventory_scans ${whereClause} ` +
    "ORDER BY capture_le DESC " +
    `${limitClause}`;

  const result = await runInventorySql<InventoryScanRow>(
    sql,
    filter.limit ? [...params, filter.limit] : params
  );

  return getInventorySqlRows(result).map(mapInventoryScanRow);
}

/**
 * Create a new scan record in SQLite.
 */
export async function createInventoryScan(
  input: InventoryScanCreateInput
): Promise<InventoryScanRecord> {
  await ensureInventoryDatabase();
  const now = new Date().toISOString();
  const capturedAt = input.capturedAt ?? now;
  const record: InventoryScanRecord = {
    id: buildInventoryScanId(),
    remoteId: null,
    campaignId: input.campaignId,
    groupId: input.groupId,
    locationId: input.locationId,
    locationName: input.locationName,
    codeArticle: input.codeArticle,
    articleId: input.articleId ?? null,
    articleDescription: input.articleDescription ?? null,
    observation: null,
    serialNumber: null,
    etat: null,
    capturedAt,
    sourceScan: input.sourceScan ?? null,
    imageUri: input.imageUri ?? null,
    status: input.status,
    statusLabel: input.statusLabel,
    isSynced: false,
    updatedAt: now,
  };

  await runInventorySql(
    "INSERT INTO inventory_scans " +
      "(id, remote_id, code_article, article_id, article_desc, campagne_id, groupe_id, lieu_id, lieu_name, " +
      "observation, serial_number, etat, capture_le, source_scan, image_uri, status, status_label, is_synced, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      record.id,
      record.remoteId,
      record.codeArticle,
      record.articleId,
      record.articleDescription,
      record.campaignId,
      record.groupId,
      record.locationId,
      record.locationName,
      record.observation,
      record.serialNumber,
      record.etat,
      record.capturedAt,
      record.sourceScan,
      record.imageUri,
      record.status,
      record.statusLabel,
      record.isSynced ? 1 : 0,
      record.updatedAt,
    ]
  );

  return record;
}

/**
 * Update scan detail fields in SQLite.
 */
export async function updateInventoryScanDetails(
  input: InventoryScanUpdateInput
): Promise<void> {
  await ensureInventoryDatabase();
  const now = new Date().toISOString();

  await runInventorySql(
    "UPDATE inventory_scans SET etat = ?, observation = ?, serial_number = ?, is_synced = 0, updated_at = ? WHERE id = ?",
    [
      input.etat ?? null,
      input.observation ?? null,
      input.serialNumber ?? null,
      now,
      input.id,
    ]
  );
}

/**
 * Mark scan records as synced after a successful upload.
 */
export async function markInventoryScansSynced(
  updates: InventoryScanSyncUpdateInput[]
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  await ensureInventoryDatabase();
  const now = new Date().toISOString();

  await runInventorySqlBatch(
    updates.map((update) => ({
      sql:
        "UPDATE inventory_scans SET remote_id = ?, is_synced = 1, updated_at = ? WHERE id = ?",
      params: [update.remoteId, now, update.id],
    }))
  );
}
