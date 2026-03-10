import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";

type ScanHeaderProps = {
  hasCameraPermission: boolean;
  isCameraButtonDisabled: boolean;
  isSubmittingScan: boolean;
  isScanModalVisible: boolean;
  codeValue: string;
  onCodeChange: (text: string) => void;
  onCodeSubmit: () => void;
  onToggleCamera: () => void;
  onRequestCamera: () => void;
  onOpenManualCapture: () => void;
  manualStatusMessage: string;
  inputRef: React.RefObject<TextInput | null>;
};

export function ScanHeader({
  hasCameraPermission,
  isCameraButtonDisabled,
  isSubmittingScan,
  isScanModalVisible,
  codeValue,
  onCodeChange,
  onCodeSubmit,
  onToggleCamera,
  onRequestCamera,
  onOpenManualCapture,
  manualStatusMessage,
  inputRef,
}: ScanHeaderProps) {
  const scanBorderAnim = useRef(new Animated.Value(0)).current;
  const [buttonLayout, setButtonLayout] = React.useState<{
    height: number;
  } | null>(null);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanBorderAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(scanBorderAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scanBorderAnim]);

  const scanBorderColor = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
        outputRange: [
          "#EF4444",
          "#F59E0B",
          "#EAB308",
          "#22C55E",
          "#38BDF8",
          "#A855F7",
        ],
      }),
    [scanBorderAnim]
  );
  const scanGlowColor = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [
          "rgba(239,68,68,0.4)",
          "rgba(34,197,94,0.45)",
          "rgba(168,85,247,0.5)",
        ],
      }),
    [scanBorderAnim]
  );
  const scanBackgroundPulse = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [
          "rgba(15,23,42,0.85)",
          "rgba(30,41,59,0.7)",
          "rgba(15,23,42,0.85)",
        ],
      }),
    [scanBorderAnim]
  );
  const scanBackgroundScale = useMemo(
    () =>
      scanBorderAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.05, 1],
      }),
    [scanBorderAnim]
  );

  const scanLineHeight = 6;
  const scanLineTranslateY = useMemo(() => {
    const height = buttonLayout?.height ?? 0;
    const maxY = Math.max(0, height - scanLineHeight);
    return scanBorderAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, maxY],
    });
  }, [scanBorderAnim, buttonLayout?.height]);

  const manualGlowColor = "rgba(249,115,22,0.45)";

  const handleLayout = (event: LayoutChangeEvent) => {
    setButtonLayout({ height: event.nativeEvent.layout.height });
  };

  return (
    <View style={styles.headerContainer}>
      <View>
        <Animated.View
          style={[
            styles.scanModeButton,
            {
              borderColor: scanBorderColor,
              shadowColor: scanGlowColor,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.scanModeGlow, { backgroundColor: scanGlowColor }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.scanModeRadial, { backgroundColor: scanGlowColor }]}
          />
          <TouchableOpacity
            style={[
              styles.scanModeButtonInner,
              { backgroundColor: PREMIUM_COLORS.gradient_start },
            ]}
            onLayout={handleLayout}
            onPress={hasCameraPermission ? onToggleCamera : onRequestCamera}
            disabled={isCameraButtonDisabled}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanModeBackground,
                {
                  backgroundColor: scanBackgroundPulse,
                  transform: [{ scale: scanBackgroundScale }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scanModeScanLine,
                {
                  backgroundColor: scanBorderColor,
                  transform: [{ translateY: scanLineTranslateY }],
                },
              ]}
            />
            <View style={styles.scanModeButtonContent}>
              <ThemedText style={styles.scanModeButtonTitle}>
                Scan mode
              </ThemedText>
              <ThemedText style={styles.scanModeButtonSubtitle}>
                Lancer la camera
              </ThemedText>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.manualContainer}>
          <View
            style={[
              styles.scanModeButton,
              {
                borderColor: PREMIUM_COLORS.accent_primary,
                shadowColor: manualGlowColor,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.scanModeButtonInner,
                { backgroundColor: PREMIUM_COLORS.gradient_start },
              ]}
              onPress={onOpenManualCapture}
              disabled={isCameraButtonDisabled}
            >
              <View style={styles.scanModeButtonContent}>
                <ThemedText
                  style={[
                    styles.scanModeButtonTitle,
                    { color: PREMIUM_COLORS.text_primary },
                  ]}
                >
                  Nouvel article manuel
                </ThemedText>
                <ThemedText
                  style={[
                    styles.scanModeButtonSubtitle,
                    { color: PREMIUM_COLORS.text_muted },
                  ]}
                >
                  {manualStatusMessage}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.codeInput}
            placeholder="Entrer le code d'article"
            placeholderTextColor={PREMIUM_COLORS.text_muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={codeValue}
            onChangeText={onCodeChange}
            editable={!isScanModalVisible}
            ref={inputRef}
          />
          <TouchableOpacity
            style={styles.scanButton}
            onPress={onCodeSubmit}
            disabled={isSubmittingScan || isScanModalVisible}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le code article"
          >
            {isSubmittingScan ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={[styles.scanButtonText, { color: "#FFFFFF" }]}>
                &gt;
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scanModeButton: {
    borderWidth: 2,
    borderRadius: 20,
    padding: 3,
    borderColor: PREMIUM_COLORS.accent_primary,
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    overflow: "hidden",
  },
  scanModeGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    opacity: 0.3,
    borderRadius: 24,
    backgroundColor: PREMIUM_COLORS.accent_primary,
  },
  scanModeRadial: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    left: "50%",
    marginLeft: -110,
    opacity: 0.15,
    backgroundColor: PREMIUM_COLORS.accent_primary,
  },
  scanModeButtonInner: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scanModeBackground: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 14,
    opacity: 0.45,
  },
  scanModeScanLine: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 6,
    borderRadius: 999,
    opacity: 0.8,
  },
  scanModeButtonContent: {
    alignItems: "center",
    gap: 4,
  },
  scanModeButtonTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: PREMIUM_COLORS.text_primary,
  },
  scanModeButtonSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: PREMIUM_COLORS.text_muted,
  },
  manualContainer: {
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: PREMIUM_COLORS.text_primary,
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: PREMIUM_COLORS.accent_primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },
});
