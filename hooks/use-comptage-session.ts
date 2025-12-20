import { useContext } from "react";

import {
  ComptageSessionContext,
  type ComptageSessionContextValue,
} from "@/providers/comptage-session-provider";

/**
 * Access the comptage session context and helpers.
 */
export function useComptageSession(): ComptageSessionContextValue {
  const context = useContext(ComptageSessionContext);

  if (!context) {
    throw new Error("useComptageSession must be used within ComptageSessionProvider");
  }

  return context;
}
