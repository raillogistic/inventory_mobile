import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useCampagneInventaireList } from '@/lib/graphql/inventory-hooks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';

type CampaignSelectorProps = {
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
};

export function CampaignSelector({ selectedCampaignId, onSelectCampaign }: CampaignSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { campaigns, loading, error } = useCampagneInventaireList();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#555' }, 'text');

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <View style={styles.container}>
      <ThemedText type="defaultSemiBold" style={styles.label}>Campagne:</ThemedText>
      
      <TouchableOpacity 
        style={[styles.selector, { borderColor }]} 
        onPress={() => setModalVisible(true)}
      >
        <ThemedText>
          {selectedCampaign ? selectedCampaign.nom : (loading ? "Chargement..." : "Sélectionner une campagne")}
        </ThemedText>
        <Ionicons name="chevron-down" size={20} color={textColor} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Sélectionner une campagne</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={textColor} />
            ) : error ? (
              <ThemedText>Erreur de chargement</ThemedText>
            ) : (
              <FlatList
                data={campaigns}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => {
                      onSelectCampaign(item.id);
                      setModalVisible(false);
                    }}
                  >
                    <ThemedText style={item.id === selectedCampaignId ? styles.selectedItem : undefined}>
                      {item.nom} ({item.code_campagne})
                    </ThemedText>
                    {item.id === selectedCampaignId && (
                      <Ionicons name="checkmark" size={20} color={textColor} />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  label: {
    marginRight: 10,
  },
  selector: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  item: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedItem: {
    fontWeight: 'bold',
  },
});
