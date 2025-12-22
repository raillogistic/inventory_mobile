import React, { useCallback } from "react";
import { Drawer } from "expo-router/drawer";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { useThemeColor } from "@/hooks/use-theme-color";

/**
 * Drawer layout that exposes the home screen and logout action.
 */
export default function DrawerLayout() {
  const { clearAuthSession } = useAuth();
  const { isHydrated, isScanSyncing, isSyncing, syncScans } =
    useInventoryOffline();
  const router = useRouter();
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const shouldShowSyncIndicator = !isHydrated || isSyncing || isScanSyncing;

  /** Clear auth tokens and return to the login screen. */
  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    router.replace("/(auth)/login");
  }, [clearAuthSession, router]);

  /** Display a toast or alert message for sync feedback. */
  const showSyncMessage = useCallback((message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert("Synchronisation", message);
  }, []);

  /** Upload pending scan records to the backend. */
  const handleSyncScans = useCallback(async () => {
    if (isScanSyncing) {
      return;
    }

    try {
      const summary = await syncScans();
      if (summary.totalCount === 0) {
        showSyncMessage("Aucun scan a synchroniser.");
        return;
      }

      if (summary.failedCount === 0) {
        showSyncMessage(`${summary.syncedCount} scan(s) synchronises.`);
        return;
      }

      showSyncMessage(
        `${summary.syncedCount}/${summary.totalCount} scans synchronises.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La synchronisation des scans a echoue.";
      showSyncMessage(message);
    }
  }, [isScanSyncing, showSyncMessage, syncScans]);

  /** Render header actions for sync status and manual sync. */
  const renderHeaderActions = useCallback(() => {
    return (
      <View style={styles.headerActions}>
        {shouldShowSyncIndicator ? (
          <ActivityIndicator size="small" color={tintColor} />
        ) : null}
        <TouchableOpacity
          style={[
            styles.syncButton,
            { borderColor: tintColor, opacity: isScanSyncing ? 0.6 : 1 },
          ]}
          onPress={handleSyncScans}
          disabled={isScanSyncing}
          accessibilityRole="button"
          accessibilityLabel="Synchroniser les scans"
        >
          <ThemedText style={[styles.syncButtonText, { color: tintColor }]}>
            {isScanSyncing ? "Sync..." : "Sync"}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }, [handleSyncScans, isScanSyncing, shouldShowSyncIndicator, tintColor]);

  /** Render the drawer content with an explicit logout action. */
  const renderDrawerContent = useCallback(
    (props: DrawerContentComponentProps) => (
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
        <DrawerItem
          label="Deconnexion"
          labelStyle={{ color: textColor }}
          onPress={handleLogout}
          activeTintColor={tintColor}
        />
      </DrawerContentScrollView>
    ),
    [handleLogout, textColor, tintColor]
  );

  return (
    <Drawer
      drawerContent={renderDrawerContent}
      initialRouteName="lieux"
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: tintColor,
        drawerLabelStyle: { color: textColor },
        headerRight: renderHeaderActions,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "Campagnes",
        }}
      />
      <Drawer.Screen
        name="groupes"
        options={{
          title: "Groupes",
        }}
      />
      <Drawer.Screen
        name="lieux"
        options={{
          title: "Lieux",
        }}
      />
      <Drawer.Screen
        name="scan"
        options={{
          title: "Scan",
        }}
      />
      <Drawer.Screen
        name="listes"
        options={{
          title: "Listes",
        }}
      />
      <Drawer.Screen
        name="recap"
        options={{
          title: "Recap",
        }}
      />
      <Drawer.Screen
        name="history"
        options={{
          title: "Historique",
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 16,
  },
  syncButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
