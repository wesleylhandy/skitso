/**
 * Session storage optimization helpers (T181g).
 *
 * Provides namespaced accessors for session-related data so we can
 * manage large numbers of sessions more efficiently and clean up
 * unused entries without scanning unrelated localStorage keys.
 */

const SESSION_STORAGE_PREFIX = 'skitso_session_data_';

export interface SessionStorageEntry<T> {
  value: T;
  updatedAt: number;
}

function makeKey(sessionId: string): string {
  return `${SESSION_STORAGE_PREFIX}${sessionId}`;
}

export function saveSessionData<T>(sessionId: string, value: T): void {
  if (typeof window === 'undefined') return;
  const entry: SessionStorageEntry<T> = {
    value,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(makeKey(sessionId), JSON.stringify(entry));
  } catch {
    // Best-effort only; ignore quota errors
  }
}

export function loadSessionData<T>(sessionId: string): SessionStorageEntry<T> | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(makeKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionStorageEntry<T>;
  } catch {
    window.localStorage.removeItem(makeKey(sessionId));
    return null;
  }
}

export function removeSessionData(sessionId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(makeKey(sessionId));
}

export function cleanupStaleSessionData(olderThanMs: number): number {
  if (typeof window === 'undefined') return 0;
  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(SESSION_STORAGE_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      keysToRemove.push(key);
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as SessionStorageEntry<unknown>;
      if (!parsed.updatedAt || now - parsed.updatedAt > olderThanMs) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  return keysToRemove.length;
}

