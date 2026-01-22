'use client';

/**
 * Director's Desk Page
 * 
 * Main page for Directors to configure sessions and generate scripts/characters.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { DirectorConfigForm } from '@/src/components/director/director-config-form';
import { CastingCouch } from '@/src/components/director/casting-couch';
import { SessionShare } from '@/src/components/director/session-share';
import { ResetSessionButton } from '@/src/components/director/reset-session-button';
import { BackButton } from '@/src/components/ui/back-button';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import {
  initializePartyKitClient,
  onScriptUpdate,
  onCastUpdate,
  onSessionStateUpdate,
  onReconnect,
  getPartyKitClient,
} from '@/src/lib/partykit/client';
import { ConnectionStatusBadge } from '@/src/components/ui/connection-status-badge';
import { SessionExpirationWarning } from '@/src/components/ui/session-expiration-warning';

export default function DirectorDeskPage() {
  const router = useRouter();
  const sessionState = useAtomValue(sessionStateAtom);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const [cast, setCast] = useAtom(castAtom);
  const participant = useAtomValue(participantAtom);
  const [script, setScript] = useAtom(currentScriptAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  
  // Only show CastingCouch if we have a valid session (sessionCode, cast, and participant)
  // and the session state is casting or performing
  // CastingCouch requires all three, so we need to check participant too
  const hasValidSession = sessionCode && cast.length > 0 && participant !== null;
  const isCastingOrPerforming = sessionState === 'casting' || sessionState === 'performing';
  const shouldShowCastingCouch = hasValidSession && isCastingOrPerforming;
  
  // Sync state from PartyKit when session code is available
  useEffect(() => {
    if (!sessionCode) return;

    let mounted = true;
    const client = initializePartyKitClient(sessionCode);

    // Request state recovery function
    const requestStateRecovery = () => {
      const currentClient = getPartyKitClient();
      if (currentClient && currentClient.readyState === WebSocket.OPEN) {
        currentClient.send(JSON.stringify({
          type: 'state:recover',
          data: {
            sessionId: sessionCode,
            timestamp: Date.now(),
          },
        }));
      }
    };

    // Listen for script updates
    const unsubscribeScript = onScriptUpdate((data) => {
      if (data.sessionId === sessionCode && mounted) {
        setScript(data.script);
      }
    });

    // Listen for cast updates
    const unsubscribeCast = onCastUpdate((data) => {
      if (data.sessionId === sessionCode && mounted) {
        setCast(data.cast);
      }
    });

    // Listen for session state updates
    const unsubscribeState = onSessionStateUpdate((data) => {
      if (data.sessionId === sessionCode && mounted) {
        setSessionState(data.status);
      }
    });

    // Listen for reconnection events - auto-recover state
    const unsubscribeReconnect = onReconnect((data) => {
      if (data.sessionId === sessionCode && mounted) {
        console.log('Reconnection detected, requesting state recovery');
        // Small delay to ensure connection is fully established
        setTimeout(() => {
          requestStateRecovery();
        }, 100);
      }
    });

    // Set up event listener for state:recovered
    const handleStateRecovered = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'state:recovered' && mounted) {
          const recoveredData = message.data;
          if (recoveredData.sessionId === sessionCode) {
            // Update cast if provided
            if (recoveredData.cast) {
              setCast(recoveredData.cast);
            }
            // Update script if provided
            if (recoveredData.script !== undefined) {
              setScript(recoveredData.script);
            }
            // Update session state if provided
            if (recoveredData.status) {
              setSessionState(recoveredData.status as 'idle' | 'configuring' | 'casting' | 'performing');
            }
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    };

    client.addEventListener('message', handleStateRecovered);

    // Request state recovery on mount
    if (client.readyState === WebSocket.OPEN) {
      requestStateRecovery();
    } else {
      client.addEventListener('open', requestStateRecovery, { once: true });
    }

    return () => {
      mounted = false;
      client.removeEventListener('message', handleStateRecovered);
      unsubscribeScript();
      unsubscribeCast();
      unsubscribeState();
      unsubscribeReconnect();
    };
  }, [sessionCode, setScript, setCast, setSessionState]);

  // Auto-fix: If state says casting/performing but we don't have a valid session,
  // reset state to idle to prevent flashing and show form
  useEffect(() => {
    if (isCastingOrPerforming && !hasValidSession) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[DirectorDeskPage] Inconsistent state: casting/performing but no valid session. Resetting to idle.');
      }
      setSessionState('idle');
    }
  }, [isCastingOrPerforming, hasValidSession, setSessionState]);

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[DirectorDeskPage] State:', {
      sessionState,
      sessionCode,
      castLength: cast.length,
      hasParticipant: participant !== null,
      participantRole: participant?.role,
      hasValidSession,
      shouldShowCastingCouch,
    });
  }

  return (
    <main className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-4xl mx-auto">
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/vibe-selection" />
        </div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-header)', color: 'var(--color-text)' }}>
            Director&apos;s Desk
          </h1>
          <div className="flex items-center gap-4">
            <ConnectionStatusBadge />
            {/* Reset button - always visible */}
            <ResetSessionButton variant="secondary" />
          </div>
        </div>
        
        {/* Session Code - Always visible when session exists */}
        <div className="mb-8">
          <SessionShare />
        </div>
        
        {/* Session Expiration Warning */}
        {sessionExpiresAt && (
          <div className="mb-4">
            <SessionExpirationWarning expiresAt={sessionExpiresAt} />
          </div>
        )}
        
        <div className="space-y-8">
          {shouldShowCastingCouch ? (
            <CastingCouch
              onStartPerformance={() => {
                // Navigate to stage when performance starts
                if (sessionCode) {
                  router.push(`/stage/${sessionCode}`);
                }
              }}
            />
          ) : (
            <DirectorConfigForm />
          )}
        </div>
      </div>
    </main>
  );
}
