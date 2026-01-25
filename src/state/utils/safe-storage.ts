/**
 * Safe browser storage utilities for Jotai atoms.
 *
 * Handles:
 * - Server-side rendering (no window/localStorage)
 * - Browser privacy modes where localStorage is disabled
 * - QuotaExceededError / storage full scenarios
 *
 * Falls back to an in-memory Map so atoms continue to work
 * even when persistent storage is unavailable.
 */

import type { PrimitiveAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

type JsonStorage<T> = {
  getItem: (key: string) => T | null;
  setItem: (key: string, value: T) => void;
  removeItem: (key: string) => void;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const memoryStorage = new Map<string, string>();

function isBrowserStorageAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }

  try {
    const testKey = '__skitso_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Storage wrapper that:
 * - Uses localStorage when available
 * - Falls back to in-memory Map on errors (including quota exceeded)
 */
export const safeStorage: StorageLike = {
  getItem(key) {
    if (!isBrowserStorageAvailable()) {
      return memoryStorage.get(key) ?? null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch (error) {
       
      console.error('safeStorage.getItem failed, falling back to memory:', error);
      return memoryStorage.get(key) ?? null;
    }
  },

  setItem(key, value) {
    if (!isBrowserStorageAvailable()) {
      memoryStorage.set(key, value);
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
       
      console.error('safeStorage.setItem failed, falling back to memory:', error);
      memoryStorage.set(key, value);
    }
  },

  removeItem(key) {
    memoryStorage.delete(key);

    if (!isBrowserStorageAvailable()) {
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
       
      console.error('safeStorage.removeItem failed:', error);
    }
  },
};

/**
 * Creates a JSON-based storage adapter for atomWithStorage
 * that uses safeStorage under the hood.
 */
function createJsonStorage<T>(): JsonStorage<T> {
  return {
    getItem(key) {
      const raw = safeStorage.getItem(key);
      if (raw == null) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch (error) {
         
        console.error('Failed to parse stored JSON value for key', key, error);
        return null;
      }
    },
    setItem(key, value) {
      try {
        const serialized = JSON.stringify(value);
        safeStorage.setItem(key, serialized);
      } catch (error) {
         
        console.error('Failed to serialize value for key', key, error);
      }
    },
    removeItem(key) {
      safeStorage.removeItem(key);
    },
  };
}

/**
 * Helper for creating atoms that persist using safeStorage.
 *
 * Ensures:
 * - No crashes when localStorage is unavailable
 * - Graceful degradation to in-memory storage on quota errors
 */
export function createPersistentAtom<T>(key: string, initialValue: T): PrimitiveAtom<T> {
  const storage = createJsonStorage<T>();
  // atomWithStorage accepts storage with getItem returning T | null for sync storage
  return atomWithStorage<T>(key, initialValue, storage as Parameters<typeof atomWithStorage<T>>[2]);
}

