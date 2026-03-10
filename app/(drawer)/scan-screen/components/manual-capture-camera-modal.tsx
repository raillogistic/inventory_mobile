import React, { forwardRef } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { CameraView } from "expo-camera";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { type CameraViewHandle } from "../types";

type ManualCaptureCameraModalProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: () => void;
  onContinue: () => void;
  imageCount: number;
  error: string | null;
  canContinue: boolean;
};

export const ManualCaptureCameraModal = forwardRef<CameraViewHandle, ManualCaptureCameraModalProps>(
  function ManualCaptureCameraModal(
    { visible, onClose, onCapture, onContinue, imageCount, error, canContinue },
    ref
  ) {
    return (
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.cameraModalOverlay}>
          <CameraView style={styles.cameraPreview} ref={ref} />
          <View style={styles.cameraHud}>
            <ThemedText style={styles.cameraHudTitle}>Photo article</ThemedText>
            <ThemedText style={styles.cameraHint}>
              Cadrez l&apos;article puis prenez la photo.
            </ThemedText>
            <ThemedText style={styles.cameraHint}>
              Photos: {imageCount}/3
            </ThemedText>
            {error ? (
              <ThemedText style={styles.manualErrorText}>{error}</ThemedText>
            ) : null}
            <View style={styles.manualCaptureActions}>
              <TouchableOpacity
                style={[
                  styles.manualCaptureButton,
                  { backgroundColor: PREMIUM_COLORS.accent_primary },
                ]}
                onPress={onCapture}
              >
                <ThemedText
                  style={[
                    styles.cameraCloseButtonText,
                    { color: PREMIUM_COLORS.text_primary },
                  ]}
                >
                  Prendre photo
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manualContinueButton,
                  {
                    backgroundColor: PREMIUM_COLORS.success,
                    opacity: canContinue ? 1 : 0.6,
                  },
                ]}
                onPress={onContinue}
                disabled={!canContinue}
              >
                <ThemedText
                  style={[
                    styles.cameraCloseButtonText,
                    { color: PREMIUM_COLORS.text_primary },
                  ]}
                >
                  Continuer
                </ThemedText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[
                styles.cameraCloseButton,
                { backgroundColor: PREMIUM_COLORS.glass_bg },
              ]}
              onPress={onClose}
            >
              <ThemedText
                style={[
                  styles.cameraCloseButtonText,
                  { color: PREMIUM_COLORS.text_primary },
                ]}
              >
                Fermer
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  cameraPreview: {
    height: "100%",
    width: "100%",
  },
  cameraModalOverlay: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  cameraCloseButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cameraCloseButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
  manualCaptureActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 12,
  },
  manualCaptureButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualContinueButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manualErrorText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    color: PREMIUM_COLORS.error,
  },
  cameraHint: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  cameraHud: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    gap: 8,
    alignItems: "center",
  },
  cameraHudTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
