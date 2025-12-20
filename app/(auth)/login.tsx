import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";

const TOKEN_AUTH_MUTATION = `
  mutation TokenAuth($username: String!, $password: String!) {
    token_auth(username: $username, password: $password) {
      token
    }
  }
`;

/** Login form values. */
type LoginFormState = {
  /** Username input value. */
  username: string;
  /** Password input value. */
  password: string;
};

/** Variables required by the token auth mutation. */
type TokenAuthVariables = {
  /** Username used for authentication. */
  username: string;
  /** Password used for authentication. */
  password: string;
};

/** Payload returned by the token auth mutation. */
type TokenAuthPayload = {
  /** Access token string. */
  token: string | null;
};

/** Result data returned by the token auth mutation. */
type TokenAuthData = {
  /** Token auth response wrapper. */
  token_auth: TokenAuthPayload | null;
};

/** GraphQL response shape for token auth requests. */
type TokenAuthResponse = {
  /** Response data from the backend. */
  data?: TokenAuthData;
  /** GraphQL errors, if any. */
  errors?: { message: string }[];
};

/** Result of an auth endpoint reachability check. */
type EndpointCheckResult = {
  /** Whether the endpoint responded successfully. */
  ok: boolean;
  /** Optional error message for the user. */
  message?: string;
};

/**
 * Normalize errors into a displayable message.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Connexion impossible. Veuillez reessayer.";
}

/**
 * Request an auth token from the backend auth endpoint.
 */
async function requestTokenAuth(
  authUrl: string,
  variables: TokenAuthVariables
): Promise<TokenAuthPayload> {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: TOKEN_AUTH_MUTATION, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Le serveur d'authentification a renvoye le statut ${response.status}.`
    );
  }

  const payload = (await response.json()) as TokenAuthResponse;

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data?.token_auth ?? { token: null };
}

/**
 * Check if the auth server endpoint is reachable.
 */
async function checkAuthEndpoint(url: string): Promise<EndpointCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { __typename }" }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("Auth endpoint responded with status", response.status, url);
      return {
        ok: false,
        message: "Le serveur d'authentification ne repond pas.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.warn("Auth endpoint unreachable", url, error);
    return {
      ok: false,
      message: "Impossible de joindre le serveur. Verifiez l'hote et le port.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Authentication screen that allows users to sign in.
 */
export default function LoginScreen() {
  const { authUrl, serverConfig, setAuthSession, updateServerConfig } =
    useAuth();
  const [formState, setFormState] = useState<LoginFormState>({
    username: "g1",
    password: "it-2017***",
  });
  const [serverHost, setServerHost] = useState(serverConfig.host);
  const [serverPort, setServerPort] = useState(serverConfig.port);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const borderColor = useThemeColor(
    { light: "#E2E8F0", dark: "#2B2E35" },
    "icon"
  );
  const placeholderColor = useThemeColor(
    { light: "#94A3B8", dark: "#6B7280" },
    "icon"
  );
  const surfaceColor = useThemeColor(
    { light: "#F8FAFC", dark: "#1F232B" },
    "background"
  );
  const errorColor = useThemeColor(
    { light: "#DC2626", dark: "#F87171" },
    "text"
  );
  const buttonTextColor = useThemeColor(
    { light: "#ffffff", dark: "#11181C" },
    "text"
  );

  /** Sync local server inputs with the persisted server config. */
  const syncServerInputs = useCallback(() => {
    setServerHost(serverConfig.host);
    setServerPort(serverConfig.port);
  }, [serverConfig.host, serverConfig.port]);

  useEffect(syncServerInputs, [syncServerInputs]);

  /** Update the username field value. */
  const handleUsernameChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, username: value }));
  }, []);

  /** Update the password field value. */
  const handlePasswordChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, password: value }));
  }, []);

  /** Toggle visibility of the server settings panel. */
  const handleToggleServerSettings = useCallback(() => {
    setShowServerSettings((current) => !current);
  }, []);

  /** Update the host value for the auth server. */
  const handleServerHostChange = useCallback((value: string) => {
    setServerHost(value);
  }, []);

  /** Update the port value for the auth server. */
  const handleServerPortChange = useCallback((value: string) => {
    setServerPort(value.replace(/[^0-9]/g, ""));
  }, []);

  /** Persist the current auth server configuration. */
  const handleApplyServerSettings = useCallback(async () => {
    const nextConfig = {
      ...serverConfig,
      host: serverHost.trim() || serverConfig.host,
      port: serverPort.trim() || serverConfig.port,
    };

    await updateServerConfig(nextConfig);
    setShowServerSettings(false);
  }, [serverConfig, serverHost, serverPort, updateServerConfig]);

  /** Submit the token auth mutation and persist the auth session. */
  const handleLogin = useCallback(async () => {
    const trimmedUsername = formState.username.trim();

    if (!trimmedUsername || !formState.password) {
      setErrorMessage("Le nom d'utilisateur et le mot de passe sont requis.");
      return;
    }

    setErrorMessage(null);

    const endpointStatus = await checkAuthEndpoint(authUrl);
    if (!endpointStatus.ok) {
      setErrorMessage(
        endpointStatus.message ??
          "Le serveur d'authentification est inaccessible."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = await requestTokenAuth(authUrl, {
        username: trimmedUsername,
        password: formState.password,
      });

      if (!payload.token) {
        setErrorMessage("Echec de la connexion. Verifiez vos identifiants.");
        return;
      }

      await setAuthSession({
        tokens: {
          accessToken: payload.token,
          refreshToken: null,
          expiresAt: null,
        },
        user: null,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [authUrl, formState.password, formState.username, setAuthSession]);

  const isLoginDisabled = useMemo(
    () => isSubmitting || !formState.username.trim() || !formState.password,
    [formState.password, formState.username, isSubmitting]
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.select({ ios: "padding", default: undefined })}
    >
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title">Connexion</ThemedText>
            <ThemedText>Utilisez votre compte pour continuer.</ThemedText>
          </View>
          <TouchableOpacity
            onPress={handleToggleServerSettings}
            accessibilityLabel="Modifier le serveur d'authentification"
          >
            <IconSymbol name="gearshape.fill" size={22} color={tintColor} />
          </TouchableOpacity>
        </View>

        {showServerSettings ? (
          <ThemedView
            style={[
              styles.serverCard,
              { borderColor, backgroundColor: surfaceColor },
            ]}
          >
            <View style={styles.serverHeader}>
              <ThemedText type="subtitle">
                Serveur d'authentification
              </ThemedText>
              <TouchableOpacity onPress={handleApplyServerSettings}>
                <ThemedText type="defaultSemiBold">Appliquer</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.serverRow}>
              <View style={styles.serverColumn}>
                <ThemedText style={styles.serverLabel}>Hote</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor, color: textColor }]}
                  placeholder="localhost"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={serverHost}
                  onChangeText={handleServerHostChange}
                />
              </View>
              <View style={styles.serverColumn}>
                <ThemedText style={styles.serverLabel}>Port</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor, color: textColor }]}
                  placeholder="8000"
                  placeholderTextColor={placeholderColor}
                  keyboardType="number-pad"
                  value={serverPort}
                  onChangeText={handleServerPortChange}
                />
              </View>
            </View>
            <ThemedText style={styles.endpointText}>
              Point de terminaison : {authUrl}
            </ThemedText>
          </ThemedView>
        ) : null}

        <View style={styles.form}>
          <View>
            <ThemedText style={styles.fieldLabel}>Nom d'utilisateur</ThemedText>
            <TextInput
              style={[styles.input, { borderColor, color: textColor }]}
              placeholder="Nom d'utilisateur"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              value={formState.username}
              onChangeText={handleUsernameChange}
            />
          </View>
          <View>
            <ThemedText style={styles.fieldLabel}>Mot de passe</ThemedText>
            <TextInput
              style={[styles.input, { borderColor, color: textColor }]}
              placeholder="Mot de passe"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              value={formState.password}
              onChangeText={handlePasswordChange}
            />
          </View>
          {errorMessage ? (
            <ThemedText style={[styles.errorText, { color: errorColor }]}>
              {errorMessage}
            </ThemedText>
          ) : null}
          <TouchableOpacity
            style={[
              styles.loginButton,
              { backgroundColor: tintColor },
              isLoginDisabled ? styles.loginButtonDisabled : null,
            ]}
            onPress={handleLogin}
            disabled={isLoginDisabled}
          >
            <ThemedText
              type="defaultSemiBold"
              style={[styles.loginButtonText, { color: buttonTextColor }]}
            >
              {isSubmitting ? "Connexion..." : "Se connecter"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    marginTop: 4,
  },
  serverCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  serverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  serverRow: {
    flexDirection: "row",
    gap: 12,
  },
  serverColumn: {
    flex: 1,
  },
  serverLabel: {
    marginBottom: 6,
  },
  endpointText: {
    marginTop: 12,
    fontSize: 12,
  },
});
