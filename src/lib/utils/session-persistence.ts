/**
 * Session Persistence Utility
 * 
 * Handles session data persistence with 24-hour expiration.
 */

import type { WrapPartyData } from '@/src/state/types/session';

const SESSION_EXPIRY_HOURS = 24;
const STORAGE_KEY_PREFIX = 'skitso_session_';

/**
 * Gets the storage key for a session
 * 
 * @param sessionId - The session ID
 * @returns Storage key
 */
function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

/**
 * Checks if a session has expired
 * 
 * @param createdAt - Timestamp when session was created
 * @returns true if session has expired
 */
export function isSessionExpired(createdAt: number): boolean {
  const now = Date.now();
  const expiryTime = createdAt + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  return now > expiryTime;
}

/**
 * Saves wrap party data to localStorage with expiration
 * 
 * @param wrapPartyData - The wrap party data to save
 */
export function saveWrapPartyData(wrapPartyData: WrapPartyData): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  const storageKey = getStorageKey(wrapPartyData.sessionId);
  const data = {
    ...wrapPartyData,
    _savedAt: Date.now(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save wrap party data:', error);
  }
}

/**
 * Loads wrap party data from localStorage
 * 
 * @param sessionId - The session ID
 * @returns Wrap party data or null if not found or expired
 */
export function loadWrapPartyData(sessionId: string): WrapPartyData | null {
  if (typeof window === 'undefined') {
    return null; // Server-side, return null
  }

  const storageKey = getStorageKey(sessionId);

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as WrapPartyData & { _savedAt?: number };
    
    // Check if expired
    if (data._savedAt && isSessionExpired(data._savedAt)) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Remove internal metadata
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _savedAt, ...wrapPartyData } = data;
    return wrapPartyData;
  } catch (error) {
    console.error('Failed to load wrap party data:', error);
    return null;
  }
}

/**
 * Cleans up expired sessions from localStorage
 * 
 * Iterates through all session keys and removes expired ones.
 */
export function cleanupExpiredSessions(): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const data = JSON.parse(stored) as { _savedAt?: number; createdAt?: number };
            const timestamp = data._savedAt || data.createdAt;
            if (timestamp && isSessionExpired(timestamp)) {
              keysToRemove.push(key);
            }
          } catch {
            // Invalid data, remove it
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });

    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} expired session(s)`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
}

/**
 * Removes wrap party data for a session
 * 
 * @param sessionId - The session ID
 */
export function removeWrapPartyData(sessionId: string): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  const storageKey = getStorageKey(sessionId);
  localStorage.removeItem(storageKey);
}
