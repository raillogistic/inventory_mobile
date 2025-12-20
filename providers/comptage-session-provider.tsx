import React, { createContext, useCallback, useMemo, useState } from "react";

import type {
  CampagneInventaire,
  GroupeComptage,
  Location,
} from "@/lib/graphql/inventory-operations";

/** Selected comptage session values stored in context. */
export type ComptageSession = {
  /** Selected inventory campaign for the session. */
  campaign: CampagneInventaire | null;
  /** Selected comptage group for the session. */
  group: GroupeComptage | null;
  /** Selected location for the session. */
  location: Location | null;
};

/** Context shape for the comptage session provider. */
export type ComptageSessionContextValue = {
  /** Current session selections. */
  session: ComptageSession;
  /** Update the selected campaign and reset dependent selections. */
  setCampaign: (campaign: CampagneInventaire | null) => void;
  /** Update the selected group and reset dependent selections. */
  setGroup: (group: GroupeComptage | null) => void;
  /** Update the selected location. */
  setLocation: (location: Location | null) => void;
  /** Clear all selections for a fresh session. */
  resetSession: () => void;
};

/** Props for the comptage session provider. */
export type ComptageSessionProviderProps = {
  /** React child nodes rendered within the provider. */
  children: React.ReactNode;
};

/** Comptage session context instance. */
export const ComptageSessionContext =
  createContext<ComptageSessionContextValue | null>(null);

/**
 * Provide in-memory comptage session state for the mobile flow.
 */
export function ComptageSessionProvider({
  children,
}: ComptageSessionProviderProps) {
  const [campaign, setCampaignState] = useState<CampagneInventaire | null>(null);
  const [group, setGroupState] = useState<GroupeComptage | null>(null);
  const [location, setLocationState] = useState<Location | null>(null);

  /** Select a campaign and clear group/location selections. */
  const setCampaign = useCallback(
    (nextCampaign: CampagneInventaire | null) => {
      setCampaignState(nextCampaign);
      setGroupState(null);
      setLocationState(null);
    },
    []
  );

  /** Select a group and clear the location selection. */
  const setGroup = useCallback((nextGroup: GroupeComptage | null) => {
    setGroupState(nextGroup);
    setLocationState(null);
  }, []);

  /** Select a location for the session. */
  const setLocation = useCallback((nextLocation: Location | null) => {
    setLocationState(nextLocation);
  }, []);

  /** Reset all selections in the comptage session. */
  const resetSession = useCallback(() => {
    setCampaignState(null);
    setGroupState(null);
    setLocationState(null);
  }, []);

  const session = useMemo<ComptageSession>(
    () => ({ campaign, group, location }),
    [campaign, group, location]
  );

  const contextValue = useMemo<ComptageSessionContextValue>(
    () => ({
      session,
      setCampaign,
      setGroup,
      setLocation,
      resetSession,
    }),
    [session, setCampaign, setGroup, setLocation, resetSession]
  );

  return (
    <ComptageSessionContext.Provider value={contextValue}>
      {children}
    </ComptageSessionContext.Provider>
  );
}
