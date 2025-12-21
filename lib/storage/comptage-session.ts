import { getStoredJson, removeStoredItem, setStoredJson } from "@/lib/auth/auth-storage";
import type {
  CampagneInventaire,
  GroupeComptage,
  Location,
} from "@/lib/graphql/inventory-operations";

/** Snapshot of the comptage session persisted between launches. */
export type ComptageSessionSnapshot = {
  /** Selected inventory campaign. */
  campaign: CampagneInventaire | null;
  /** Selected comptage group. */
  group: GroupeComptage | null;
  /** Selected location. */
  location: Location | null;
};

/** Storage key for the comptage session snapshot. */
const COMPTAGE_SESSION_KEY = "inventory.comptage.session";

/**
 * Load the persisted comptage session snapshot.
 */
export async function loadComptageSession(): Promise<ComptageSessionSnapshot | null> {
  return getStoredJson<ComptageSessionSnapshot>(COMPTAGE_SESSION_KEY);
}

/**
 * Persist the current comptage session snapshot.
 */
export async function saveComptageSession(
  snapshot: ComptageSessionSnapshot
): Promise<void> {
  await setStoredJson(COMPTAGE_SESSION_KEY, snapshot);
}

/**
 * Clear the persisted comptage session snapshot.
 */
export async function clearComptageSession(): Promise<void> {
  await removeStoredItem(COMPTAGE_SESSION_KEY);
}
