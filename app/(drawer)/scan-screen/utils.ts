import * as Location from "expo-location";
import { type BarcodeScanningResult } from "expo-camera";
import { type OfflineArticleEntry } from "@/lib/graphql/inventory-operations";
import {
  type ScanCoordinates,
  type LocationArticleStatus,
  type ScanFrameLayout,
} from "./types";

/**
 * Format a timestamp for display in French locale.
 */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/**
 * Build a unique code for manual entries without barcodes.
 */
export function buildManualCode(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MANUEL-${timePart}-${randomPart}`;
}

/**
 * Normalize scan codes for comparison.
 */
export function normalizeScanCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Build a lookup table for offline articles keyed by normalized code.
 */
export function buildOfflineArticleLookup(
  articles: OfflineArticleEntry[]
): Map<string, OfflineArticleEntry> {
  const map = new Map<string, OfflineArticleEntry>();

  for (const article of articles) {
    const normalized = normalizeScanCode(article.code);
    if (!normalized) {
      continue;
    }
    map.set(normalized, article);
  }

  return map;
}

/**
 * Format device coordinates into a scan-friendly payload.
 */
export function formatScanCoordinates(
  coords: Location.LocationObjectCoords
): ScanCoordinates {
  return {
    latitude: Number.isFinite(coords.latitude)
      ? coords.latitude.toString()
      : null,
    longitude: Number.isFinite(coords.longitude)
      ? coords.longitude.toString()
      : null,
  };
}

/**
 * Resolve GPS coordinates without prompting the user.
 */
export async function getSilentScanCoordinates(): Promise<ScanCoordinates | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      return formatScanCoordinates(lastKnown.coords);
    }

    const currentPositionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: false,
    }).catch(() => null);
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1500);
    });
    const currentPosition = await Promise.race([
      currentPositionPromise,
      timeoutPromise,
    ]);

    if (!currentPosition?.coords) {
      return null;
    }

    return formatScanCoordinates(currentPosition.coords);
  } catch {
    return null;
  }
}

/**
 * Convert a scan status to a short, human-readable label.
 */
export function getStatusLabel(status: LocationArticleStatus): string {
  switch (status) {
    case "scanned":
      return "Article du lieu";
    case "other":
      return "Article hors lieu";
    case "missing":
      return "Article inconnu";
    default:
      return "Article en attente";
  }
}

/**
 * Validate that a scanned barcode sits inside the scan frame.
 */
export function isBarcodeInsideFrame(
  bounds: BarcodeScanningResult["bounds"] | undefined,
  frame: ScanFrameLayout | null
): boolean {
  if (!bounds || !frame) {
    return false;
  }

  const hasOrigin = "origin" in bounds && Boolean(bounds.origin);
  const hasSize = "size" in bounds && Boolean(bounds.size);
  if (!hasOrigin || !hasSize) {
    return false;
  }

  const centerX = bounds.origin.x + bounds.size.width / 2;
  const centerY = bounds.origin.y + bounds.size.height / 2;
  return (
    centerX >= frame.x &&
    centerX <= frame.x + frame.width &&
    centerY >= frame.y &&
    centerY <= frame.y + frame.height
  );
}
