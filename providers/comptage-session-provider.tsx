import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  CampagneInventaire,
  GroupeComptage,
  Location,
} from "@/lib/graphql/inventory-operations";
import {
  clearComptageSession,
  loadComptageSession,
  saveComptageSession,
} from "@/lib/storage/comptage-session";

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
  /** Whether persisted session data has been loaded. */
  isReady: boolean;
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
  const [isReady, setIsReady] = useState(false);

  /** Persist the comptage session snapshot. */
  const persistSession = useCallback(
    async (nextSession: ComptageSession) => {
      await saveComptageSession(nextSession);
    },
    []
  );

  /** Load persisted comptage selections on startup. */
  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const storedSession = await loadComptageSession();
      if (!isMounted) {
        return;
      }

      if (storedSession) {
        setCampaignState(storedSession.campaign ?? null);
        setGroupState(storedSession.group ?? null);
        setLocationState(storedSession.location ?? null);
      }

      setIsReady(true);
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /** Select a campaign and clear group/location selections. */
  const setCampaign = useCallback(
    (nextCampaign: CampagneInventaire | null) => {
      const nextSession = {
        campaign: nextCampaign,
        group: null,
        location: null,
      };
      setCampaignState(nextSession.campaign);
      setGroupState(nextSession.group);
      setLocationState(nextSession.location);
      void persistSession(nextSession);
    },
    [persistSession]
  );

  /** Select a group and clear the location selection. */
  const setGroup = useCallback(
    (nextGroup: GroupeComptage | null) => {
      const nextSession = {
        campaign,
        group: nextGroup,
        location: null,
      };
      setGroupState(nextSession.group);
      setLocationState(nextSession.location);
      void persistSession(nextSession);
    },
    [campaign, persistSession]
  );

  /** Select a location for the session. */
  const setLocation = useCallback(
    (nextLocation: Location | null) => {
      const nextSession = {
        campaign,
        group,
        location: nextLocation,
      };
      setLocationState(nextSession.location);
      void persistSession(nextSession);
    },
    [campaign, group, persistSession]
  );

  /** Reset all selections in the comptage session. */
  const resetSession = useCallback(() => {
    setCampaignState(null);
    setGroupState(null);
    setLocationState(null);
    void clearComptageSession();
  }, []);

  const session = useMemo<ComptageSession>(
    () => ({ campaign, group, location }),
    [campaign, group, location]
  );

  const contextValue = useMemo<ComptageSessionContextValue>(
    () => ({
      isReady,
      session,
      setCampaign,
      setGroup,
      setLocation,
      resetSession,
    }),
    [isReady, session, setCampaign, setGroup, setLocation, resetSession]
  );

  return (
    <ComptageSessionContext.Provider value={contextValue}>
      {children}
    </ComptageSessionContext.Provider>
  );
}
