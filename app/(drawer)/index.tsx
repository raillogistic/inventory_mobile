import React from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

/**
 * Home screen displayed after authentication.
 */
export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Accueil</ThemedText>
      <ThemedText>Bienvenue sur RAIL LOGISTIC.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
});
