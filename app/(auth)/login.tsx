import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * Dimensions du périphérique pour calculs responsifs.
 */
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Palette de couleurs premium pour le design du login.
 * Inspirée d'un thème industriel/ferroviaire moderne.
 */
const COLORS = {
  /** Dégradé principal - du bleu profond au violet */
  gradient_start: "#0A1628",
  gradient_mid: "#1A237E",
  gradient_end: "#311B92",
  /** Accents */
  accent_primary: "#FF6B00",
  accent_secondary: "#FF8F3F",
  accent_glow: "rgba(255, 107, 0, 0.4)",
  /** Surfaces glassmorphism */
  glass_bg: "rgba(255, 255, 255, 0.08)",
  glass_border: "rgba(255, 255, 255, 0.15)",
  glass_shadow: "rgba(0, 0, 0, 0.3)",
  /** Textes */
  text_primary: "#FFFFFF",
  text_secondary: "rgba(255, 255, 255, 0.7)",
  text_muted: "rgba(255, 255, 255, 0.5)",
  /** Champs de saisie */
  input_bg: "rgba(255, 255, 255, 0.05)",
  input_border: "rgba(255, 255, 255, 0.12)",
  input_focus_border: "#FF6B00",
  /** États */
  error: "#FF5252",
  success: "#4CAF50",
  /** Éléments décoratifs */
  orb_1: "rgba(255, 107, 0, 0.3)",
  orb_2: "rgba(156, 39, 176, 0.25)",
  orb_3: "rgba(33, 150, 243, 0.2)",
} as const;

const TOKEN_AUTH_MUTATION = `
  mutation TokenAuth($username: String!, $password: String!) {
    token_auth(username: $username, password: $password) {
      token
    }
  }
`;

/** État du formulaire de connexion. */
type LoginFormState = {
  /** Valeur du champ nom d'utilisateur. */
  username: string;
  /** Valeur du champ mot de passe. */
  password: string;
};

/** Variables requises par la mutation d'authentification. */
type TokenAuthVariables = {
  /** Nom d'utilisateur pour l'authentification. */
  username: string;
  /** Mot de passe pour l'authentification. */
  password: string;
};

/** Payload retourné par la mutation d'authentification. */
type TokenAuthPayload = {
  /** Jeton d'accès. */
  token: string | null;
};

/** Données retournées par la mutation d'authentification. */
type TokenAuthData = {
  /** Wrapper de réponse d'authentification. */
  token_auth: TokenAuthPayload | null;
};

/** Format de réponse GraphQL pour les requêtes d'authentification. */
type TokenAuthResponse = {
  /** Données de la réponse du backend. */
  data?: TokenAuthData;
  /** Erreurs GraphQL, le cas échéant. */
  errors?: { message: string }[];
};

/**
 * Details for an auth endpoint error.
 */
type AuthErrorDetails = {
  /** URL used for the auth request. */
  url: string;
  /** Raw error detail from the backend or network. */
  detail: string;
};

/** Résultat de la vérification de disponibilité de l'endpoint. */
type EndpointCheckResult = {
  /** Si l'endpoint a répondu avec succès. */
  ok: boolean;
  /** Message d'erreur optionnel pour l'utilisateur. */
  message?: string;
  /** Details for troubleshooting. */
  details?: AuthErrorDetails;
};

/**
 * Normalise les erreurs en un message affichable.
 * @param error - L'erreur à normaliser.
 * @returns Message d'erreur formaté.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Connexion impossible. Veuillez réessayer.";
}

/**
 * Build auth error details for display.
 * @param authUrl - Auth endpoint URL.
 * @param error - Raw error object.
 * @returns Auth error details payload.
 */
function buildAuthErrorDetails(
  authUrl: string,
  error: unknown
): AuthErrorDetails {
  return {
    url: authUrl,
    detail: getErrorMessage(error),
  };
}


/**
 * Demande un jeton d'authentification au backend.
 * @param authUrl - URL de l'endpoint d'authentification.
 * @param variables - Variables d'authentification (username, password).
 * @returns Payload contenant le jeton.
 */
async function requestTokenAuth(
  authUrl: string,
  variables: TokenAuthVariables
): Promise<TokenAuthPayload> {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: TOKEN_AUTH_MUTATION, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Le serveur d'authentification a renvoyé le statut ${response.status}.`
    );
  }

  const payload = (await response.json()) as TokenAuthResponse;

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data?.token_auth ?? { token: null };
}

/**
 * Vérifie si l'endpoint d'authentification est accessible.
 * @param url - URL de l'endpoint à vérifier.
 * @returns Résultat de la vérification.
 */
async function checkAuthEndpoint(url: string): Promise<EndpointCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { __typename }" }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("Auth endpoint responded with status", response.status, url);
      return {
        ok: false,
        message: "Le serveur d'authentification ne répond pas.",
        details: {
          url,
          detail: `HTTP status ${response.status}.`,
        },
      };
    }

    return { ok: true };
  } catch (error) {
    console.warn("Auth endpoint unreachable", url, error);
    return {
      ok: false,
      message: "Impossible de joindre le serveur. Vérifiez l'hôte et le port.",
      details: buildAuthErrorDetails(url, error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Props pour le composant d'orbe flottant animé.
 */
type FloatingOrbProps = {
  /** Couleur de l'orbe. */
  color: string;
  /** Taille de l'orbe en pixels. */
  size: number;
  /** Position initiale X (% du conteneur). */
  initialX: number;
  /** Position initiale Y (% du conteneur). */
  initialY: number;
  /** Durée de l'animation en ms. */
  duration: number;
  /** Délai avant le début de l'animation. */
  delay: number;
};

/**
 * Composant d'orbe flottant décoratif avec animation.
 * Crée un effet visuel de lumière ambiante flottante.
 */
function FloatingOrb({
  color,
  size,
  initialX,
  initialY,
  duration,
  delay,
}: FloatingOrbProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation d'entrée
    Animated.timing(opacity, {
      toValue: 1,
      duration: 1000,
      delay,
      useNativeDriver: true,
    }).start();

    // Animation de flottement verticale
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: 20,
          duration: duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Animation de flottement horizontale
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 15,
          duration: duration * 1.3,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -15,
          duration: duration * 1.3,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Animation de pulsation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: duration * 0.8,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: duration * 0.8,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [delay, duration, opacity, scale, translateX, translateY]);

  return (
    <Animated.View
      style={[
        styles.floating_orb,
        {
          width: size,
          height: size,
          backgroundColor: color,
          left: `${initialX}%`,
          top: `${initialY}%`,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}

/**
 * Props pour le composant de champ de saisie stylisé.
 */
type StyledInputProps = {
  /** Icône SF Symbol à afficher. */
  icon: string;
  /** Placeholder du champ. */
  placeholder: string;
  /** Valeur du champ. */
  value: string;
  /** Callback de changement de valeur. */
  onChangeText: (value: string) => void;
  /** Si le champ est un mot de passe. */
  secureTextEntry?: boolean;
  /** Si le champ est en focus. */
  isFocused: boolean;
  /** Callback de focus. */
  onFocus: () => void;
  /** Callback de blur. */
  onBlur: () => void;
};

/**
 * Champ de saisie stylisé avec animation et icône.
 * Inclut des effets de focus animés et un design glassmorphism.
 */
function StyledInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  isFocused,
  onFocus,
  onBlur,
}: StyledInputProps) {
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(borderOpacity, {
        toValue: isFocused ? 1 : 0,
        useNativeDriver: false,
        tension: 80,
        friction: 10,
      }),
      Animated.spring(iconScale, {
        toValue: isFocused ? 1.1 : 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  }, [borderOpacity, iconScale, isFocused]);

  const borderColor = borderOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.input_border, COLORS.accent_primary],
  });

  return (
    <Animated.View
      style={[
        styles.input_container,
        {
          borderColor,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <IconSymbol
          name={icon as any}
          size={20}
          color={isFocused ? COLORS.accent_primary : COLORS.text_muted}
        />
      </Animated.View>
      <TextInput
        style={styles.input_field}
        placeholder={placeholder}
        placeholderTextColor={COLORS.text_muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </Animated.View>
  );
}

/**
 * Écran d'authentification avec design premium et animations.
 *
 * Fonctionnalités:
 * - Fond dégradé animé avec orbes flottants
 * - Carte glassmorphism avec effet de flou
 * - Champs de saisie animés avec indicateurs de focus
 * - Bouton de connexion avec effet de pulsation
 * - Gestion complète de l'authentification GraphQL
 */
export default function LoginScreen() {
  const router = useRouter();
  const { authUrl, setAuthSession } = useAuth();

  // État du formulaire
  const [formState, setFormState] = useState<LoginFormState>({
    username: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<AuthErrorDetails | null>(null);
  const [isErrorDetailsVisible, setIsErrorDetailsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  // Animation d'entrée au montage
  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.parallel([
        Animated.spring(cardOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
      ]),
    ]).start();
  }, [cardOpacity, cardTranslateY, logoScale]);

  // Animation de pulsation du bouton
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 1.02,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [buttonScale]);

  // Animation de secousse pour les erreurs
  const triggerErrorShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(errorShake, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorShake, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorShake, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(errorShake, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [errorShake]);

  /** Reset the error details state. */
  const resetErrorDetails = useCallback(() => {
    setErrorDetails(null);
    setIsErrorDetailsVisible(false);
  }, []);

  /** Toggle the visibility of detailed error information. */
  const handleToggleErrorDetails = useCallback(() => {
    if (!errorDetails) {
      return;
    }
    setIsErrorDetailsVisible((current) => !current);
  }, [errorDetails]);

  /** Met à jour le champ nom d'utilisateur. */
  const handleUsernameChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, username: value }));
  }, []);

  /** Met à jour le champ mot de passe. */
  const handlePasswordChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, password: value }));
  }, []);

  /** Navigue vers l'écran de configuration du serveur. */
  const handleOpenServerSettings = useCallback(() => {
    router.push("/(auth)/server");
  }, [router]);

  /** Soumet la mutation d'authentification et persiste la session. */
  const handleLogin = useCallback(async () => {
    const trimmedUsername = formState.username.trim();

    if (!trimmedUsername || !formState.password) {
      setErrorMessage("Le nom d'utilisateur et le mot de passe sont requis.");
      resetErrorDetails();
      triggerErrorShake();
      return;
    }

    setErrorMessage(null);
    resetErrorDetails();

    const endpointStatus = await checkAuthEndpoint(authUrl);
    if (!endpointStatus.ok) {
      setErrorMessage(
        endpointStatus.message ??
          "Le serveur d'authentification est inaccessible."
      );
      setErrorDetails(
        endpointStatus.details ?? {
          url: authUrl,
          detail:
            endpointStatus.message ??
            "Le serveur d'authentification est inaccessible.",
        }
      );
      setIsErrorDetailsVisible(false);
      triggerErrorShake();
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = await requestTokenAuth(authUrl, {
        username: trimmedUsername,
        password: formState.password,
      });

      if (!payload.token) {
        setErrorMessage("Échec de la connexion. Vérifiez vos identifiants.");
        triggerErrorShake();
        return;
      }

      await setAuthSession({
        tokens: {
          accessToken: payload.token,
          refreshToken: null,
          expiresAt: null,
        },
        user: null,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      setErrorDetails(buildAuthErrorDetails(authUrl, error));
      setIsErrorDetailsVisible(false);
      triggerErrorShake();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    authUrl,
    formState.password,
    formState.username,
    resetErrorDetails,
    setAuthSession,
    triggerErrorShake,
  ]);

  const isLoginDisabled = useMemo(
    () => isSubmitting || !formState.username.trim() || !formState.password,
    [formState.password, formState.username, isSubmitting]
  );
  const isErrorDetailsAvailable = Boolean(errorDetails);


  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          title: "",
          headerTintColor: COLORS.text_primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },
        }}
      />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Fond dégradé animé */}
      <LinearGradient
        colors={[
          COLORS.gradient_start,
          COLORS.gradient_mid,
          COLORS.gradient_end,
        ]}
        style={styles.gradient_background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Orbes flottants décoratifs */}
      <FloatingOrb
        color={COLORS.orb_1}
        size={200}
        initialX={-20}
        initialY={10}
        duration={4000}
        delay={0}
      />
      <FloatingOrb
        color={COLORS.orb_2}
        size={150}
        initialX={70}
        initialY={5}
        duration={5000}
        delay={500}
      />
      <FloatingOrb
        color={COLORS.orb_3}
        size={180}
        initialX={60}
        initialY={70}
        duration={4500}
        delay={1000}
      />
      <FloatingOrb
        color={COLORS.orb_1}
        size={100}
        initialX={-10}
        initialY={80}
        duration={3500}
        delay={750}
      />

      <KeyboardAvoidingView
        style={styles.keyboard_avoiding}
        behavior={Platform.select({ ios: "padding", default: undefined })}
      >
        <View style={styles.content_container}>
          {/* Section Logo */}
          <Animated.View
            style={[styles.logo_section, { transform: [{ scale: logoScale }] }]}
          >
            <View style={styles.logo_glow_container}>
              <View style={styles.logo_glow} />
              <Image
                source={require("../../assets/images/company.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Logo Rail Logistic"
              />
            </View>
            <Text style={styles.brand_tagline}>
              Système de Gestion d&apos;Inventaire
            </Text>
          </Animated.View>

          {/* Carte de connexion glassmorphism */}
          <Animated.View
            style={[
              styles.login_card_container,
              {
                opacity: cardOpacity,
                transform: [
                  { translateY: cardTranslateY },
                  { translateX: errorShake },
                ],
              },
            ]}
          >
            <BlurView intensity={20} tint="dark" style={styles.blur_view}>
              <View style={styles.login_card}>
                {/* En-tête de la carte */}
                <View style={styles.card_header}>
                  <View style={styles.header_title_row}>
                    <View style={styles.header_icon_container}>
                      <IconSymbol
                        name="person.circle.fill"
                        size={28}
                        color={COLORS.accent_primary}
                      />
                    </View>
                    <View>
                      <Text style={styles.header_title}>Connexion</Text>
                      <Text style={styles.header_subtitle}>
                        Accédez à votre espace de travail
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleOpenServerSettings}
                    accessibilityLabel="Modifier le serveur d'authentification"
                    style={styles.server_button}
                  >
                    <IconSymbol
                      name="gearshape.fill"
                      size={18}
                      color={COLORS.text_secondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Séparateur décoratif */}
                <View style={styles.separator}>
                  <LinearGradient
                    colors={[
                      "transparent",
                      COLORS.accent_primary,
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.separator_gradient}
                  />
                </View>

                {/* Formulaire */}
                <View style={styles.form}>
                  <View style={styles.field_group}>
                    <Text style={styles.field_label}>
                      Nom d&apos;utilisateur
                    </Text>
                    <StyledInput
                      icon="person.fill"
                      placeholder="Entrez votre identifiant"
                      value={formState.username}
                      onChangeText={handleUsernameChange}
                      isFocused={focusedField === "username"}
                      onFocus={() => setFocusedField("username")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <View style={styles.field_group}>
                    <Text style={styles.field_label}>Mot de passe</Text>
                    <StyledInput
                      icon="lock.fill"
                      placeholder="Entrez votre mot de passe"
                      value={formState.password}
                      onChangeText={handlePasswordChange}
                      secureTextEntry
                      isFocused={focusedField === "password"}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  {/* Message d'erreur */}
                  {errorMessage && (
                    <TouchableOpacity
                      style={styles.error_container}
                      onPress={handleToggleErrorDetails}
                      disabled={!isErrorDetailsAvailable}
                      accessibilityRole={
                        isErrorDetailsAvailable ? "button" : undefined
                      }
                      accessibilityLabel={
                        isErrorDetailsAvailable
                          ? isErrorDetailsVisible
                            ? "Masquer les details de l'erreur"
                            : "Afficher les details de l'erreur"
                          : undefined
                      }
                      activeOpacity={isErrorDetailsAvailable ? 0.7 : 1}
                    >
                      <IconSymbol
                        name="exclamationmark.triangle.fill"
                        size={16}
                        color={COLORS.error}
                      />
                      <View style={styles.error_text_container}>
                        <Text style={styles.error_text}>{errorMessage}</Text>
                        {isErrorDetailsAvailable && (
                          <Text style={styles.error_link}>
                            {isErrorDetailsVisible
                              ? "Masquer les details"
                              : "Afficher les details"}
                          </Text>
                        )}
                        {isErrorDetailsVisible && errorDetails && (
                          <View style={styles.error_details}>
                            <Text style={styles.error_details_label}>URL</Text>
                            <Text style={styles.error_details_value}>
                              {errorDetails.url}
                            </Text>
                            <Text style={styles.error_details_label}>Erreur</Text>
                            <Text style={styles.error_details_value}>
                              {errorDetails.detail}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Bouton de connexion */}
                  <Animated.View
                    style={{
                      transform: [{ scale: isLoginDisabled ? 1 : buttonScale }],
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.login_button,
                        isLoginDisabled && styles.login_button_disabled,
                      ]}
                      onPress={handleLogin}
                      disabled={isLoginDisabled}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={
                          isLoginDisabled
                            ? ["#4A4A4A", "#3A3A3A"]
                            : [COLORS.accent_primary, COLORS.accent_secondary]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.button_gradient}
                      >
                        {isSubmitting ? (
                          <View style={styles.button_loading}>
                            <Animated.View style={styles.loading_dot} />
                            <Text style={styles.button_text}>Connexion...</Text>
                          </View>
                        ) : (
                          <View style={styles.button_content}>
                            <Text style={styles.button_text}>Se connecter</Text>
                            <IconSymbol
                              name="arrow.right.circle.fill"
                              size={20}
                              color={COLORS.text_primary}
                            />
                          </View>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            </BlurView>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footer_badge}>
              <IconSymbol
                name="building.2.fill"
                size={12}
                color={COLORS.text_muted}
              />
              <Text style={styles.footer_text}>
                Direction des Systèmes d&apos;Information et Numérisation
              </Text>
            </View>
            <Text style={styles.copyright_text}>© 2025 Rail Logistic SPA</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Styles du composant LoginScreen.
 * Utilise un design premium avec glassmorphism et animations.
 */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.gradient_start,
  },
  gradient_background: {
    ...StyleSheet.absoluteFillObject,
  },
  floating_orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.6,
  },
  keyboard_avoiding: {
    flex: 1,
  },
  content_container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 24,
    justifyContent: "center",
  },
  /* Section Logo */
  logo_section: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo_glow_container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  logo_glow: {
    position: "absolute",
    width: 200,
    height: 100,
    backgroundColor: COLORS.accent_glow,
    borderRadius: 100,
    opacity: 0.3,
  },
  logo: {
    width: SCREEN_WIDTH * 0.6,
    height: 80,
    maxWidth: 280,
  },
  brand_tagline: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text_secondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  /* Carte de connexion */
  login_card_container: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.glass_border,
  },
  blur_view: {
    overflow: "hidden",
    borderRadius: 24,
  },
  login_card: {
    padding: 24,
    backgroundColor: COLORS.glass_bg,
  },
  card_header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  header_title_row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  header_icon_container: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 107, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  header_title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text_primary,
    letterSpacing: -0.5,
  },
  header_subtitle: {
    fontSize: 13,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  server_button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.input_border,
  },
  /* Séparateur */
  separator: {
    height: 1,
    marginBottom: 24,
  },
  separator_gradient: {
    flex: 1,
    height: 1,
  },
  /* Formulaire */
  form: {
    gap: 20,
  },
  field_group: {
    gap: 8,
  },
  field_label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text_secondary,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.input_bg,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input_field: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text_primary,
    fontWeight: "500",
  },
  /* Erreur */
  error_container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.3)",
  },
  error_text: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "500",
  },
  error_text_container: {
    flex: 1,
    gap: 6,
  },
  error_link: {
    fontSize: 12,
    color: COLORS.text_secondary,
    textDecorationLine: "underline",
  },
  error_details: {
    gap: 4,
  },
  error_details_label: {
    fontSize: 10,
    color: COLORS.text_muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  error_details_value: {
    fontSize: 12,
    color: COLORS.text_primary,
  },
  /* Bouton de connexion */
  login_button: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
    shadowColor: COLORS.accent_primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  login_button_disabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  button_gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  button_content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  button_loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loading_dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text_primary,
    opacity: 0.7,
  },
  button_text: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text_primary,
    letterSpacing: 0.5,
  },
  /* Footer */
  footer: {
    alignItems: "center",
    marginTop: 32,
    gap: 8,
  },
  footer_badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  footer_text: {
    fontSize: 11,
    color: COLORS.text_muted,
    fontWeight: "500",
  },
  copyright_text: {
    fontSize: 10,
    color: COLORS.text_muted,
    opacity: 0.6,
  },
});
