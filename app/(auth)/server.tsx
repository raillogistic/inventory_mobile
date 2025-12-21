import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";

/** Local form state for server configuration. */
type ServerFormState = {
  /** Hostname or IP value. */
  host: string;
  /** Port value as a string. */
  port: string;
};

/**
 * Server configuration screen for the auth endpoint.
 */
export default function ServerConfigScreen() {
  const router = useRouter();
  const { authUrl, serverConfig, updateServerConfig } = useAuth();
  const [formState, setFormState] = useState<ServerFormState>({
    host: serverConfig.host,
    port: serverConfig.port,
  });

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
  const mutedColor = useThemeColor(
    { light: "#64748B", dark: "#94A3B8" },
    "icon"
  );
  const buttonTextColor = useThemeColor(
    { light: "#ffffff", dark: "#11181C" },
    "text"
  );

  /** Sync local inputs with the persisted server configuration. */
  useEffect(() => {
    setFormState({ host: serverConfig.host, port: serverConfig.port });
  }, [serverConfig.host, serverConfig.port]);

  /** Update host input value. */
  const handleHostChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, host: value }));
  }, []);

  /** Update port input value. */
  const handlePortChange = useCallback((value: string) => {
    setFormState((current) => ({
      ...current,
      port: value.replace(/[^0-9]/g, ""),
    }));
  }, []);

  /** Apply server config changes and return to login. */
  const handleApply = useCallback(async () => {
    const nextConfig = {
      ...serverConfig,
      host: formState.host.trim() || serverConfig.host,
      port: formState.port.trim() || serverConfig.port,
    };

    await updateServerConfig(nextConfig);
    router.back();
  }, [formState.host, formState.port, router, serverConfig, updateServerConfig]);

  /** Discard edits and return to login. */
  const handleCancel = useCallback(() => {
    setFormState({ host: serverConfig.host, port: serverConfig.port });
    router.back();
  }, [router, serverConfig.host, serverConfig.port]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.select({ ios: "padding", default: undefined })}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">Serveur</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Configurez l'hote et le port pour l'authentification.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            { borderColor, backgroundColor: surfaceColor },
          ]}
        >
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Hote</ThemedText>
            <TextInput
              style={[styles.input, { borderColor, color: textColor }]}
              placeholder="localhost"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              value={formState.host}
              onChangeText={handleHostChange}
            />
          </View>
          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Port</ThemedText>
            <TextInput
              style={[styles.input, { borderColor, color: textColor }]}
              placeholder="8000"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              value={formState.port}
              onChangeText={handlePortChange}
            />
          </View>
          <View style={styles.endpointRow}>
            <ThemedText style={[styles.endpointLabel, { color: mutedColor }]}>
              Serveur actif
            </ThemedText>
            <ThemedText style={styles.endpointText}>{authUrl}</ThemedText>
          </View>
        </ThemedView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor }]}
            onPress={handleCancel}
          >
            <ThemedText style={styles.actionText}>Annuler</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: tintColor }]}
            onPress={handleApply}
          >
            <ThemedText style={[styles.actionText, { color: buttonTextColor }]}>
              Appliquer
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
    gap: 24,
  },
  header: {
    gap: 6,
  },
  subtitle: {
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  endpointRow: {
    gap: 4,
  },
  endpointLabel: {
    fontSize: 12,
  },
  endpointText: {
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
