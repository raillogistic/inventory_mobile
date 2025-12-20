import React, { useMemo } from "react";
import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  createHttpLink,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { setContext } from "@apollo/client/link/context";

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

  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  }));

  return new ApolloClient({
    link: authLink.concat(httpLink),
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
