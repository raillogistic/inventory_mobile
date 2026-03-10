import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useReconciliationStatus } from '@/lib/graphql/reconciliation-hooks';

type StatusSectionProps = {
  campaignId: string | null;
};

export function StatusSection({ campaignId }: StatusSectionProps) {
  const { status, loading, error, errorMessage } = useReconciliationStatus(campaignId ?? '', 5000);

  if (!campaignId) return null;

  if (loading && !status) {
    const textColor = useThemeColor({}, 'text');
    return <ActivityIndicator style={styles.loader} color={textColor} />;
  }

  if (error) {
    return <ThemedText style={styles.error}>{errorMessage}</ThemedText>;
  }

  return (
    <View style={styles.container}>
      <StatusCard 
        label="Codes Validés" 
        value={status?.validatedCodes ?? 0} 
        color="#2196F3" 
      />
      <StatusCard 
        label="Articles Uniques" 
        value={status?.uniqueArticles ?? 0} 
        color="#4CAF50" 
      />
      <StatusCard 
        label="Conflits en Attente" 
        value={status?.pendingConflicts ?? 0} 
        color="#FFC107" 
      />
    </View>
  );
}

function StatusCard({ label, value, color }: { label: string, value: number, color: string }) {
    const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'icon');

    return (
        <View style={[styles.card, { borderLeftColor: color, borderColor }]}>
            <ThemedText style={styles.cardValue} type="title">{value}</ThemedText>
            <ThemedText style={styles.cardLabel}>{label}</ThemedText>
        </View>
    )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 10,
  },
  loader: {
    marginVertical: 20,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    margin: 20,
  },
  card: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderLeftWidth: 5,
    alignItems: 'center',
  },
  cardValue: {
    marginBottom: 5,
  },
  cardLabel: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
});
