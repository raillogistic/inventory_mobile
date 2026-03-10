import React from "react";
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { ETAT_OPTIONS } from "../constants";
import { type EnregistrementInventaireEtat } from "@/lib/graphql/inventory-operations";

type ManualModalProps = {
  visible: boolean;
  imageUris: string[];
  customDesc: string;
  observation: string;
  serialNumber: string;
  etat: EnregistrementInventaireEtat | null;
  error: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onCustomDescChange: (text: string) => void;
  onObservationChange: (text: string) => void;
  onSerialNumberChange: (text: string) => void;
  onEtatSelect: (value: EnregistrementInventaireEtat) => void;
};

export function ManualModal({
  visible,
  imageUris,
  customDesc,
  observation,
  serialNumber,
  etat,
  error,
  isSaving,
  onClose,
  onSubmit,
  onCustomDescChange,
  onObservationChange,
  onSerialNumberChange,
  onEtatSelect,
}: ManualModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[
          styles.modalOverlay,
          { backgroundColor: "rgba(15, 23, 42, 0.75)" },
        ]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.modalCard,
            styles.manualModalCard,
            {
              backgroundColor: PREMIUM_COLORS.gradient_start,
              borderColor: PREMIUM_COLORS.glass_border,
            },
          ]}
          onPress={() => {}}
        >
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer le formulaire manuel"
          >
            <IconSymbol
              name="xmark"
              size={16}
              color={PREMIUM_COLORS.text_muted}
            />
          </TouchableOpacity>
          <ScrollView
            style={styles.manualFormScroll}
            contentContainerStyle={styles.manualFormContent}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText type="title" style={styles.modalCodeText}>
              Enregistrement manuel
            </ThemedText>
            {imageUris.length > 0 ? (
              <View style={styles.manualPreviewGroup}>
                <Image
                  source={{ uri: imageUris[0] }}
                  style={styles.manualPreview}
                  resizeMode="cover"
                />
                {imageUris.length > 1 ? (
                  <View style={styles.manualPreviewRow}>
                    {imageUris.slice(1).map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.manualPreviewThumb}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            <View style={styles.modalField}>
              <ThemedText style={styles.modalFieldLabel}>
                Libellé court
              </ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ajouter un libellé court"
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                value={customDesc}
                onChangeText={onCustomDescChange}
              />
            </View>
            <View style={styles.modalField}>
              <ThemedText style={styles.modalFieldLabel}>Observation</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ajouter une observation (optionnel)"
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                value={observation}
                onChangeText={onObservationChange}
                multiline
              />
            </View>
            <View style={styles.modalField}>
              <ThemedText style={styles.modalFieldLabel}>
                Numéro de série
              </ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Saisir un numéro de série (optionnel)"
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                value={serialNumber}
                onChangeText={onSerialNumberChange}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.etatSection}>
              <ThemedText type="subtitle">Etat du materiel</ThemedText>
              <View style={styles.etatOptions}>
                {ETAT_OPTIONS.map((option) => {
                  const isSelected = etat === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.etatOption,
                        {
                          borderColor: PREMIUM_COLORS.glass_border,
                          backgroundColor: isSelected
                            ? "rgba(16, 185, 129, 0.15)"
                            : "transparent",
                        },
                      ]}
                      onPress={() => onEtatSelect(option.value)}
                    >
                      <View style={styles.etatOptionContent}>
                        <ThemedText
                          style={[
                            styles.etatOptionText,
                            {
                              color: isSelected
                                ? PREMIUM_COLORS.text_primary
                                : PREMIUM_COLORS.text_muted,
                            },
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                        <IconSymbol
                          name="checkmark.circle.fill"
                          size={22}
                          color={
                            isSelected
                              ? PREMIUM_COLORS.success
                              : PREMIUM_COLORS.text_muted
                          }
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {error ? (
              <ThemedText style={styles.etatErrorText}>{error}</ThemedText>
            ) : null}
          </ScrollView>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[
                styles.modalButtonSecondary,
                { borderColor: PREMIUM_COLORS.accent_primary },
              ]}
              onPress={onClose}
              disabled={isSaving}
            >
              <ThemedText
                style={[
                  styles.modalButtonSecondaryText,
                  { color: PREMIUM_COLORS.text_primary },
                ]}
              >
                Annuler
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                {
                  backgroundColor: PREMIUM_COLORS.accent_primary,
                  opacity: isSaving ? 0.6 : 1,
                },
              ]}
              onPress={onSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.modalButtonText}>
                  Enregistrer
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10, 22, 40, 0.92)",
  },
  modalCard: {
    backgroundColor: PREMIUM_COLORS.gradient_start,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 24,
    padding: 24,
    minHeight: "65%",
    justifyContent: "space-between",
    gap: 20,
  },
  manualModalCard: {
    maxHeight: "90%",
  },
  manualFormScroll: {
    flex: 1,
  },
  manualFormContent: {
    gap: 16,
    paddingBottom: 12,
  },
  modalCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modalCodeText: {
    textAlign: "center",
    color: PREMIUM_COLORS.text_primary,
  },
  manualPreview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PREMIUM_COLORS.glass_border,
  },
  manualPreviewGroup: {
    width: "100%",
    gap: 10,
  },
  manualPreviewRow: {
    flexDirection: "row",
    gap: 10,
  },
  manualPreviewThumb: {
    flex: 1,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
  },
  modalField: {
    width: "100%",
    gap: 8,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_muted,
  },
  modalInput: {
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: PREMIUM_COLORS.text_primary,
  },
  modalButton: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.accent_primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalButtonSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },
  etatSection: {
    width: "100%",
    gap: 12,
    paddingTop: 8,
  },
  etatOptions: {
    gap: 10,
  },
  etatOption: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  etatOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  etatOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  etatErrorText: {
    fontSize: 13,
    textAlign: "center",
    color: PREMIUM_COLORS.error,
    marginTop: 4,
  },
});
