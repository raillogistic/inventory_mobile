import { useCallback } from "react";
import {
  type ApolloError,
  type ApolloQueryResult,
  useMutation,
  useQuery,
} from "@apollo/client";
import type { GraphQLError } from "graphql";

import {
  CAMPAGNE_INVENTAIRE_LIST_QUERY,
  CREATE_ENREGISTREMENT_INVENTAIRE_MUTATION,
  ENREGISTREMENT_INVENTAIRE_LIST_QUERY,
  GROUPE_COMPTAGE_LIST_QUERY,
  LOCATION_LIST_QUERY,
  type CampagneInventaire,
  type CampagneInventaireListData,
  type CampagneInventaireListVariables,
  type CreateEnregistrementInventaireData,
  type CreateEnregistrementInventaireVariables,
  type EnregistrementInventaireListData,
  type EnregistrementInventaireListItem,
  type EnregistrementInventaireListVariables,
  type EnregistrementInventaireInput,
  type GroupeComptage,
  type GroupeComptageListData,
  type GroupeComptageListVariables,
  type Location,
  type LocationListData,
  type LocationListVariables,
  type MutationError,
} from "@/lib/graphql/inventory-operations";

/** Normalized error message from Apollo errors. */
export type ApolloErrorMessage = {
  /** Error object returned by Apollo, if any. */
  error: ApolloError | null;
  /** User-friendly message derived from the error. */
  errorMessage: string | null;
};

/** GraphQL error location details for display. */
type GraphQLErrorLocation = {
  /** 1-based line number for the error location. */
  line: number;
  /** 1-based column number for the error location. */
  column: number;
};

/**
 * Format the path array returned by GraphQL for display.
 */
function formatGraphQLPath(path: ReadonlyArray<string | number> | undefined): string {
  if (!path || path.length === 0) {
    return "unknown";
  }

  return path.map(String).join(".");
}

/**
 * Format GraphQL error locations for display.
 */
function formatGraphQLLocations(
  locations: readonly GraphQLErrorLocation[] | undefined
): string {
  if (!locations || locations.length === 0) {
    return "unknown";
  }

  return locations.map((loc) => `${loc.line}:${loc.column}`).join(", ");
}

/**
 * Build a detailed message for a single GraphQL error.
 */
function formatGraphQLError(error: GraphQLError): string {
  const pathLabel = formatGraphQLPath(error.path);
  const locationLabel = formatGraphQLLocations(error.locations);
  const code =
    typeof error.extensions?.code === "string" ? error.extensions.code : "unknown";

  return `GraphQL error: ${error.message} (path: ${pathLabel}, locations: ${locationLabel}, code: ${code})`;
}

/**
 * Build a readable error message from an Apollo error.
 */
export function getApolloErrorMessage(
  error: ApolloError | null
): string | null {
  if (!error) {
    return null;
  }

  if (error.graphQLErrors.length > 0) {
    return error.graphQLErrors.map(formatGraphQLError).join(" | ");
  }

  if (error.networkError) {
    const networkError = error.networkError as
      | { statusCode?: number; message?: string }
      | { name?: string; message?: string }
      | null;
    const statusCode = networkError?.statusCode;
    const networkMessage = networkError?.message ?? "Network error.";

    if (statusCode) {
      return `${networkMessage} (status: ${statusCode})`;
    }

    return networkMessage;
  }

  return error.message ?? "Request failed.";
}

/** Hook state for campaign listing. */
export type CampagneInventaireListState = {
  /** Campaigns returned by the query. */
  campaigns: CampagneInventaire[];
  /** Whether the query is currently loading. */
  loading: boolean;
  /** Error returned by Apollo, if any. */
  error: ApolloError | null;
  /** Derived error message for display. */
  errorMessage: string | null;
  /** Refetch the campaign list with optional variables. */
  refetch: (
    variables?: CampagneInventaireListVariables
  ) => Promise<ApolloQueryResult<CampagneInventaireListData>>;
};

/**
 * Fetch campaigns for the comptage flow.
 */
export function useCampagneInventaireList(
  variables: CampagneInventaireListVariables = {}
): CampagneInventaireListState {
  const result = useQuery<
    CampagneInventaireListData,
    CampagneInventaireListVariables
  >(CAMPAGNE_INVENTAIRE_LIST_QUERY, {
    variables,
    fetchPolicy: "cache-and-network",
  });

  return {
    campaigns: result.data?.campagneinventaires ?? [],
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    refetch: result.refetch,
  };
}

/** Hook state for comptage group listing. */
export type GroupeComptageListState = {
  /** Comptage groups returned by the query. */
  groups: GroupeComptage[];
  /** Whether the query is currently loading. */
  loading: boolean;
  /** Error returned by Apollo, if any. */
  error: ApolloError | null;
  /** Derived error message for display. */
  errorMessage: string | null;
  /** Refetch the group list with optional variables. */
  refetch: (
    variables?: GroupeComptageListVariables
  ) => Promise<ApolloQueryResult<GroupeComptageListData>>;
};

/** Options for controlling group list queries. */
export type GroupeComptageListOptions = {
  /** Skip the query when prerequisites are missing. */
  skip?: boolean;
};

/**
 * Fetch comptage groups for the selected campaign or user.
 */
export function useGroupeComptageList(
  variables: GroupeComptageListVariables = {},
  options: GroupeComptageListOptions = {}
): GroupeComptageListState {
  const queryVariables: GroupeComptageListVariables = {
    ...variables,
    role: variables.role ?? "COMPTAGE",
  };

  const result = useQuery<GroupeComptageListData, GroupeComptageListVariables>(
    GROUPE_COMPTAGE_LIST_QUERY,
    {
      variables: queryVariables,
      fetchPolicy: "cache-and-network",
      skip: options.skip,
    }
  );

  return {
    groups: result.data?.groupecomptages ?? [],
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    refetch: result.refetch,
  };
}

/** Hook state for location listing. */
export type LocationListState = {
  /** Locations returned by the query. */
  locations: Location[];
  /** Whether the query is currently loading. */
  loading: boolean;
  /** Error returned by Apollo, if any. */
  error: ApolloError | null;
  /** Derived error message for display. */
  errorMessage: string | null;
  /** Refetch the location list with optional variables. */
  refetch: (
    variables?: LocationListVariables
  ) => Promise<ApolloQueryResult<LocationListData>>;
};

/** Options for controlling location list queries. */
export type LocationListOptions = {
  /** Skip the query when prerequisites are missing. */
  skip?: boolean;
};

/**
 * Fetch locations for selection or barcode lookup.
 */
export function useLocationList(
  variables: LocationListVariables = {},
  options: LocationListOptions = {}
): LocationListState {
  const result = useQuery<LocationListData, LocationListVariables>(
    LOCATION_LIST_QUERY,
    {
      variables,
      fetchPolicy: "cache-and-network",
      skip: options.skip,
    }
  );

  return {
    locations: result.data?.locations ?? [],
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    refetch: result.refetch,
  };
}

/** Hook state for scan listing. */
export type EnregistrementInventaireListState = {
  /** Scan records returned by the query. */
  scans: EnregistrementInventaireListItem[];
  /** Total scan count for the selected filters. */
  totalCount: number | null;
  /** Whether the query is currently loading. */
  loading: boolean;
  /** Error returned by Apollo, if any. */
  error: ApolloError | null;
  /** Derived error message for display. */
  errorMessage: string | null;
  /** Refetch the scan list with optional variables. */
  refetch: (
    variables?: EnregistrementInventaireListVariables
  ) => Promise<ApolloQueryResult<EnregistrementInventaireListData>>;
};

/** Options for controlling scan list queries. */
export type EnregistrementInventaireListOptions = {
  /** Skip the query when prerequisites are missing. */
  skip?: boolean;
};

/**
 * Fetch scans for the selected campaign, group, and location.
 */
export function useEnregistrementInventaireList(
  variables: EnregistrementInventaireListVariables = {},
  options: EnregistrementInventaireListOptions = {}
): EnregistrementInventaireListState {
  const result = useQuery<
    EnregistrementInventaireListData,
    EnregistrementInventaireListVariables
  >(ENREGISTREMENT_INVENTAIRE_LIST_QUERY, {
    variables,
    fetchPolicy: "cache-and-network",
    skip: options.skip,
  });

  return {
    scans: result.data?.enregistrementinventaires ?? [],
    totalCount: result.data?.enregistrementinventaire_count ?? null,
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    refetch: result.refetch,
  };
}

/** Hook state for the create scan mutation. */
export type CreateEnregistrementInventaireState = {
  /** Mutation submission handler. */
  submit: (
    input: EnregistrementInventaireInput
  ) => Promise<CreateEnregistrementInventaireData | null>;
  /** Whether the mutation is currently loading. */
  loading: boolean;
  /** Error returned by Apollo, if any. */
  error: ApolloError | null;
  /** Derived error message for display. */
  errorMessage: string | null;
  /** Latest mutation response data. */
  data: CreateEnregistrementInventaireData | null;
  /** Validation errors returned by the mutation. */
  mutationErrors: MutationError[] | null;
  /** Whether the mutation reported success. */
  ok: boolean | null;
};

/**
 * Create scan records for the comptage flow.
 */
export function useCreateEnregistrementInventaire(): CreateEnregistrementInventaireState {
  const [mutate, result] = useMutation<
    CreateEnregistrementInventaireData,
    CreateEnregistrementInventaireVariables
  >(CREATE_ENREGISTREMENT_INVENTAIRE_MUTATION);

  /** Submit a scan record to the backend. */
  const submit = useCallback(
    async (input: EnregistrementInventaireInput) => {
      const response = await mutate({ variables: { input } });
      return response.data ?? null;
    },
    [mutate]
  );

  const mutationPayload = result.data?.create_enregistrementinventaire ?? null;

  return {
    submit,
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    data: result.data ?? null,
    mutationErrors: mutationPayload?.errors ?? null,
    ok: mutationPayload?.ok ?? null,
  };
}
