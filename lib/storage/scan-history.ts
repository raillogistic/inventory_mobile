import AsyncStorage from "@react-native-async-storage/async-storage";

/** Storage key for persisted scan history. */
const SCAN_HISTORY_KEY = "inventory_scan_history";
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
};

/**
 * Read the stored scan history list.
 */
export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  const rawValue = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as ScanHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Append a scan history item and persist the list.
 */
export async function addScanHistoryItem(
  item: ScanHistoryItem
): Promise<void> {
  const existing = await getScanHistory();
  const updated = [item, ...existing].slice(0, SCAN_HISTORY_LIMIT);
  await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
}
