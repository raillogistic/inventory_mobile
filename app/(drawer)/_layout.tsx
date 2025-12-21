import React, { useCallback } from "react";
import { Drawer } from "expo-router/drawer";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import { useThemeColor } from "@/hooks/use-theme-color";

/**
 * Drawer layout that exposes the home screen and logout action.
 */
export default function DrawerLayout() {
  const { clearAuthSession } = useAuth();
  const { isHydrated, isSyncing } = useInventoryOffline();
  const router = useRouter();
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const shouldShowSyncIndicator = !isHydrated || isSyncing;

  /** Clear auth tokens and return to the login screen. */
  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    router.replace("/(auth)/login");
  }, [clearAuthSession, router]);

  /** Render a header indicator while inventory data is loading. */
  const renderHeaderSyncIndicator = useCallback(() => {
    if (!shouldShowSyncIndicator) {
      return null;
    }

    return (
      <View style={styles.headerIndicator}>
        <ActivityIndicator size="small" color={tintColor} />
      </View>
    );
  }, [shouldShowSyncIndicator, tintColor]);

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
        headerRight: renderHeaderSyncIndicator,
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
        name="recap"
        options={{
          title: "Recap",
        }}
      />
      {/* <Drawer.Screen
        name="ecart-positif"
        options={{
          title: "Ecart positif",
        }}
      />
      <Drawer.Screen
        name="ecart-negatif"
        options={{
          title: "Ecart negatif",
        }}
      /> */}
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
  headerIndicator: {
    marginRight: 16,
  },
});
