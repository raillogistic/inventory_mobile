import {
  ensureInventoryDatabase,
  getInventorySqlRows,
  runInventorySql,
} from "@/lib/offline/inventory-sqlite";

/** Maximum number of stored history items. */
const SCAN_HISTORY_LIMIT = 200;

/** Persisted scan history item. */
export type ScanHistoryItem = {
  /** Unique identifier for the history item. */
  id: string;
  /** Scanned article code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Optional captured image URI. */
  imageUri: string | null;
  /** Visual status associated with the scan. */
  status: "scanned" | "missing" | "other" | "pending";
  /** Human-readable status label. */
  statusLabel: string;
  /** Capture timestamp as ISO string. */
  capturedAt: string;
  /** Location identifier where the scan occurred. */
  locationId: string | null;
  /** Location label displayed in the history. */
  locationName: string;
  /** Etat selectionne lors du scan, si applicable. */
  etat: "BIEN" | "MOYENNE" | "HORS_SERVICE" | null;
  /** Optional observation captured during the scan. */
  observation: string | null;
  /** Optional serial number captured during the scan. */
  serialNumber: string | null;
};

/** SQLite row representation for scan history items. */
type ScanHistoryRow = {
  /** Unique identifier for the history item. */
  id: string;
  /** Scanned article code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Optional captured image URI. */
  image_uri: string | null;
  /** Visual status associated with the scan. */
  status: "scanned" | "missing" | "other" | "pending";
  /** Human-readable status label. */
  status_label: string;
  /** Capture timestamp as ISO string. */
  captured_at: string;
  /** Location identifier where the scan occurred. */
  location_id: string | null;
  /** Location label displayed in the history. */
  location_name: string;
  /** Etat selectionne lors du scan, si applicable. */
  etat: "BIEN" | "MOYENNE" | "HORS_SERVICE" | null;
  /** Optional observation captured during the scan. */
  observation: string | null;
  /** Optional serial number captured during the scan. */
  serial_number: string | null;
};

/**
 * Map a SQLite row into a scan history item.
 */
function mapHistoryRow(row: ScanHistoryRow): ScanHistoryItem {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? null,
    imageUri: row.image_uri ?? null,
    status: row.status,
    statusLabel: row.status_label,
    capturedAt: row.captured_at,
    locationId: row.location_id ?? null,
    locationName: row.location_name,
    etat: row.etat ?? null,
    observation: row.observation ?? null,
    serialNumber: row.serial_number ?? null,
  };
}

/**
 * Read the stored scan history list.
 */
export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  await ensureInventoryDatabase();
  const result = await runInventorySql<ScanHistoryRow>(
    "SELECT id, code, description, image_uri, status, status_label, captured_at, " +
      "location_id, location_name, etat, observation, serial_number " +
      "FROM inventory_scan_history ORDER BY captured_at DESC LIMIT ?",
    [SCAN_HISTORY_LIMIT]
  );
  return getInventorySqlRows(result).map(mapHistoryRow);
}

/**
 * Append a scan history item and persist the list.
 */
export async function addScanHistoryItem(
  item: ScanHistoryItem
): Promise<void> {
  await ensureInventoryDatabase();
  await runInventorySql(
    "INSERT OR REPLACE INTO inventory_scan_history " +
      "(id, code, description, image_uri, status, status_label, captured_at, " +
      "location_id, location_name, etat, observation, serial_number) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      item.id,
      item.code,
      item.description ?? null,
      item.imageUri ?? null,
      item.status,
      item.statusLabel,
      item.capturedAt,
      item.locationId ?? null,
      item.locationName,
      item.etat ?? null,
      item.observation ?? null,
      item.serialNumber ?? null,
    ]
  );
}
