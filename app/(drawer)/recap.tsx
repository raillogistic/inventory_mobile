import React, { useCallback, useMemo } from "react";
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

/** Props for a single scan row in the recap list. */
type ScanRowProps = {
  /** Article code scanned. */
  code: string;
  /** Optional article description. */
  description: string | null;
  /** Optional scan state. */
  etat: string | null;
  /** Optional capture timestamp. */
  capturedAt: string | null;
  /** Muted text color for metadata. */
  mutedColor: string;
};

/**
 * Render a single scan row for the recap list.
 */
function ScanRow({
  code,
  description,
  etat,
  capturedAt,
  mutedColor,
}: ScanRowProps) {
  return (
    <View style={styles.row}>
      <ThemedText type="defaultSemiBold">{code}</ThemedText>
      {description ? (
        <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.rowMetaRow}>
        {etat ? (
          <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
            Etat: {etat}
          </ThemedText>
        ) : null}
        {capturedAt ? (
          <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
            Capture: {capturedAt}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Recap screen with scans grouped by location and missing articles.
 */
export default function RecapScreen() {
  const router = useRouter();
  const { session } = useComptageSession();
  const campaignId = session.campaign?.id ?? null;
  const groupId = session.group?.id ?? null;
  const { scansByLocation, missingArticles, loading, errorMessage, refresh } =
    useInventoryRecap(campaignId, groupId);

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

  /** Export scanned articles as CSV. */
  const handleExportCsv = useCallback(async () => {
    const headers: CsvHeader[] = [
      { key: "location", label: "Lieu" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "etat", label: "Etat" },
      { key: "capturedAt", label: "Capture" },
    ];

    const rows: CsvRow[] = scansByLocation.flatMap((group) =>
      group.scans.map((scan) => ({
        location: group.locationName,
        code: scan.code,
        description: scan.description ?? "",
        etat: scan.etat ?? "",
        capturedAt: scan.capturedAt ?? "",
      }))
    );

    const csv = buildCsv(headers, rows);
    await Share.share({
      title: "recap-scans.csv",
      message: csv,
    });
  }, [scansByLocation]);

  /** Refresh the recap data. */
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const hasGroupSelection = Boolean(campaignId && groupId);
  const hasMissing = missingArticles.length > 0;

  const missingRows = useMemo(
    () =>
      missingArticles.map((item) => (
        <View
          key={`${item.locationId}-${item.code}-${item.capturedAt ?? "x"}`}
          style={[styles.row, { borderColor }]}
        >
          <ThemedText type="defaultSemiBold">{item.code}</ThemedText>
          <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
            Lieu: {item.locationName}
          </ThemedText>
          {item.capturedAt ? (
            <ThemedText style={[styles.rowMeta, { color: mutedColor }]}>
              Capture: {item.capturedAt}
            </ThemedText>
          ) : null}
        </View>
      )),
    [borderColor, missingArticles, mutedColor]
  );

  if (!hasGroupSelection) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.missingContainer}>
          <ThemedText type="title">Selection incomplete</ThemedText>
          <ThemedText style={[styles.missingText, { color: mutedColor }]}>
            Choisissez une campagne et un groupe pour voir le recap.
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
          <ThemedText type="title">Recap</ThemedText>
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
              Chargement du recap...
            </ThemedText>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorTitle}>
              Impossible de charger le recap.
            </ThemedText>
            <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
              {errorMessage}
            </ThemedText>
          </View>
        ) : null}

        {scansByLocation.map((group) => (
          <View key={group.locationId} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle">{group.locationName}</ThemedText>
              <ThemedText style={[styles.sectionMeta, { color: mutedColor }]}>
                {group.scans.length} scans
              </ThemedText>
            </View>
            <View style={[styles.card, { borderColor, backgroundColor: surfaceColor }]}>
              {group.scans.map((scan) => (
                <ScanRow
                  key={`${scan.id}-${scan.code}`}
                  code={scan.code}
                  description={scan.description}
                  etat={scan.etat}
                  capturedAt={scan.capturedAt}
                  mutedColor={mutedColor}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Articles inconnus</ThemedText>
            <ThemedText style={[styles.sectionMeta, { color: mutedColor }]}>
              {missingArticles.length}
            </ThemedText>
          </View>
          <View style={[styles.card, { borderColor, backgroundColor: surfaceColor }]}>
            {hasMissing ? (
              missingRows
            ) : (
              <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
                Aucun article inconnu.
              </ThemedText>
            )}
          </View>
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
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionMeta: {
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  row: {
    gap: 4,
  },
  rowMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
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
