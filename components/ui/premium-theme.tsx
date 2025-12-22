/**
 * @fileoverview Composants et constantes du thème premium.
 * Fournit un design cohérent avec dégradés, glassmorphism et orbes flottants.
 */

import React from "react";
import { Platform, StyleSheet, View, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Palette de couleurs premium pour le design.
 * Inspirée d'un thème industriel/ferroviaire moderne.
 */
export const PREMIUM_COLORS = {
  /** Dégradé principal - du bleu profond au violet */
  gradient_start: "#0A1628",
  gradient_mid: "#1A237E",
  gradient_end: "#311B92",

  /** Couleurs d'accent */
  accent_primary: "#FF6B00",
  accent_secondary: "#FF8F3F",

  /** Couleurs des orbes flottants */
  orb_1: "rgba(255, 107, 0, 0.15)",
  orb_2: "rgba(99, 102, 241, 0.12)",
  orb_3: "rgba(139, 92, 246, 0.10)",

  /** Surfaces glassmorphism */
  glass_bg: "rgba(255, 255, 255, 0.08)",
  glass_border: "rgba(255, 255, 255, 0.15)",
  glass_highlight: "rgba(255, 255, 255, 0.12)",

  /** Textes */
  text_primary: "#FFFFFF",
  text_secondary: "rgba(255, 255, 255, 0.7)",
  text_muted: "rgba(255, 255, 255, 0.5)",

  /** Champs de saisie */
  input_bg: "rgba(255, 255, 255, 0.06)",
  input_border: "rgba(255, 255, 255, 0.12)",
  input_focus: "rgba(255, 107, 0, 0.25)",

  /** États */
  success: "#22C55E",
  success_bg: "rgba(34, 197, 94, 0.15)",
  error: "#EF4444",
  error_bg: "rgba(239, 68, 68, 0.15)",
  warning: "#F59E0B",
  warning_bg: "rgba(245, 158, 11, 0.15)",
} as const;

/**
 * Props pour le composant FloatingOrb.
 */
type FloatingOrbProps = {
  /** Couleur de l'orbe */
  color: string;
  /** Taille en pixels */
  size: number;
  /** Position X en pourcentage */
  positionX: number;
  /** Position Y en pourcentage */
  positionY: number;
};

/**
 * Orbe flottant décoratif statique pour le design premium.
 * Crée un effet de lumière ambiante en arrière-plan.
 */
export function FloatingOrb({
  color,
  size,
  positionX,
  positionY,
}: FloatingOrbProps) {
  return (
    <View
      style={[
        premiumStyles.floating_orb,
        {
          width: size,
          height: size,
          backgroundColor: color,
          left: `${positionX}%`,
          top: `${positionY}%`,
        },
      ]}
    />
  );
}

/**
 * Props pour le composant PremiumScreenWrapper.
 */
type PremiumScreenWrapperProps = {
  /** Contenu de l'écran */
  children: React.ReactNode;
  /** Afficher les orbes flottants (par défaut: true) */
  showOrbs?: boolean;
};

/**
 * Wrapper d'écran premium avec fond dégradé et orbes flottants.
 * Applique le design premium cohérent à n'importe quel écran.
 */
export function PremiumScreenWrapper({
  children,
  showOrbs = true,
}: PremiumScreenWrapperProps) {
  return (
    <View style={premiumStyles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Fond dégradé */}
      <LinearGradient
        colors={[
          PREMIUM_COLORS.gradient_start,
          PREMIUM_COLORS.gradient_mid,
          PREMIUM_COLORS.gradient_end,
        ]}
        style={premiumStyles.gradient_background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Orbes flottants décoratifs */}
      {showOrbs && (
        <>
          <FloatingOrb
            color={PREMIUM_COLORS.orb_1}
            size={180}
            positionX={-15}
            positionY={5}
          />
          <FloatingOrb
            color={PREMIUM_COLORS.orb_2}
            size={140}
            positionX={75}
            positionY={10}
          />
          <FloatingOrb
            color={PREMIUM_COLORS.orb_3}
            size={160}
            positionX={65}
            positionY={75}
          />
          <FloatingOrb
            color={PREMIUM_COLORS.orb_1}
            size={100}
            positionX={-5}
            positionY={85}
          />
        </>
      )}

      {/* Contenu */}
      {children}
    </View>
  );
}

/**
 * Styles partagés pour le thème premium.
 */
export const premiumStyles = StyleSheet.create({
  /** Écran principal */
  screen: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.gradient_start,
  },

  /** Fond dégradé */
  gradient_background: {
    ...StyleSheet.absoluteFillObject,
  },

  /** Orbe flottant */
  floating_orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.6,
  },

  /** Contenu de liste avec padding approprié */
  list_content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
  },

  /** Section d'en-tête */
  header_section: {
    gap: 16,
    marginBottom: 8,
  },

  /** Card glassmorphism */
  glass_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 20,
    overflow: "hidden",
  },

  /** Card glassmorphism légère */
  glass_card_light: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 16,
  },

  /** Conteneur d'icône accentué */
  accent_icon_container: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 107, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  /** Titre de section */
  section_title: {
    fontSize: 24,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
    letterSpacing: -0.5,
  },

  /** Sous-titre de section */
  section_subtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 4,
  },

  /** Séparateur dégradé */
  gradient_separator: {
    height: 1,
    marginVertical: 16,
  },

  /** Champ de recherche premium */
  search_container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PREMIUM_COLORS.input_bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.input_border,
    paddingHorizontal: 14,
    gap: 10,
  },

  /** Input de recherche */
  search_input: {
    flex: 1,
    fontSize: 16,
    color: PREMIUM_COLORS.text_primary,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },

  /** Card d'élément de liste premium */
  list_item_card: {
    backgroundColor: PREMIUM_COLORS.glass_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 16,
  },

  /** Card d'élément de liste sélectionné */
  list_item_card_selected: {
    borderColor: PREMIUM_COLORS.accent_primary,
    borderWidth: 2,
  },

  /** Texte principal d'élément */
  item_title: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
    letterSpacing: -0.2,
  },

  /** Texte secondaire d'élément */
  item_subtitle: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
    marginTop: 2,
  },

  /** Badge de statut */
  status_badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  /** Texte de badge de statut */
  status_badge_text: {
    fontSize: 12,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_primary,
  },

  /** Bouton primaire avec dégradé */
  primary_button: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: PREMIUM_COLORS.accent_primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  /** Intérieur du bouton primaire */
  primary_button_inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },

  /** Texte du bouton primaire */
  primary_button_text: {
    fontSize: 16,
    fontWeight: "700",
    color: PREMIUM_COLORS.text_primary,
    letterSpacing: 0.3,
  },

  /** Bouton secondaire */
  secondary_button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },

  /** Texte du bouton secondaire */
  secondary_button_text: {
    fontSize: 14,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
  },

  /** Conteneur de chargement */
  loading_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 16,
  },

  /** Cercle de chargement */
  loading_circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },

  /** Texte de chargement */
  loading_text: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
  },

  /** Conteneur d'état vide */
  empty_container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 16,
  },

  /** Icône d'état vide */
  empty_icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PREMIUM_COLORS.glass_bg,
    alignItems: "center",
    justifyContent: "center",
  },

  /** Texte d'état vide */
  empty_text: {
    fontSize: 16,
    fontWeight: "600",
    color: PREMIUM_COLORS.text_secondary,
    textAlign: "center",
  },

  /** Sous-texte d'état vide */
  empty_subtext: {
    fontSize: 14,
    color: PREMIUM_COLORS.text_muted,
    textAlign: "center",
  },

  /** Conteneur d'erreur */
  error_container: {
    backgroundColor: PREMIUM_COLORS.error_bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 16,
    gap: 12,
  },

  /** Titre d'erreur */
  error_title: {
    fontSize: 15,
    fontWeight: "600",
    color: PREMIUM_COLORS.error,
  },

  /** Message d'erreur */
  error_message: {
    fontSize: 13,
    color: PREMIUM_COLORS.text_muted,
  },

  /** Modal overlay */
  modal_overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 22, 40, 0.85)",
    justifyContent: "center",
    padding: 24,
  },

  /** Modal card */
  modal_card: {
    backgroundColor: PREMIUM_COLORS.gradient_start,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.glass_border,
    padding: 24,
    gap: 20,
    maxHeight: "90%",
  },
});
