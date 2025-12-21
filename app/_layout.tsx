import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthGate } from "@/components/auth/auth-gate";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/providers/auth-provider";
import { ApolloProviderWithAuth } from "@/providers/apollo-provider";
import { ComptageSessionProvider } from "@/providers/comptage-session-provider";
import { InventoryOfflineProvider } from "@/providers/inventory-offline-provider";

export const unstable_settings = {
  anchor: "(drawer)",
};

/**
 * Root layout with theme, authentication, and Apollo providers.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ComptageSessionProvider>
        <ApolloProviderWithAuth>
          <InventoryOfflineProvider>
            <ThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <AuthGate>
                <Stack>
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="(drawer)"
                    options={{ headerShown: false }}
                  />
                </Stack>
              </AuthGate>
              <StatusBar style="auto" />
            </ThemeProvider>
          </InventoryOfflineProvider>
        </ApolloProviderWithAuth>
      </ComptageSessionProvider>
    </AuthProvider>
  );
}
