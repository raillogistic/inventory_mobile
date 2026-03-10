import { useCallback } from "react";
import {
  type ApolloError,
  type ApolloQueryResult,
  useMutation,
  useQuery,
} from "@apollo/client";
import { getApolloErrorMessage } from "@/lib/graphql/inventory-hooks";
import {
  GET_RECONCILIATION_STATUS,
  GET_CONFLICTS,
  GENERATE_RAPPROCHEMENT,
  type ReconciliationStatusData,
  type ReconciliationStatusVariables,
  type ConflictsData,
  type ConflictsVariables,
  type GenerateRapprochementData,
  type GenerateRapprochementVariables,
  type ReconciliationStatus,
  type ConflictItem,
} from "@/lib/graphql/reconciliation-operations";

/** Hook state for reconciliation status. */
export type ReconciliationStatusState = {
  status: ReconciliationStatus | null;
  loading: boolean;
  error: ApolloError | null;
  errorMessage: string | null;
  refetch: (
    variables?: ReconciliationStatusVariables
  ) => Promise<ApolloQueryResult<ReconciliationStatusData>>;
};

/**
 * Fetch reconciliation status with polling.
 */
export function useReconciliationStatus(
  campaignId: string,
  pollInterval: number = 5000
): ReconciliationStatusState {
  const result = useQuery<ReconciliationStatusData, ReconciliationStatusVariables>(
    GET_RECONCILIATION_STATUS,
    {
      variables: { campaignId },
      pollInterval,
      fetchPolicy: "cache-and-network",
      skip: !campaignId,
    }
  );

  return {
    status: result.data?.reconciliationStatus ?? null,
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    refetch: result.refetch,
  };
}

/** Hook state for conflicts list. */
export type ConflictsState = {
  conflicts: ConflictItem[];
  loading: boolean;
  error: ApolloError | null;
  errorMessage: string | null;
  refetch: (
    variables?: ConflictsVariables
  ) => Promise<ApolloQueryResult<ConflictsData>>;
};

/**
 * Fetch conflicts list.
 */
export function useConflicts(
  campaignId: string
): ConflictsState {
  const result = useQuery<ConflictsData, ConflictsVariables>(
    GET_CONFLICTS,
    {
      variables: { campaignId },
      fetchPolicy: "cache-and-network",
      skip: !campaignId,
    }
  );

  return {
    conflicts: result.data?.conflicts ?? [],
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    refetch: result.refetch,
  };
}

/** Hook state for generate rapprochement mutation. */
export type GenerateRapprochementState = {
  submit: (
    campaignId: string
  ) => Promise<GenerateRapprochementData | null>;
  loading: boolean;
  error: ApolloError | null;
  errorMessage: string | null;
  data: GenerateRapprochementData | null;
};

/**
 * Mutation to generate reconciliation report.
 */
export function useGenerateRapprochement(): GenerateRapprochementState {
  const [mutate, result] = useMutation<
    GenerateRapprochementData,
    GenerateRapprochementVariables
  >(GENERATE_RAPPROCHEMENT);

  const submit = useCallback(
    async (campaignId: string) => {
      const response = await mutate({ variables: { campaignId } });
      return response.data ?? null;
    },
    [mutate]
  );

  return {
    submit,
    loading: result.loading,
    error: result.error ?? null,
    errorMessage: getApolloErrorMessage(result.error ?? null),
    data: result.data ?? null,
  };
}
