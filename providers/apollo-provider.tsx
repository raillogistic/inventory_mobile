import React, { useMemo } from "react";
import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  createHttpLink,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";

import { useAuth } from "@/hooks/use-auth";

/** Props for the ApolloProviderWithAuth component. */

export type ApolloProviderWithAuthProps = {
  /** React child nodes rendered with Apollo context. */
  children: React.ReactNode;
};

/**
 * Build an Apollo Client instance configured for the auth endpoint.
 */
function createApolloClient(
  apiUrl: string,
  accessToken: string | null
): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({ uri: apiUrl });
  const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
    const operationName = operation.operationName;
    const operationVariables = operation.variables;
    const operationQuery = operation.query?.loc?.source?.body;

    if (graphQLErrors && graphQLErrors.length > 0) {
      console.error("[GraphQL error]", {
        operation: operationName,
        variables: operationVariables,
        query: operationQuery,
        graphQLErrors,
      });
    }

    if (networkError) {
      const networkErrorDetails = networkError as {
        result?: unknown;
        statusCode?: number;
        bodyText?: string;
      };
      console.error("[Network error]", {
        operation: operationName,
        variables: operationVariables,
        query: operationQuery,
        networkError,
        result: networkErrorDetails.result,
        statusCode: networkErrorDetails.statusCode,
        bodyText: networkErrorDetails.bodyText,
      });
    }
  });

  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      ...(accessToken ? { Authorization: `JWT ${accessToken}` } : {}),
    },
  }));

  return new ApolloClient({
    link: errorLink.concat(authLink).concat(httpLink),
    cache: new InMemoryCache(),
  });
}

/**
 * Provide Apollo Client configured with the current auth context.
 */
export function ApolloProviderWithAuth({
  children,
}: ApolloProviderWithAuthProps) {
  const { apiUrl, accessToken } = useAuth();

  const client = useMemo(
    () => createApolloClient(apiUrl, accessToken),
    [apiUrl, accessToken]
  );

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
