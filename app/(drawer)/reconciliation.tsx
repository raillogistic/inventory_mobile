import React, { useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { CampaignSelector } from '@/components/reconciliation/CampaignSelector';
import { StatusSection } from '@/components/reconciliation/StatusSection';
import { ConflictList } from '@/components/reconciliation/ConflictList';
import { ActionsSection } from '@/components/reconciliation/ActionsSection';

export default function ReconciliationScreen() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>("2"); // Default to "2"

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Contrôle & Rapprochement' }} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CampaignSelector 
          selectedCampaignId={selectedCampaignId} 
          onSelectCampaign={setSelectedCampaignId} 
        />
        
        <StatusSection campaignId={selectedCampaignId} />
        
        <ConflictList campaignId={selectedCampaignId} />
        
        <ActionsSection campaignId={selectedCampaignId} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
});
