import React, { useCallback, useRef, useState } from "react";
import { Drawer } from "expo-router/drawer";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  DrawerToggleButton,
} from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  CameraView,
  type BarcodeScanningResult,
  type BarcodeType,
  useCameraPermissions,
} from "expo-camera";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useInventoryOffline } from "@/hooks/use-inventory-offline";
import type { OfflineArticleEntry } from "@/lib/graphql/inventory-operations";
import { loadInventoryArticleByCode } from "@/lib/offline/inventory-offline-storage";

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

const QUICK_LOOKUP_BARCODE_TYPES: BarcodeType[] = [
  "code128",
  "code39",
  "code93",
  "ean13",
  "ean8",
  "itf14",
  "upc_a",
  "upc_e",
  "codabar",
];

/** Drawer routes hidden from the navigation menu. */
const HIDDEN_DRAWER_ROUTE_NAMES = new Set<string>([
  "lieux/[parentId]",
  "lieux/_location-level",
  "ecart-positif",
]);

/** Minimum screen width for showing header action labels. */
const HEADER_ACTION_TEXT_MIN_WIDTH = 600;

/**
 * Mise en page du drawer qui expose l'écran d'accueil et l'action de déconnexion.
 * Utilise un design premium avec glassmorphism et dégradés.
 */
export default function DrawerLayout() {
  /** Current screen width for responsive header actions. */
  const { width: screenWidth } = useWindowDimensions();
  const { clearAuthSession } = useAuth();
  const { isHydrated, isScanSyncing, isSyncing, syncScans } =
    useInventoryOffline();
  const router = useRouter();
  const shouldShowSyncIndicator = !isHydrated || isSyncing || isScanSyncing;
  const shouldShowQuickLookup = true;
  const shouldShowQuickLookupText = screenWidth >= HEADER_ACTION_TEXT_MIN_WIDTH;
  const shouldShowSyncText = screenWidth >= HEADER_ACTION_TEXT_MIN_WIDTH;
  const [quickLookupCameraPermission, requestQuickLookupCameraPermission] =
    useCameraPermissions();
  const quickLookupScanLockRef = useRef(false);
  const isQuickLookupCameraAllowed =
    quickLookupCameraPermission?.granted ?? false;
  const canRequestQuickLookupCamera =
    quickLookupCameraPermission?.canAskAgain ?? true;
  /** Tracks visibility for the quick article lookup modal. */
  const [isQuickLookupVisible, setIsQuickLookupVisible] = useState(false);
  /** Tracks the current search code for the quick lookup modal. */
  const [quickLookupCode, setQuickLookupCode] = useState("");
  /** Holds the article details returned from SQLite. */
  const [quickLookupResult, setQuickLookupResult] =
    useState<OfflineArticleEntry | null>(null);
  /** Tracks errors surfaced while loading the quick lookup result. */
  const [quickLookupError, setQuickLookupError] = useState<string | null>(null);
  /** Tracks loading state for the quick lookup action. */
  const [quickLookupLoading, setQuickLookupLoading] = useState(false);

  /** Efface les tokens d'auth et retourne à l'écran de connexion. */
  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    router.replace("/(auth)/login");
  }, [clearAuthSession, router]);

  /** Open the quick article lookup modal. */
  const handleOpenQuickLookup = useCallback(() => {
    setQuickLookupCode("");
    setQuickLookupResult(null);
    setQuickLookupError(null);
    setIsQuickLookupVisible(true);
    quickLookupScanLockRef.current = false;
    if (!isQuickLookupCameraAllowed && canRequestQuickLookupCamera) {
      void requestQuickLookupCameraPermission();
    }
  }, [
    canRequestQuickLookupCamera,
    isQuickLookupCameraAllowed,
    requestQuickLookupCameraPermission,
  ]);

  /** Close the quick article lookup modal and reset state. */
  const handleCloseQuickLookup = useCallback(() => {
    setIsQuickLookupVisible(false);
    setQuickLookupCode("");
    setQuickLookupResult(null);
    setQuickLookupError(null);
    setQuickLookupLoading(false);
    quickLookupScanLockRef.current = false;
  }, []);

  /** Update the search code for the quick lookup modal. */
  const handleQuickLookupCodeChange = useCallback((value: string) => {
    setQuickLookupCode(value);
    setQuickLookupError(null);
  }, []);

  /** Request camera permission for the quick lookup modal. */
  const handleRequestQuickLookupCamera = useCallback(async () => {
    if (isQuickLookupCameraAllowed || !canRequestQuickLookupCamera) {
      return;
    }

    const response = await requestQuickLookupCameraPermission();
    if (response.granted) {
      quickLookupScanLockRef.current = false;
    }
  }, [
    canRequestQuickLookupCamera,
    isQuickLookupCameraAllowed,
    requestQuickLookupCameraPermission,
  ]);

  /** Load the article details from SQLite for the provided code. */
  const performQuickLookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setQuickLookupError("Le code est requis.");
      setQuickLookupResult(null);
      return;
    }

    setQuickLookupCode(trimmed);
    Keyboard.dismiss();
    setQuickLookupLoading(true);
    setQuickLookupError(null);
    setQuickLookupResult(null);
    try {
      const result = await loadInventoryArticleByCode(trimmed);
      if (!result) {
        setQuickLookupError("Article introuvable.");
        setQuickLookupResult(null);
        return;
      }

      setQuickLookupResult(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Recherche impossible.";
      setQuickLookupError(message);
      setQuickLookupResult(null);
    } finally {
      setQuickLookupLoading(false);
    }
  }, []);

  /** Trigger the quick lookup using the current code value. */
  const handleQuickLookupSubmit = useCallback(async () => {
    await performQuickLookup(quickLookupCode);
  }, [performQuickLookup, quickLookupCode]);

  /** Reset the quick lookup state to scan again. */
  const handleQuickLookupReset = useCallback(() => {
    quickLookupScanLockRef.current = false;
    setQuickLookupCode("");
    setQuickLookupResult(null);
    setQuickLookupError(null);
  }, []);

  /** Handle barcode scans for the quick lookup camera. */
  const handleQuickLookupBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (
        !isQuickLookupVisible ||
        quickLookupScanLockRef.current ||
        quickLookupLoading ||
        !isQuickLookupCameraAllowed
      ) {
        return;
      }

      const scannedCode = result.data?.trim();
      if (!scannedCode) {
        return;
      }

      quickLookupScanLockRef.current = true;
      setQuickLookupCode(scannedCode);
      void performQuickLookup(scannedCode);
    },
    [
      isQuickLookupCameraAllowed,
      isQuickLookupVisible,
      performQuickLookup,
      quickLookupLoading,
    ]
  );

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

      const errorSummary =
        summary.errors && summary.errors.length > 0
          ? ` (${summary.errors.slice(0, 2).join(" | ")}${
              summary.errors.length > 2 ? " +..." : ""
            })`
          : "";
      showSyncMessage(
        `${summary.syncedCount}/${summary.totalCount} scans synchronisés.${errorSummary}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La synchronisation des scans a échoué.";
      showSyncMessage(message);
    }
  }, [isScanSyncing, showSyncMessage, syncScans]);
  /** Render the left header actions (drawer toggle). */
  const renderHeaderLeft = useCallback(() => {
    return (
      <View style={styles.header_left_actions}>
        <DrawerToggleButton tintColor={COLORS.text_primary} />
      </View>
    );
  }, []);

  /** Rend les actions d'en-tête pour le statut de sync et la sync manuelle. */
  const renderHeaderActions = useCallback(() => {
    return (
      <View style={styles.header_actions}>
        {shouldShowSyncIndicator && (
          <View style={styles.sync_indicator}>
            <ActivityIndicator size="small" color={COLORS.accent_primary} />
          </View>
        )}
        {shouldShowQuickLookup && (
          <TouchableOpacity
            style={styles.quick_lookup_button}
            onPress={handleOpenQuickLookup}
            accessibilityRole="button"
            accessibilityLabel="Consulter un article"
            activeOpacity={0.8}
          >
            <IconSymbol name="eye" size={16} color={COLORS.text_primary} />
            {shouldShowQuickLookupText && (
              <Text style={styles.quick_lookup_text}>VOIR ARTICLE</Text>
            )}
          </TouchableOpacity>
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
            {shouldShowSyncText && (
              <Text style={styles.sync_button_text}>
                {isScanSyncing
                  ? "T\u00e9l\u00e9chargement..."
                  : "T\u00e9l\u00e9charger sur le serveur"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [
    handleOpenQuickLookup,
    handleSyncScans,
    isScanSyncing,
    shouldShowQuickLookup,
    shouldShowQuickLookupText,
    shouldShowSyncText,
    shouldShowSyncIndicator,
  ]);
  /** Render the quick article lookup modal overlay. */
  const renderQuickLookupModal = useCallback(() => {
    const locationNames =
      quickLookupResult?.locations
        .map((location) => location.locationname)
        .join(", ") ?? "";
    const currentLocationName =
      quickLookupResult?.currentLocation?.locationname ?? "Non defini";
    const serialNumber = quickLookupResult?.serialnumber ?? "Non renseigne";

    return (
      <Modal
        visible={isQuickLookupVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseQuickLookup}
      >
        <View style={styles.quick_lookup_overlay}>
          <View style={styles.quick_lookup_card}>
            <View style={styles.quick_lookup_header}>
              <Text style={styles.quick_lookup_title}>Recherche article</Text>
              <Pressable
                onPress={handleCloseQuickLookup}
                accessibilityRole="button"
                accessibilityLabel="Fermer la recherche"
              >
                <IconSymbol
                  name="chevron.right"
                  size={18}
                  color={COLORS.text_primary}
                />
              </Pressable>
            </View>
            <View style={styles.quick_lookup_camera_container}>
              {isQuickLookupCameraAllowed ? (
                <CameraView
                  style={styles.quick_lookup_camera_view}
                  barcodeScannerSettings={{
                    barcodeTypes: QUICK_LOOKUP_BARCODE_TYPES,
                  }}
                  onBarcodeScanned={handleQuickLookupBarcode}
                >
                  <View style={styles.quick_lookup_camera_overlay}>
                    <Text style={styles.quick_lookup_camera_text}>
                      Scanner le code-barres
                    </Text>
                  </View>
                </CameraView>
              ) : (
                <View style={styles.quick_lookup_camera_placeholder}>
                  <Text style={styles.quick_lookup_camera_text}>
                    Autoriser la camera pour scanner.
                  </Text>
                  {canRequestQuickLookupCamera ? (
                    <TouchableOpacity
                      style={styles.quick_lookup_camera_button}
                      onPress={handleRequestQuickLookupCamera}
                      accessibilityRole="button"
                      accessibilityLabel="Autoriser la camera"
                    >
                      <Text style={styles.quick_lookup_camera_button_text}>
                        Autoriser la camera
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
            <Text style={styles.quick_lookup_label}>Code article</Text>
            <View style={styles.quick_lookup_input_row}>
              <TextInput
                style={styles.quick_lookup_input}
                value={quickLookupCode}
                onChangeText={handleQuickLookupCodeChange}
                placeholder="Code scanne ou saisir"
                placeholderTextColor={COLORS.text_muted}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                editable={!quickLookupLoading}
                onSubmitEditing={handleQuickLookupSubmit}
              />
              <TouchableOpacity
                style={[
                  styles.quick_lookup_action,
                  quickLookupLoading && styles.quick_lookup_action_disabled,
                ]}
                onPress={handleQuickLookupSubmit}
                disabled={quickLookupLoading}
                accessibilityRole="button"
                accessibilityLabel="Rechercher l'article"
              >
                <Text style={styles.quick_lookup_action_text}>Rechercher</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.quick_lookup_reset_row}>
              <TouchableOpacity
                onPress={handleQuickLookupReset}
                accessibilityRole="button"
                accessibilityLabel="Scanner a nouveau"
                style={[
                  styles.quick_lookup_action,
                  quickLookupLoading && styles.quick_lookup_action_disabled,
                ]}
              >
                <Text style={styles.quick_lookup_reset_text}>
                  Scanner a nouveau
                </Text>
              </TouchableOpacity>
            </View>
            {quickLookupLoading ? (
              <View style={styles.quick_lookup_loading}>
                <ActivityIndicator size="small" color={COLORS.accent_primary} />
              </View>
            ) : null}
            {quickLookupError ? (
              <Text style={styles.quick_lookup_error}>{quickLookupError}</Text>
            ) : null}
            {quickLookupResult ? (
              <ScrollView style={styles.quick_lookup_details}>
                <Text style={styles.quick_lookup_detail_line}>
                  Code: {quickLookupResult.code}
                </Text>
                <Text style={styles.quick_lookup_detail_line}>
                  Description: {quickLookupResult.desc ?? "Non renseigne"}
                </Text>
                <Text style={styles.quick_lookup_detail_line}>
                  Numero de serie: {serialNumber}
                </Text>
                <Text style={styles.quick_lookup_detail_line}>
                  Lieu actuel: {currentLocationName}
                </Text>
                <Text style={styles.quick_lookup_detail_line}>
                  Lieux affectes: {locationNames || "Aucun lieu"}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  }, [
    canRequestQuickLookupCamera,
    handleCloseQuickLookup,
    handleQuickLookupBarcode,
    handleQuickLookupCodeChange,
    handleQuickLookupReset,
    handleQuickLookupSubmit,
    handleRequestQuickLookupCamera,
    isQuickLookupCameraAllowed,
    isQuickLookupVisible,
    quickLookupCode,
    quickLookupError,
    quickLookupLoading,
    quickLookupResult,
  ]);

  /** Rend le contenu du drawer avec une action de déconnexion explicite. */
  const renderDrawerContent = useCallback(
    (props: DrawerContentComponentProps) => {
      const visibleRoutes = props.state.routes.filter(
        (route) => !HIDDEN_DRAWER_ROUTE_NAMES.has(route.name)
      );
      const activeRouteName =
        props.state.routes[props.state.index]?.name ?? null;
      const activeIndex = visibleRoutes.findIndex(
        (route) => route.name === activeRouteName
      );
      const drawerState = {
        ...props.state,
        routes: visibleRoutes,
        index: activeIndex >= 0 ? activeIndex : 0,
      };

      return (
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
              <Text style={styles.drawer_header_subtitle}>
                Rail Logistic v1.0.7
              </Text>
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
            <DrawerItemList {...props} state={drawerState} />

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
              © 2025 Rail Logistic SPA v1.0.5
            </Text>
          </View>
        </View>
      );
    },
    [handleLogout]
  );

  return (
    <>
      <Drawer
        drawerContent={renderDrawerContent}
        initialRouteName="lieux"
        screenOptions={{
          headerShown: true,
          headerTintColor: COLORS.text_primary,
          headerTitleStyle: styles.header_title_style,
          headerStyle: styles.header_style,
          headerLeft: renderHeaderLeft,
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
          name="ecart-negatif"
          options={{
            title: "Ecart negatif",
            drawerIcon: ({ color }) => (
              <IconSymbol name="minus.circle.fill" size={20} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="ecart-positif"
          options={{
            title: "Ecart positif",
            drawerIcon: ({ color }) => (
              <IconSymbol name="plus.circle.fill" size={20} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="history"
          options={{
            title: "Historique",
            drawerIcon: ({ color }) => (
              <IconSymbol
                name="clock.arrow.circlepath"
                size={20}
                color={color}
              />
            ),
          }}
        />
      </Drawer>
      {renderQuickLookupModal()}
    </>
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
  header_left_actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 8,
  },
  quick_lookup_button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.glass_border,
    backgroundColor: COLORS.glass_bg,
  },
  quick_lookup_text: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text_primary,
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
  quick_lookup_overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 22, 40, 0.75)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  quick_lookup_card: {
    backgroundColor: COLORS.drawer_bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.glass_border,
  },
  quick_lookup_header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quick_lookup_title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text_primary,
  },
  quick_lookup_camera_container: {
    height: 200,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.glass_border,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    marginBottom: 12,
  },
  quick_lookup_camera_view: {
    flex: 1,
  },
  quick_lookup_camera_overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  quick_lookup_camera_text: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text_primary,
  },
  quick_lookup_camera_placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  quick_lookup_camera_button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.accent_primary,
  },
  quick_lookup_camera_button_text: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text_primary,
  },
  quick_lookup_label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text_secondary,
    marginBottom: 6,
  },
  quick_lookup_input_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quick_lookup_input: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.glass_bg,
    borderWidth: 1,
    borderColor: COLORS.glass_border,
    color: COLORS.text_primary,
  },
  quick_lookup_action: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.accent_primary,
  },
  quick_lookup_action_disabled: {
    opacity: 0.6,
  },
  quick_lookup_action_text: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text_primary,
  },
  quick_lookup_reset_row: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  quick_lookup_reset_text: {
    fontSize: 11,
    color: COLORS.text_secondary,
  },
  quick_lookup_loading: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  quick_lookup_error: {
    marginTop: 12,
    fontSize: 12,
    color: "#FCA5A5",
  },
  quick_lookup_details: {
    marginTop: 12,
    maxHeight: 220,
  },
  quick_lookup_detail_line: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginBottom: 8,
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
