import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/** In-memory fallback store for unsupported platforms. */
type MemoryStore = Record<string, string>;

const memoryStore: MemoryStore = {};
let secureStoreAvailable: boolean | null = null;

/** Check if AsyncStorage can be used on the current platform. */
function isAsyncStorageAvailable(): boolean {
  return Platform.OS !== 'web';
}

/**
 * Check if SecureStore is available on the current platform.
 */
async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  if (secureStoreAvailable === null) {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  }

  return secureStoreAvailable;
}

/**
 * Read a raw string value from storage.
 */
export async function getStoredItem(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    return SecureStore.getItemAsync(key);
  }

  if (isAsyncStorageAvailable()) {
    return AsyncStorage.getItem(key);
  }

  return memoryStore[key] ?? null;
}

/**
 * Persist a raw string value in storage.
 */
export async function setStoredItem(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  if (isAsyncStorageAvailable()) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  memoryStore[key] = value;
}

/**
 * Remove a stored value.
 */
export async function removeStoredItem(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  if (isAsyncStorageAvailable()) {
    await AsyncStorage.removeItem(key);
    return;
  }

  delete memoryStore[key];
}

/**
 * Read a JSON value from storage and parse it safely.
 */
export async function getStoredJson<T>(key: string): Promise<T | null> {
  const rawValue = await getStoredItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

/**
 * Serialize and store a JSON value.
 */
export async function setStoredJson<T>(key: string, value: T): Promise<void> {
  await setStoredItem(key, JSON.stringify(value));
}
