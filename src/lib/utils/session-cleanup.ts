/**
 * Session Cleanup Orchestration
 *
 * Provides higher-level helpers that coordinate client-side cleanup
 * of expired or completed sessions across:
 * - localStorage (session persistence keys)
 * - wrap party cached data
 */

import { cleanupExpiredSessions, removeWrapPartyData } from '@/src/lib/utils/session-persistence';
import { clearSessionState } from '@/src/lib/utils/session-state-cleanup';

/**
 * Run lightweight background cleanup for expired sessions.
 *
 * Safe to call on app startup or on page load; it only touches
 * client-side storage and never throws.
 */
export function runBackgroundSessionCleanup(): void {
  try {
    cleanupExpiredSessions();
  } catch (error) {
     
    console.error('Background session cleanup failed:', error);
  }
}

/**
 * Cleanup client-side session artifacts when a wrap party
 * has finished and the user is done with the session.
 *
 * This keeps browser storage within limits and prevents
 * stale state from leaking into the next performance.
 */
export function cleanupOnWrapPartyCompletion(sessionId: string | null | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (sessionId) {
      removeWrapPartyData(sessionId);
    }
    clearSessionState();
  } catch (error) {
     
    console.error('Failed to cleanup session after wrap party completion:', error);
  }
}

