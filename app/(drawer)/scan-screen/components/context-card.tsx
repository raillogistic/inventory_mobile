import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { PREMIUM_COLORS } from "@/components/ui/premium-theme";
import { useComptageSession } from "@/hooks/use-comptage-session";

type ContextCardProps = {
  onChangeLocation: () => void;
};

export function ContextCard({ onChangeLocation }: ContextCardProps) {
  const { session } = useComptageSession();

  return (
    <View style={styles.contextCard}>
      <ThemedText
        type="defaultSemiBold"
        style={{ color: PREMIUM_COLORS.text_primary }}
      >
        Campagne: {session.campaign?.nom}
      </ThemedText>
      <ThemedText style={styles.contextMeta}>
        Groupe: {session.group?.nom}
      </ThemedText>
      <ThemedText style={styles.contextMeta}>
        Lieu: {session.location?.locationname}
      </ThemedText>
      <TouchableOpacity style={styles.changeButton} onPress={onChangeLocation}>
        <ThemedText style={styles.changeButtonText}>Changer le lieu</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contextCard: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  contextMeta: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },
  changeButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.accent_primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  changeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: PREMIUM_COLORS.accent_primary,
  },
});
