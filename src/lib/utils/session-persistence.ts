/**
 * Session Persistence Utility
 *
 * Handles session data persistence with 24-hour expiration.
 * Aligns with data-model Session entity (createdAt/expiresAt)
 * and PartyKit session storage semantics.
 */

import type { WrapPartyData } from '@/src/state/types/session';

export const SESSION_EXPIRY_HOURS = 24;
export const SESSION_EXPIRY_MS = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
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
 * Computes the session expiration timestamp from a creation time.
 *
 * This mirrors the Session.expiresAt field described in the data model
 * (`createdAt + 24 hours`) and should be used wherever we create
 * new sessions on the client.
 *
 * @param createdAt - Timestamp when session was created
 * @returns Unix timestamp when the session expires
 */
export function getSessionExpiryTimestamp(createdAt: number): number {
  return createdAt + SESSION_EXPIRY_MS;
}

/**
 * Checks if a session has expired based on its creation time.
 *
 * @param createdAt - Timestamp when session was created
 * @param now - Optional override for "current" time (for tests)
 * @returns true if session has expired
 */
export function isSessionExpired(createdAt: number, now: number = Date.now()): boolean {
  return now > getSessionExpiryTimestamp(createdAt);
}

/**
 * Checks if a session has expired based on its expiresAt timestamp.
 *
 * @param expiresAt - Session.expiresAt timestamp
 * @param now - Optional override for "current" time (for tests)
 * @returns true if session has expired
 */
export function hasSessionExpired(expiresAt: number, now: number = Date.now()): boolean {
  return now > expiresAt;
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
            const data = JSON.parse(stored) as { _savedAt?: number; createdAt?: number; expiresAt?: number };
            const timestamp = data.expiresAt ?? data._savedAt ?? data.createdAt;
            if (timestamp && hasSessionExpired(timestamp)) {
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
