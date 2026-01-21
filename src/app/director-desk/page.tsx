'use client';

/**
 * Director's Desk Page
 * 
 * Main page for Directors to configure sessions and generate scripts/characters.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAtomValue, useSetAtom } from 'jotai';
import { DirectorConfigForm } from '@/src/components/director/director-config-form';
import { CastingCouch } from '@/src/components/director/casting-couch';
import { SessionShare } from '@/src/components/director/session-share';
import { ResetSessionButton } from '@/src/components/director/reset-session-button';
import { BackButton } from '@/src/components/ui/back-button';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';

export default function DirectorDeskPage() {
  const router = useRouter();
  const sessionState = useAtomValue(sessionStateAtom);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const cast = useAtomValue(castAtom);
  const participant = useAtomValue(participantAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  
  // Only show CastingCouch if we have a valid session (sessionCode, cast, and participant)
  // and the session state is casting or performing
  // CastingCouch requires all three, so we need to check participant too
  const hasValidSession = sessionCode && cast.length > 0 && participant !== null;
  const isCastingOrPerforming = sessionState === 'casting' || sessionState === 'performing';
  const shouldShowCastingCouch = hasValidSession && isCastingOrPerforming;
  
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
          {/* Reset button - always visible */}
          <ResetSessionButton variant="secondary" />
        </div>
        
        {/* Session Code - Always visible when session exists */}
        <div className="mb-8">
          <SessionShare />
        </div>
        
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
