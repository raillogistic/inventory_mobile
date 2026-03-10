import { type BarcodeType } from "expo-camera";
import { type EtatOption, type ScanListTabConfig } from "./types";

/** Limits the number of scans fetched to drive status updates. */
export const SCAN_STATUS_LIMIT = 2000;

/** Supported 1D barcode formats for the camera scanner. */
export const BARCODE_TYPES: BarcodeType[] = [
  "code128",
  "code39",
  "code93",
  "ean13",
  "ean8",
  "itf14",
  "upc_a",
  "upc_e",
  "codabar",
];

/** Etat options available when validating a scan. */
export const ETAT_OPTIONS: EtatOption[] = [
  { value: "BIEN", label: "Bien" },
  { value: "MOYENNE", label: "Moyenne" },
  { value: "HORS_SERVICE", label: "Hors service" },
];

/** Tabs available for the scan list view. */
export const SCAN_LIST_TABS: ScanListTabConfig[] = [
  { id: "scanned", label: "Articles déja scannés" },
  { id: "location", label: "Articles dans la localisation" },
];
