import React from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useConflicts } from '@/lib/graphql/reconciliation-hooks';

type ConflictListProps = {
  campaignId: string | null;
};

export function ConflictList({ campaignId }: ConflictListProps) {
  const { conflicts, loading, error, errorMessage } = useConflicts(campaignId ?? '');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'icon');

  if (!campaignId) return null;

  if (loading && conflicts.length === 0) {
    return <ActivityIndicator style={styles.loader} color={textColor} />;
  }

  if (error) {
    return <ThemedText style={styles.error}>{errorMessage}</ThemedText>;
  }

  if (conflicts.length === 0) {
    return (
        <View style={styles.emptyContainer}>
            <ThemedText>Aucun conflit en attente.</ThemedText>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.header}>Conflits à résoudre</ThemedText>
      <FlatList
        data={conflicts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.item, { borderColor }]}>
            <View style={styles.itemContent}>
                <ThemedText type="defaultSemiBold">{item.articleCode}</ThemedText>
                <ThemedText style={styles.desc}>{item.description || 'Pas de description'}</ThemedText>
            </View>
            <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>Scan par Groupe C</ThemedText>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 10,
  },
  loader: {
    marginTop: 20,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  desc: {
    fontSize: 12,
    opacity: 0.7,
  },
  badge: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
});
