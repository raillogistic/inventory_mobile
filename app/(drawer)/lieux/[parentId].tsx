import React, { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import {
  LocationLevelScreen,
  type LocationTrailItem,
} from "@/app/(drawer)/lieux/_location-level";
import type { Location } from "@/lib/graphql/inventory-operations";

/** Params passed to the child location route. */
type LocationParams = {
  parentId?: string;
  parentName?: string;
  parentDesc?: string;
  parentBarcode?: string;
  parentTrail?: string;
};

/**
 * Location selection screen for a specific parent location.
 */
export default function LocationSelectionChild() {
  const params = useLocalSearchParams<LocationParams>();
  const parentLocation = useMemo<Location | null>(() => {
    if (!params.parentId || !params.parentName) {
      return null;
    }

    return {
      id: params.parentId,
      locationname: params.parentName,
      desc: params.parentDesc ? params.parentDesc : null,
      barcode: params.parentBarcode ? params.parentBarcode : null,
      parent: null,
    };
  }, [params.parentBarcode, params.parentDesc, params.parentId, params.parentName]);

  const parentTrail = useMemo<LocationTrailItem[]>(() => {
    if (!params.parentTrail) {
      return [];
    }
    try {
      const parsed = JSON.parse(params.parentTrail) as LocationTrailItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.parentTrail]);

  return (
    <LocationLevelScreen
      parentLocation={parentLocation}
      parentTrail={parentTrail}
    />
  );
}
