import { type EnregistrementInventaireEtat } from "@/lib/graphql/inventory-operations";
import { type BarcodeScanningResult, CameraView } from "expo-camera";
import React from "react";

/** Payload used to render recent scan entries. */
export type RecentScan = {
  /** Unique identifier for the scan, if available. */
  id: string;
  /** Scanned article code. */
  code: string;
  /** Optional article description returned by the API. */
  description: string | null;
  /** Whether the scanned code matches a known article. */
  hasArticle: boolean;
  /** Optional current location name of the article at load time. */
  previousLocationName: string | null;
  /** Capture timestamp as an ISO string. */
  capturedAt: string;
};

/** Origin source of the scan capture. */
export type ScanSource = "manual" | "camera";

/** GPS coordinates captured for a scan. */
export type ScanCoordinates = {
  /** Latitude value captured from the device. */
  latitude: string | null;
  /** Longitude value captured from the device. */
  longitude: string | null;
};

/** Visual status applied to location article rows. */
export type LocationArticleStatus =
  | "pending"
  | "scanned"
  | "missing"
  | "other";

/** Payload used to render location article rows. */
export type LocationArticleItem = {
  /** Unique identifier for the row, when available. */
  id: string | null;
  /** Article code displayed in the list. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Previous location name captured from the offline cache. */
  previousLocationName: string | null;
  /** New location name based on the current selection. */
  nextLocationName: string | null;
  /** Status used to drive list coloring. */
  status: LocationArticleStatus;
  /** Source list for the row. */
  source: "location" | "extra";
};

/** Tab keys for the scan list. */
export type ScanListTab = "scanned" | "location";

/** Tab metadata for the scan list UI. */
export type ScanListTabConfig = {
  /** Unique tab identifier. */
  id: ScanListTab;
  /** Label displayed for the tab. */
  label: string;
};

/** Payload used to render the scan detail modal. */
export type ScanDetail = {
  /** Unique identifier for the scan record. */
  id: string | null;
  /** Scanned article code displayed in the modal. */
  code: string;
  /** Optional article identifier resolved from the cache. */
  articleId: string | null;
  /** Optional description for the scanned article. */
  description: string | null;
  /** Optional captured image URI. */
  imageUri: string | null;
  /** Optional short description for temporary articles. */
  customDesc: string | null;
  /** Source of the scan capture. */
  source: ScanSource | null;
  /** Status used to highlight the scanned article. */
  status: LocationArticleStatus;
  /** Short label for the scan status. */
  statusLabel: string;
  /** Scan timestamp used for the modal subtitle. */
  capturedAt: string;
  /** Whether this scan was already recorded for the location. */
  alreadyScanned: boolean;
  /** Optional observation captured for the scan. */
  observation: string | null;
  /** Optional serial number captured for the scan. */
  serialNumber: string | null;
};

/** Etat option displayed in the scan modal. */
export type EtatOption = {
  /** Etat value persisted in the backend. */
  value: EnregistrementInventaireEtat;
  /** Human-readable label shown in the UI. */
  label: string;
};

/** Camera view handle used for capturing scan images. */
export type CameraViewHandle = React.ElementRef<typeof CameraView>;

/** Layout info for positioning the scan button border runner. */
export type ScanButtonLayout = {
  /** Width of the scan button wrapper. */
  width: number;
  /** Height of the scan button wrapper. */
  height: number;
};

/** Layout rectangle used to validate barcode positions. */
export type ScanFrameLayout = {
  /** Left position relative to the camera preview. */
  x: number;
  /** Top position relative to the camera preview. */
  y: number;
  /** Width of the scan frame. */
  width: number;
  /** Height of the scan frame. */
  height: number;
};
