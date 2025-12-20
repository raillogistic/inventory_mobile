/**
 * Auth server configuration used to build the login GraphQL endpoint.
 */
export type AuthServerConfig = {
  /** Protocol used for the auth endpoint. */
  protocol: 'http' | 'https';
  /** Hostname or IP address for the auth server. */
  host: string;
  /** Port for the auth server. */
  port: string;
  /** Path segment for the auth GraphQL schema. */
  path: string;
  /** Path segment for the protected GraphQL schema. */
  apiPath?: string;
};

/** Default auth server configuration (localhost:8000/auth). */
export const DEFAULT_AUTH_SERVER_CONFIG: AuthServerConfig = {
  protocol: 'http',
  host: 'localhost',
  port: '8000',
  path: 'auth',
  apiPath: 'gql',
};

/**
 * Build the full auth endpoint URL from a server config object.
 */
export function buildAuthUrl(config: AuthServerConfig): string {
  const normalizedPath = config.path.replace(/^\/+/, '');
  return `${config.protocol}://${config.host}:${config.port}/${normalizedPath}`;
}

/**
 * Build the protected GraphQL endpoint URL from a server config object.
 */
export function buildApiUrl(config: AuthServerConfig): string {
  const apiPath = config.apiPath ?? 'gql';
  const normalizedPath = apiPath.replace(/^\/+/, '');
  return `${config.protocol}://${config.host}:${config.port}/${normalizedPath}`;
}
