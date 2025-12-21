import React from "react";

import { LocationLevelScreen } from "@/app/(drawer)/lieux/_location-level";

/**
 * Root location selection screen (top-level locations).
 */
export default function LocationSelectionRoot() {
  return <LocationLevelScreen parentLocation={null} parentTrail={[]} />;
}
