import React, { useCallback } from "react";
import { Drawer } from "expo-router/drawer";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from "@react-navigation/drawer";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";

/**
 * Drawer layout that exposes the home screen and logout action.
 */
export default function DrawerLayout() {
  const { clearAuthSession } = useAuth();
  const router = useRouter();
  const tintColor = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");

  /** Clear auth tokens and return to the login screen. */
  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    router.replace("/(auth)/login");
  }, [clearAuthSession, router]);

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
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: tintColor,
        drawerLabelStyle: { color: textColor },
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
    </Drawer>
  );
}
