/**
 * Session State Cleanup Utility
 * 
 * Provides utilities to clear session-specific state from localStorage.
 * Session-specific state should be cleared when:
 * - Starting a new session
 * - Session expires
 * - User explicitly resets
 * 
 * User preferences (vibe, chaosLevel default) should NOT be cleared.
 */

/**
 * Keys for session-specific state that should be cleared
 * These are stored in localStorage via atomWithStorage
 */
const SESSION_STATE_KEYS = [
  'session_code',
  'session_state',
  'cast',
  'current_script',
  'participant',
  'performance_progress',
  'wrap_party_data',
] as const;

/**
 * Keys for user preferences that should persist across sessions
 */
const USER_PREFERENCE_KEYS = [
  'vibe',
  'chaos_level', // Keep as preference, but can be overridden per session
] as const;

/**
 * Clears all session-specific state from localStorage
 * 
 * This should be called when:
 * - Starting a new session
 * - Session expires
 * - User explicitly wants to reset
 * 
 * User preferences are preserved.
 */
export function clearSessionState(): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  try {
    SESSION_STATE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear session state:', error);
  }
}

/**
 * Validates if the current session state is consistent
 * 
 * A session is considered valid if:
 * - sessionCode exists
 * - sessionState is not 'idle' (meaning a session was started)
 * - cast exists (for casting/performing states)
 * 
 * @returns true if session state appears valid, false otherwise
 */
export function validateSessionState(): boolean {
  if (typeof window === 'undefined') {
    return false; // Server-side, always invalid
  }

  try {
    const sessionCodeRaw = localStorage.getItem('session_code');
    const sessionStateRaw = localStorage.getItem('session_state');
    const castRaw = localStorage.getItem('cast');

    // Parse JSON values (atomWithStorage stores as JSON strings)
    let sessionCode: string | null = null;
    let sessionState: string | null = null;
    let cast: unknown = null;

    try {
      sessionCode = sessionCodeRaw ? JSON.parse(sessionCodeRaw) : null;
      sessionState = sessionStateRaw ? JSON.parse(sessionStateRaw) : null;
      cast = castRaw ? JSON.parse(castRaw) : null;
    } catch {
      // Invalid JSON, consider state invalid
      return false;
    }

    // If no session code, state should be idle
    if (!sessionCode || sessionCode === null) {
      if (sessionState && sessionState !== 'idle') {
        return false; // Inconsistent: no session code but non-idle state
      }
      return true; // Valid: no session
    }

    // If session code exists, check if state is consistent
    // Allow 'idle' state with session code - might be starting fresh
    // Only invalidate if state is casting/performing without cast
    if (sessionState === 'idle') {
      // This is actually valid - user might have session code but be starting fresh
      return true;
    }

    // For casting/performing states, cast should exist and be non-empty
    if (sessionState === 'casting' || sessionState === 'performing') {
      if (!cast || (Array.isArray(cast) && cast.length === 0)) {
        return false; // Inconsistent: casting/performing but no cast
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to validate session state:', error);
    return false;
  }
}

/**
 * Clears session state if it's invalid or stale
 * 
 * This is a safe operation that only clears state if it's inconsistent.
 * User preferences are always preserved.
 */
export function cleanupInvalidSessionState(): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  if (!validateSessionState()) {
    console.log('Invalid session state detected, clearing...');
    clearSessionState();
    // Reset session state to idle
    localStorage.setItem('session_state', '"idle"');
  }
}

/**
 * Gets all session state keys (for debugging/testing)
 */
export function getSessionStateKeys(): readonly string[] {
  return SESSION_STATE_KEYS;
}

/**
 * Gets all user preference keys (for debugging/testing)
 */
export function getUserPreferenceKeys(): readonly string[] {
  return USER_PREFERENCE_KEYS;
}
