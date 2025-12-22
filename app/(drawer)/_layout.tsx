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
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";

/**
 * Palette de couleurs premium pour le design.
 * Cohérente avec les écrans de l'application.
 */
const COLORS = {
  /** Dégradé principal - du bleu profond au violet */
  gradient_start: "#0A1628",
  gradient_mid: "#1A237E",
  gradient_end: "#311B92",
  /** Accents */
  accent_primary: "#FF6B00",
  accent_secondary: "#FF8F3F",
  /** Surfaces glassmorphism */
  glass_bg: "rgba(255, 255, 255, 0.08)",
  glass_border: "rgba(255, 255, 255, 0.15)",
  /** Textes */
  text_primary: "#FFFFFF",
  text_secondary: "rgba(255, 255, 255, 0.7)",
  text_muted: "rgba(255, 255, 255, 0.5)",
  /** Drawer */
  drawer_bg: "#0A1628",
  drawer_active_bg: "rgba(255, 107, 0, 0.15)",
  drawer_item_border: "rgba(255, 255, 255, 0.08)",
} as const;

/**
 * Mise en page du drawer qui expose l'écran d'accueil et l'action de déconnexion.
 * Utilise un design premium avec glassmorphism et dégradés.
 */
export default function DrawerLayout() {
  const { clearAuthSession } = useAuth();
  const { isHydrated, isScanSyncing, isSyncing, syncScans } =
    useInventoryOffline();
  const router = useRouter();
  const shouldShowSyncIndicator = !isHydrated || isSyncing || isScanSyncing;

  /** Efface les tokens d'auth et retourne à l'écran de connexion. */
  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    router.replace("/(auth)/login");
  }, [clearAuthSession, router]);

  /** Affiche un toast ou une alerte pour le feedback de synchronisation. */
  const showSyncMessage = useCallback((message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert("Synchronisation", message);
  }, []);

  /** Envoie les enregistrements de scans en attente vers le backend. */
  const handleSyncScans = useCallback(async () => {
    if (isScanSyncing) {
      return;
    }

    try {
      const summary = await syncScans();
      if (summary.totalCount === 0) {
        showSyncMessage("Aucun scan à synchroniser.");
        return;
      }

      if (summary.failedCount === 0) {
        showSyncMessage(`${summary.syncedCount} scan(s) synchronisés.`);
        return;
      }

      showSyncMessage(
        `${summary.syncedCount}/${summary.totalCount} scans synchronisés.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La synchronisation des scans a échoué.";
      showSyncMessage(message);
    }
  }, [isScanSyncing, showSyncMessage, syncScans]);

  /** Rend les actions d'en-tête pour le statut de sync et la sync manuelle. */
  const renderHeaderActions = useCallback(() => {
    return (
      <View style={styles.header_actions}>
        {shouldShowSyncIndicator && (
          <View style={styles.sync_indicator}>
            <ActivityIndicator size="small" color={COLORS.accent_primary} />
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.sync_button,
            isScanSyncing && styles.sync_button_disabled,
          ]}
          onPress={handleSyncScans}
          disabled={isScanSyncing}
          accessibilityRole="button"
          accessibilityLabel="Synchroniser les scans"
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              isScanSyncing
                ? ["#4A4A4A", "#3A3A3A"]
                : [COLORS.accent_primary, COLORS.accent_secondary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sync_button_gradient}
          >
            <IconSymbol
              name="arrow.clockwise"
              size={14}
              color={COLORS.text_primary}
            />
            <Text style={styles.sync_button_text}>
              {isScanSyncing ? "Sync..." : "Sync"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [handleSyncScans, isScanSyncing, shouldShowSyncIndicator]);

  /** Rend le contenu du drawer avec une action de déconnexion explicite. */
  const renderDrawerContent = useCallback(
    (props: DrawerContentComponentProps) => (
      <View style={styles.drawer_container}>
        <LinearGradient
          colors={[
            COLORS.gradient_start,
            COLORS.gradient_mid,
            COLORS.gradient_end,
          ]}
          style={styles.drawer_gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* En-tête du drawer */}
        <View style={styles.drawer_header}>
          <View style={styles.drawer_header_icon}>
            <IconSymbol
              name="shippingbox.fill"
              size={28}
              color={COLORS.accent_primary}
            />
          </View>
          <View style={styles.drawer_header_text}>
            <Text style={styles.drawer_header_title}>Inventaire</Text>
            <Text style={styles.drawer_header_subtitle}>Rail Logistic</Text>
          </View>
        </View>

        {/* Séparateur */}
        <View style={styles.drawer_separator}>
          <LinearGradient
            colors={["transparent", COLORS.accent_primary, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.drawer_separator_gradient}
          />
        </View>

        {/* Liste des éléments du drawer */}
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={styles.drawer_scroll_content}
        >
          <DrawerItemList {...props} />

          {/* Séparateur avant déconnexion */}
          <View style={styles.drawer_logout_separator} />

          <DrawerItem
            label="Déconnexion"
            labelStyle={styles.drawer_logout_label}
            onPress={handleLogout}
            icon={() => (
              <IconSymbol
                name="rectangle.portrait.and.arrow.right"
                size={20}
                color={COLORS.text_muted}
              />
            )}
            style={styles.drawer_logout_item}
          />
        </DrawerContentScrollView>

        {/* Footer du drawer */}
        <View style={styles.drawer_footer}>
          <Text style={styles.drawer_footer_text}>
            © 2025 Rail Logistic SPA
          </Text>
        </View>
      </View>
    ),
    [handleLogout]
  );

  return (
    <Drawer
      drawerContent={renderDrawerContent}
      initialRouteName="lieux"
      screenOptions={{
        headerShown: true,
        headerTintColor: COLORS.text_primary,
        headerTitleStyle: styles.header_title_style,
        headerStyle: styles.header_style,
        headerRight: renderHeaderActions,
        drawerActiveTintColor: COLORS.accent_primary,
        drawerInactiveTintColor: COLORS.text_secondary,
        drawerActiveBackgroundColor: COLORS.drawer_active_bg,
        drawerLabelStyle: styles.drawer_label,
        drawerItemStyle: styles.drawer_item,
        drawerStyle: styles.drawer_style,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "Campagnes",
          drawerIcon: ({ color }) => (
            <IconSymbol name="folder.fill" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="groupes"
        options={{
          title: "Groupes",
          drawerIcon: ({ color }) => (
            <IconSymbol name="rectangle.stack.fill" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="lieux"
        options={{
          title: "Lieux",
          drawerIcon: ({ color }) => (
            <IconSymbol name="mappin.and.ellipse" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="scan"
        options={{
          title: "Scan",
          drawerIcon: ({ color }) => (
            <IconSymbol name="barcode.viewfinder" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="articles-sync"
        options={{
          title: "Articles à synchroniser",
          drawerIcon: ({ color }) => (
            <IconSymbol
              name="arrow.triangle.2.circlepath"
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="listes"
        options={{
          title: "Listes",
          drawerIcon: ({ color }) => (
            <IconSymbol
              name="list.bullet.rectangle.fill"
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="recap"
        options={{
          title: "Récap",
          drawerIcon: ({ color }) => (
            <IconSymbol name="chart.bar.fill" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="history"
        options={{
          title: "Historique",
          drawerIcon: ({ color }) => (
            <IconSymbol name="clock.arrow.circlepath" size={20} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}

/**
 * Styles pour le DrawerLayout.
 * Utilise un design premium avec glassmorphism et dégradés.
 */
const styles = StyleSheet.create({
  /* En-tête - Design premium solide */
  header_style: {
    backgroundColor: COLORS.gradient_start,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glass_border,
  },
  header_title_style: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text_primary,
    letterSpacing: -0.3,
  },
  header_actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 16,
  },
  sync_indicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sync_button: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sync_button_disabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  sync_button_gradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sync_button_text: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text_primary,
    letterSpacing: 0.3,
  },
  /* Drawer */
  drawer_style: {
    backgroundColor: "transparent",
    width: 300,
  },
  drawer_container: {
    flex: 1,
    backgroundColor: COLORS.drawer_bg,
  },
  drawer_gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer_header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  drawer_header_icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255, 107, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  drawer_header_text: {
    flex: 1,
  },
  drawer_header_title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text_primary,
    letterSpacing: -0.5,
  },
  drawer_header_subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text_muted,
    marginTop: 2,
  },
  drawer_separator: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  drawer_separator_gradient: {
    flex: 1,
    height: 1,
  },
  drawer_scroll_content: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  drawer_label: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: -8,
  },
  drawer_item: {
    borderRadius: 12,
    marginVertical: 2,
    paddingVertical: 4,
  },
  drawer_logout_separator: {
    height: 1,
    backgroundColor: COLORS.drawer_item_border,
    marginHorizontal: 12,
    marginVertical: 12,
  },
  drawer_logout_item: {
    borderRadius: 12,
    marginVertical: 2,
  },
  drawer_logout_label: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text_muted,
    marginLeft: -8,
  },
  drawer_footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.drawer_item_border,
  },
  drawer_footer_text: {
    fontSize: 11,
    color: COLORS.text_muted,
    textAlign: "center",
  },
});
