import React, { useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useComptageSession } from "@/hooks/use-comptage-session";
import { useInventoryRecap } from "@/hooks/use-inventory-recap";
import { useThemeColor } from "@/hooks/use-theme-color";
import { buildCsv, type CsvHeader, type CsvRow } from "@/lib/inventory/recap-csv";

/** Props for a single positive variance row. */
type EcartPositiveRowProps = {
  /** Scanned code. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Location label where it was scanned. */
  locationName: string;
  /** Expected locations for the article. */
  expectedLocations: string[];
  /** Muted text color. */
  mutedColor: string;
};

/**
 * Render a single positive variance row.
 */
function EcartPositiveRow({
  code,
  description,
  locationName,
  expectedLocations,
  mutedColor,
}: EcartPositiveRowProps) {
  return (
    <View style={styles.row}>
      <ThemedText type="defaultSemiBold">{code}</ThemedText>
      {description ? (
        <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
          {description}
        </ThemedText>
      ) : null}
      <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
        Lieu scanne: {locationName}
      </ThemedText>
      {expectedLocations.length > 0 ? (
        <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
          Lieux attendus: {expectedLocations.join(", ")}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Ecart positif screen (scanned but not expected in location).
 */
export default function EcartPositifScreen() {
  const router = useRouter();
  const { session } = useComptageSession();
  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const { ecartPositive, loading, errorMessage, refresh } = useInventoryRecap(
    campaignId,
    groupId
  );

  const borderColor = useThemeColor(
    { light: "#E2E8F0", dark: "#2B2E35" },
    "icon"
  );
  const surfaceColor = useThemeColor(
    { light: "#FFFFFF", dark: "#1F232B" },
    "background"
  );
  const highlightColor = useThemeColor(
    { light: "#2563EB", dark: "#60A5FA" },
    "tint"
  );
  const mutedColor = useThemeColor(
    { light: "#64748B", dark: "#94A3B8" },
    "icon"
  );

  /** Export ecart positif as CSV. */
  const handleExportCsv = useCallback(async () => {
    const headers: CsvHeader[] = [
      { key: "location", label: "Lieu scanne" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "expected", label: "Lieux attendus" },
    ];
    const rows: CsvRow[] = ecartPositive.map((item) => ({
      location: item.locationName,
      code: item.code,
      description: item.description ?? "",
      expected: item.expectedLocations.join(" | "),
    }));
    const csv = buildCsv(headers, rows);
    await Share.share({
      title: "ecart-positif.csv",
      message: csv,
    });
  }, [ecartPositive]);

  /** Refresh the recap data. */
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const hasGroupSelection = Boolean(campaignId && groupId);

  if (!hasGroupSelection) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <ThemedText type="title">Selection incomplete</ThemedText>
          <ThemedText style={[styles.missingText, { color: mutedColor }]}>
            Choisissez une campagne et un groupe pour voir l'ecart positif.
          </ThemedText>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: highlightColor }]}
            onPress={() => router.push("/(drawer)/groupes")}
          >
            <ThemedText style={styles.primaryButtonText}>
              Choisir un groupe
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title">Ecart positif</ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
            Groupe: {session.group?.nom}
          </ThemedText>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor }]}
            onPress={handleRefresh}
          >
            <ThemedText style={styles.actionButtonText}>Actualiser</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor }]}
            onPress={handleExportCsv}
          >
            <ThemedText style={styles.actionButtonText}>Exporter CSV</ThemedText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={highlightColor} />
            <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
              Chargement de l'ecart positif...
            </ThemedText>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorTitle}>
              Impossible de charger l'ecart positif.
            </ThemedText>
            <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
              {errorMessage}
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.card, { borderColor, backgroundColor: surfaceColor }]}>
          {ecartPositive.length > 0 ? (
            ecartPositive.map((item) => (
              <EcartPositiveRow
                key={`${item.locationId}-${item.code}`}
                code={item.code}
                description={item.description}
                locationName={item.locationName}
                expectedLocations={item.expectedLocations}
                mutedColor={mutedColor}
              />
            ))
          ) : (
            <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
              Aucun ecart positif.
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    gap: 6,
  },
  subtitle: {
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorMessage: {
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  row: {
    gap: 4,
  },
  rowMeta: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 13,
  },
  missingContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  missingText: {
    fontSize: 14,
    textAlign: "center",
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
