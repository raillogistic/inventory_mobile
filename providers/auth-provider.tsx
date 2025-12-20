import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildApiUrl,
  buildAuthUrl,
  DEFAULT_AUTH_SERVER_CONFIG,
  type AuthServerConfig,
} from '@/lib/auth/auth-config';
import { getStoredJson, removeStoredItem, setStoredJson } from '@/lib/auth/auth-storage';

/** Token information returned by the backend. */
export type AuthTokens = {
  /** JWT access token used for API calls. */
  accessToken: string;
  /** Refresh token issued by the backend. */
  refreshToken: string | null;
  /** ISO timestamp for access token expiration. */
  expiresAt: string | null;
};

/** Authenticated user summary returned by the backend. */
export type AuthUser = {
  /** User identifier. */
  id: string;
  /** Unique username. */
  username: string;
  /** User email address. */
  email: string | null;
  /** User first name. */
  firstName: string | null;
  /** User last name. */
  lastName: string | null;
};

/** Full auth session payload persisted on login. */
export type AuthSession = {
  /** Token bundle for API authentication. */
  tokens: AuthTokens;
  /** User data for UI display. */
  user: AuthUser | null;
};

/** Auth context shape used across the app. */
export type AuthContextValue = {
  /** Whether persisted auth data has been loaded. */
  isReady: boolean;
  /** Whether a valid access token is available. */
  isAuthenticated: boolean;
  /** Active access token for Apollo requests. */
  accessToken: string | null;
  /** Current authenticated user, if any. */
  user: AuthUser | null;
  /** Active auth server configuration. */
  serverConfig: AuthServerConfig;
  /** Computed auth endpoint URL. */
  authUrl: string;
  /** Computed API endpoint URL. */
  apiUrl: string;
  /** Persist a new auth session after login. */
  setAuthSession: (session: AuthSession) => Promise<void>;
  /** Clear the auth session and stored tokens. */
  clearAuthSession: () => Promise<void>;
  /** Update and persist auth server configuration. */
  updateServerConfig: (config: AuthServerConfig) => Promise<void>;
};

/** Props for the AuthProvider component. */
export type AuthProviderProps = {
  /** React child nodes rendered within the provider. */
  children: React.ReactNode;
};

/** Storage keys for persisted auth data. */
const AUTH_STORAGE_KEYS = {
  tokens: 'auth.tokens',
  user: 'auth.user',
  server: 'auth.server',
} as const;

/** Authentication context instance. */
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provide authentication state and persistence helpers to the app.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [serverConfig, setServerConfig] = useState<AuthServerConfig>(
    DEFAULT_AUTH_SERVER_CONFIG
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    /** Load persisted auth state from storage. */
    const loadStoredAuth = async () => {
      const [storedTokens, storedUser, storedServer] = await Promise.all([
        getStoredJson<AuthTokens>(AUTH_STORAGE_KEYS.tokens),
        getStoredJson<AuthUser | null>(AUTH_STORAGE_KEYS.user),
        getStoredJson<AuthServerConfig>(AUTH_STORAGE_KEYS.server),
      ]);

      if (!isMounted) {
        return;
      }

      if (storedTokens) {
        setTokens(storedTokens);
      }

      if (storedUser !== null) {
        setUser(storedUser);
      }

      if (storedServer) {
        setServerConfig(storedServer);
      }

      setIsReady(true);
    };

    loadStoredAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  /** Persist tokens and user data after a successful login. */
  const setAuthSession = useCallback(async (session: AuthSession) => {
    setTokens(session.tokens);
    setUser(session.user);
    await Promise.all([
      setStoredJson<AuthTokens>(AUTH_STORAGE_KEYS.tokens, session.tokens),
      setStoredJson<AuthUser | null>(AUTH_STORAGE_KEYS.user, session.user),
    ]);
  }, []);

  /** Clear stored tokens and user data on logout. */
  const clearAuthSession = useCallback(async () => {
    setTokens(null);
    setUser(null);
    await Promise.all([
      removeStoredItem(AUTH_STORAGE_KEYS.tokens),
      removeStoredItem(AUTH_STORAGE_KEYS.user),
    ]);
  }, []);

  /** Persist updates to the auth server configuration. */
  const updateServerConfig = useCallback(async (config: AuthServerConfig) => {
    setServerConfig(config);
    await setStoredJson<AuthServerConfig>(AUTH_STORAGE_KEYS.server, config);
  }, []);

  const authUrl = useMemo(() => buildAuthUrl(serverConfig), [serverConfig]);
  const apiUrl = useMemo(() => buildApiUrl(serverConfig), [serverConfig]);
  const accessToken = tokens?.accessToken ?? null;
  const isAuthenticated = Boolean(accessToken);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isAuthenticated,
      accessToken,
      user,
      serverConfig,
      authUrl,
      apiUrl,
      setAuthSession,
      clearAuthSession,
      updateServerConfig,
    }),
    [
      isReady,
      isAuthenticated,
      accessToken,
      user,
      serverConfig,
      authUrl,
      apiUrl,
      setAuthSession,
      clearAuthSession,
      updateServerConfig,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
