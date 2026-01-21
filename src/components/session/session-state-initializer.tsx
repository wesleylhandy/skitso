/**
 * Session State Initializer
 * 
 * Client component that validates and cleans up session state on app initialization.
 * This ensures stale or invalid session state doesn't persist across browser sessions.
 * 
 * Should be mounted once at the root of the app.
 */

'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { cleanupInvalidSessionState, validateSessionState } from '@/src/lib/utils/session-state-cleanup';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { performanceProgressAtom } from '@/src/state/atoms/performance-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';

/**
 * Initializes and validates session state on mount
 * 
 * This component:
 * - Validates persisted session state
 * - Clears invalid/stale state using atom setters (not direct localStorage)
 * - Ensures consistent state on app load
 */
export function SessionStateInitializer() {
  const setSessionState = useSetAtom(sessionStateAtom);
  const setSessionCode = useSetAtom(sessionCodeAtom);
  const setCast = useSetAtom(castAtom);
  const setScript = useSetAtom(currentScriptAtom);
  const setParticipant = useSetAtom(participantAtom);
  const setPerformanceProgress = useSetAtom(performanceProgressAtom);
  const setWrapPartyData = useSetAtom(wrapPartyDataAtom);

  useEffect(() => {
    // Validate session state
    const isValid = validateSessionState();
    
    if (!isValid) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[SessionStateInitializer] Invalid session state detected, clearing...');
      }
      
      // Clear session state using atom setters (ensures proper sync)
      setSessionCode(null);
      setSessionState('idle');
      setCast([]);
      setScript(null);
      setParticipant(null);
      setPerformanceProgress({
        currentLineIndex: 0,
        currentScene: 0,
        startedAt: null,
        pausedAt: null,
        completedLines: [],
        advancementControl: {
          lastAdvancedBy: null,
          lastAdvancedAt: null,
          directorOverride: false,
        },
      });
      setWrapPartyData(null);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[SessionStateInitializer] Session state is valid');
    }
  }, [setSessionState, setSessionCode, setCast, setScript, setParticipant, setPerformanceProgress, setWrapPartyData]);

  // This component doesn't render anything
  return null;
}
