import { gql } from "@apollo/client";

/**
 * Reconciliation status metrics.
 */
export type ReconciliationStatus = {
  /** Total count of validated codes. */
  validatedCodes: number;
  /** Number of unique physical assets validated. */
  uniqueArticles: number;
  /** Number of pending conflicts. */
  pendingConflicts: number;
};

/**
 * Response payload for the reconciliation status query.
 */
export type ReconciliationStatusData = {
  reconciliationStatus: ReconciliationStatus;
};

/**
 * Variables for the reconciliation status query.
 */
export type ReconciliationStatusVariables = {
  campaignId: string;
};

/**
 * GraphQL query for fetching reconciliation metrics.
 */
export const GET_RECONCILIATION_STATUS = gql`
  query GetReconciliationStatus($campaignId: ID!) {
    reconciliationStatus(campaignId: $campaignId) {
      validatedCodes
      uniqueArticles
      pendingConflicts
    }
  }
`;

/**
 * Conflict item details.
 */
export type ConflictItem = {
  id: string;
  articleCode: string;
  description: string | null;
  status: string;
};

/**
 * Response payload for the conflicts query.
 */
export type ConflictsData = {
  conflicts: ConflictItem[];
};

/**
 * Variables for the conflicts query.
 */
export type ConflictsVariables = {
  campaignId: string;
};

/**
 * GraphQL query for listing conflicts.
 */
export const GET_CONFLICTS = gql`
  query GetConflicts($campaignId: ID!) {
    conflicts(campaignId: $campaignId) {
      id
      articleCode
      description
      status
    }
  }
`;

/**
 * Response payload for the generate rapprochement mutation.
 */
export type GenerateRapprochementData = {
  generateRapprochement: {
    ok: boolean;
    message: string | null;
  };
};

/**
 * Variables for the generate rapprochement mutation.
 */
export type GenerateRapprochementVariables = {
  campaignId: string;
};

/**
 * GraphQL mutation to generate the reconciliation report.
 */
export const GENERATE_RAPPROCHEMENT = gql`
  mutation GenerateRapprochement($campaignId: ID!) {
    generateRapprochement(campaignId: $campaignId) {
      ok
      message
    }
  }
`;
