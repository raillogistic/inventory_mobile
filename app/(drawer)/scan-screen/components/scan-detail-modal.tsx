import React, { useMemo } from "react";
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { ETAT_OPTIONS } from "../constants";
import { formatTimestamp } from "../utils";
import { type ScanDetail } from "../types";
import { type EnregistrementInventaireEtat } from "@/lib/graphql/inventory-operations";

type ScanDetailModalProps = {
  visible: boolean;
  scanDetail: ScanDetail | null;
  customDesc: string;
  observation: string;
  serialNumber: string;
  selectedEtat: EnregistrementInventaireEtat | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onCustomDescChange: (text: string) => void;
  onObservationChange: (text: string) => void;
  onSerialNumberChange: (text: string) => void;
  onEtatSelect: (value: EnregistrementInventaireEtat) => void;
};

export function ScanDetailModal({
  visible,
  scanDetail,
  customDesc,
  observation,
  serialNumber,
  selectedEtat,
  isLoading,
  error,
  onClose,
  onConfirm,
  onCustomDescChange,
  onObservationChange,
  onSerialNumberChange,
  onEtatSelect,
}: ScanDetailModalProps) {
  const isMissingDraft = Boolean(
    scanDetail && scanDetail.status === "missing" && !scanDetail.id
  );

  const canSubmitScanDetail = useMemo(() => {
    if (!scanDetail) {
      return false;
    }

    const trimmedObservation = observation.trim();
    const trimmedSerialNumber = serialNumber.trim();
    const trimmedCustomDescription = customDesc.trim();
    const hasUpdate =
      Boolean(selectedEtat) ||
      trimmedObservation.length > 0 ||
      trimmedSerialNumber.length > 0 ||
      trimmedCustomDescription.length > 0;

    if (scanDetail.status === "missing" && !scanDetail.id) {
      return (
        Boolean(selectedEtat) &&
        trimmedCustomDescription.length > 0 &&
        Boolean(scanDetail.imageUri) &&
        !isLoading
      );
    }

    if (!scanDetail.id) {
      return Boolean(selectedEtat) && !isLoading;
    }

    return hasUpdate && !isLoading;
  }, [
    customDesc,
    isLoading,
    observation,
    scanDetail,
    selectedEtat,
    serialNumber,
  ]);

  if (!scanDetail) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              borderColor:
                scanDetail.status === "missing"
                  ? PREMIUM_COLORS.error
                  : scanDetail.status === "other"
                  ? PREMIUM_COLORS.warning
                  : scanDetail.status === "scanned"
                  ? PREMIUM_COLORS.success
                  : PREMIUM_COLORS.glass_border,
            },
          ]}
          onPress={() => {}}
        >
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer la fiche article"
          >
            <IconSymbol
              name="xmark"
              size={16}
              color={PREMIUM_COLORS.text_muted}
            />
          </TouchableOpacity>
          <View style={styles.modalContent}>
            <View
              style={[
                styles.modalStatusBadge,
                {
                  backgroundColor:
                    scanDetail.status === "missing"
                      ? "rgba(239, 68, 68, 0.15)"
                      : scanDetail.status === "other"
                      ? "rgba(245, 158, 11, 0.15)"
                      : scanDetail.status === "scanned"
                      ? "rgba(16, 185, 129, 0.15)"
                      : PREMIUM_COLORS.glass_bg,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.modalStatusText,
                  {
                    color:
                      scanDetail.status === "missing"
                        ? "#FCA5A5"
                        : scanDetail.status === "other"
                        ? "#FCD34D"
                        : scanDetail.status === "scanned"
                        ? "#6EE7B7"
                        : PREMIUM_COLORS.text_muted,
                  },
                ]}
              >
                {scanDetail.statusLabel}
              </ThemedText>
            </View>
            <ThemedText type="title" style={styles.modalCodeText}>
              {scanDetail.code}
            </ThemedText>
            {scanDetail.description ? (
              <ThemedText style={styles.modalDescription}>
                {scanDetail.description}
              </ThemedText>
            ) : (
              <ThemedText style={styles.modalDescription}>
                Description inconnue
              </ThemedText>
            )}
            <ThemedText style={styles.modalMeta}>
              Scanné à {formatTimestamp(scanDetail.capturedAt)}
            </ThemedText>
            {scanDetail.alreadyScanned ? (
              <ThemedText style={styles.alreadyScannedText}>
                Déjà scanné. Vous pouvez modifier l&apos;état ci-dessous.
              </ThemedText>
            ) : null}
            {scanDetail.status === "missing" ? (
              <View style={styles.modalField}>
                <ThemedText style={styles.modalFieldLabel}>
                  Libellé court
                </ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Saisir un libelle court"
                  placeholderTextColor={PREMIUM_COLORS.text_muted}
                  value={customDesc}
                  onChangeText={onCustomDescChange}
                />
              </View>
            ) : null}
            <View style={styles.modalField}>
              <ThemedText style={styles.modalFieldLabel}>Observation</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ajouter une observation"
                placeholderTextColor={PREMIUM_COLORS.text_muted}
                value={observation}
                onChangeText={onObservationChange}
                multiline
              />
            </View>
            <View style={styles.modalField}>
              <ThemedText style={styles.modalFieldLabel}>
                Numéro de série (optionnel)
              </ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Saisir un numéro de série"
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
                  const isSelected = selectedEtat === option.value;
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
              {error ? (
                <ThemedText style={styles.etatErrorText}>{error}</ThemedText>
              ) : null}
            </View>
          </View>

          {isMissingDraft ? (
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[
                  styles.modalButtonSecondary,
                  { borderColor: PREMIUM_COLORS.accent_primary },
                ]}
                onPress={onClose}
                disabled={isLoading}
              >
                <ThemedText
                  style={[
                    styles.modalButtonSecondaryText,
                    { color: PREMIUM_COLORS.text_primary },
                  ]}
                >
                  Ne pas enregistrer
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: PREMIUM_COLORS.accent_primary,
                    opacity: canSubmitScanDetail ? 1 : 0.6,
                  },
                ]}
                onPress={onConfirm}
                disabled={!canSubmitScanDetail}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.modalButtonText}>
                    Creer article temporaire
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[
                  styles.modalButtonSecondary,
                  { borderColor: PREMIUM_COLORS.glass_border },
                ]}
                onPress={onClose}
                disabled={isLoading}
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
                    opacity: canSubmitScanDetail ? 1 : 0.6,
                  },
                ]}
                onPress={onConfirm}
                disabled={!canSubmitScanDetail}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.modalButtonText}>
                    Enregistrer et scanner suivant
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  modalContent: {
    alignItems: "center",
    gap: 14,
  },
  modalStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalCodeText: {
    textAlign: "center",
    color: PREMIUM_COLORS.text_primary,
  },
  modalDescription: {
    fontSize: 18,
    textAlign: "center",
    color: PREMIUM_COLORS.text_secondary,
  },
  modalMeta: {
    fontSize: 14,
    textAlign: "center",
    color: PREMIUM_COLORS.text_muted,
  },
  alreadyScannedText: {
    fontSize: 13,
    textAlign: "center",
    color: PREMIUM_COLORS.warning,
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
