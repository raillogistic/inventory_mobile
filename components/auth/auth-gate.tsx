import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Props for the AuthGate component. */
export type AuthGateProps = {
  /** Child routes rendered when authentication state is resolved. */
  children: React.ReactNode;
};

/**
 * Redirect users based on authentication state and route group.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');

  /** Evaluate auth state and redirect to the awareness route group. */
  const handleAuthRedirect = useCallback(() => {
    if (!isReady) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isReady, router, segments]);

  useEffect(handleAuthRedirect, [handleAuthRedirect]);

  if (!isReady) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
      </ThemedView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
