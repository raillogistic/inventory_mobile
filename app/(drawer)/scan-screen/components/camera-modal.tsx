import React, { forwardRef } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import {
  CameraView,
  type BarcodeScanningResult,
} from "expo-camera";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { BARCODE_TYPES } from "../constants";
import { type CameraViewHandle } from "../types";

type CameraModalProps = {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onLayoutFrame: (event: LayoutChangeEvent) => void;
  isScanBusy: boolean;
  overlayLabel: string | null;
};

export const CameraModal = forwardRef<CameraViewHandle, CameraModalProps>(
  function CameraModal(
    {
      visible,
      onClose,
      onBarcodeScanned,
      onLayoutFrame,
      isScanBusy,
      overlayLabel,
    },
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
          <CameraView
            style={styles.cameraPreview}
            onBarcodeScanned={onBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            ref={ref}
          />
          <View style={styles.scanFrameOverlay} pointerEvents="none">
            <View style={styles.scanFrame} onLayout={onLayoutFrame} />
          </View>
          <View style={styles.cameraHud}>
            <ThemedText style={styles.cameraHudTitle}>Mode scan</ThemedText>
            <ThemedText style={styles.cameraHint}>
              Placez le code-barres dans le cadre pour le scanner.
            </ThemedText>
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
          {isScanBusy && overlayLabel ? (
            <View style={styles.cameraOverlay}>
              <ThemedText
                style={[styles.cameraOverlayText, { color: "#FFFFFF" }]}
              >
                {overlayLabel}
              </ThemedText>
            </View>
          ) : null}
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
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  cameraOverlayText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scanFrameOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: "80%",
    height: "28%",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 12,
  },
});
