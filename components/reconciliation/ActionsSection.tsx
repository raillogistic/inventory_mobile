import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useGenerateRapprochement } from '@/lib/graphql/reconciliation-hooks';

type ActionsSectionProps = {
  campaignId: string | null;
};

export function ActionsSection({ campaignId }: ActionsSectionProps) {
  const { submit, loading } = useGenerateRapprochement();
  const buttonColor = useThemeColor({}, 'tint');
  const infoBg = useThemeColor({ light: '#f0f0f0', dark: '#333' }, 'background');
  const infoText = useThemeColor({ light: '#333', dark: '#ccc' }, 'text');

  const handleGenerate = async () => {
    if (!campaignId) return;
    
    try {
        const result = await submit(campaignId);
        if (result?.generateRapprochement.ok) {
            Alert.alert("Succès", "Rapprochement généré avec succès.");
        } else {
            Alert.alert("Erreur", result?.generateRapprochement.message || "Une erreur est survenue.");
        }
    } catch (e) {
        Alert.alert("Erreur", "Impossible de générer le rapprochement.");
    }
  };

  if (!campaignId) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.infoBox, { backgroundColor: infoBg }]}>
        <ThemedText style={[styles.infoText, { color: infoText }]}>
            Le rapprochement compare l'inventaire validé avec le registre théorique.
        </ThemedText>
      </View>
      
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: buttonColor }]} 
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading ? (
            <ActivityIndicator color="#fff" />
        ) : (
            <ThemedText style={styles.buttonText}>Générer Rapprochement</ThemedText>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  infoBox: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
