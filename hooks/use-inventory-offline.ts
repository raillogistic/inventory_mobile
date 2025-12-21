import { useContext } from "react";

import {
  InventoryOfflineContext,
  type InventoryOfflineContextValue,
} from "@/providers/inventory-offline-provider";

/**
 * Access offline inventory cache data and sync actions.
 */
export function useInventoryOffline(): InventoryOfflineContextValue {
  const context = useContext(InventoryOfflineContext);

  if (!context) {
    throw new Error(
      "useInventoryOffline must be used within InventoryOfflineProvider"
    );
  }

  return context;
}
