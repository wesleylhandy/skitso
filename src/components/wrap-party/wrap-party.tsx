/**
 * Wrap Party Component
 * 
 * Main component for the wrap party screen after performance completion.
 * Displays voting interface and social sharing options.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import dynamic from 'next/dynamic';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { initializePartyKitClient, getPartyKitClient, fetchSessionState } from '@/src/lib/partykit/client';
import type { VibeType } from '@/src/state/types/vibe';
import type { WrapPartyData } from '@/src/state/types/session';
import { VibeHeading } from '@/src/components/ui/vibe-heading';
import { VibePanel } from '@/src/components/ui/vibe-panel';
import { cleanupOnWrapPartyCompletion } from '@/src/lib/utils/session-cleanup';

// Lazy-load below-the-fold content (T178).
const VotingInterface = dynamic(
  () => import('./voting-interface').then((mod) => ({ default: mod.VotingInterface })),
  { ssr: false },
);

const SocialShare = dynamic(
  () => import('./social-share').then((mod) => ({ default: mod.SocialShare })),
  { ssr: false },
);

interface WrapPartyProps {
  sessionCode?: string;
}

/**
 * WrapParty Component
 * 
 * Main wrap party screen with voting and sharing.
 */
export function WrapParty({ sessionCode: propSessionCode }: WrapPartyProps) {
  const { visualTokens, getSectionTitle } = useVibe();
  const atomSessionCode = useAtomValue(sessionCodeAtom);
  const [wrapPartyData, setWrapPartyData] = useAtom(wrapPartyDataAtom);
  const sessionState = useAtomValue(sessionStateAtom);
  const setVibe = useSetAtom(vibeAtom);

  const sessionCode = propSessionCode || atomSessionCode;
  const hasCleanedUpRef = useRef(false);

  // Request state recovery on mount to hydrate wrap party data from PartyKit
  useEffect(() => {
    if (!sessionCode) return;

    let mounted = true;
    const client = initializePartyKitClient(sessionCode);

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

    const handleStateRecovered = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'state:recovered' || !mounted) return;
        const data = message.data as { sessionId?: string; recovered?: boolean; vibeContext?: VibeType; wrapPartyData?: WrapPartyData | null };
        if (data.sessionId !== sessionCode) return;
        if (data.recovered) {
          const fetched = await fetchSessionState(sessionCode);
          if (fetched && mounted) {
            if (fetched.vibeContext) setVibe(fetched.vibeContext);
            if (fetched.wrapPartyData) setWrapPartyData(fetched.wrapPartyData);
          }
          return;
        }
        if (data.vibeContext) setVibe(data.vibeContext);
        if (data.wrapPartyData) setWrapPartyData(data.wrapPartyData);
      } catch {
        // Ignore parse errors
      }
    };

    client.addEventListener('message', handleStateRecovered);

    if (client.readyState === WebSocket.OPEN) {
      requestStateRecovery();
    } else {
      client.addEventListener('open', requestStateRecovery, { once: true });
    }

    return () => {
      mounted = false;
      client.removeEventListener('message', handleStateRecovered);
    };
  }, [sessionCode, setWrapPartyData, setVibe]);

  const isCompletedOrHasData = sessionState === 'completed' || !!wrapPartyData;
  const isLoading = !isCompletedOrHasData && !wrapPartyData;

  // When wrap party is complete, run a one-time client-side cleanup so
  // that browser storage doesn't accumulate stale session data.
  useEffect(() => {
    if (!sessionCode) return;
    if (!isCompletedOrHasData) return;
    if (hasCleanedUpRef.current) return;

    hasCleanedUpRef.current = true;
    cleanupOnWrapPartyCompletion(sessionCode);
  }, [isCompletedOrHasData, sessionCode]);

  return (
    <div 
      className="wrap-party"
      style={{
        minHeight: '100vh',
        background: visualTokens.bgColor,
        color: visualTokens.primaryColor,
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <VibeHeading
            level={1}
            sectionKey="wrapParty"
            className="text-4xl md:text-5xl font-bold"
          />
          <p style={{ fontFamily: visualTokens.bodyFont, fontSize: '1.2rem' }}>
            {getSectionTitle('wrapPartySubtitle')}
          </p>
        </header>

        <main>
          {isCompletedOrHasData ? (
            <>
              <VibePanel>
                <VotingInterface />
              </VibePanel>
              {wrapPartyData && (
                <div style={{ marginTop: '3rem' }}>
                  <VibePanel>
                    <SocialShare sessionCode={sessionCode || ''} />
                  </VibePanel>
                </div>
              )}
            </>
          ) : isLoading ? (
            <VibePanel>
              <div className="animate-pulse space-y-4" aria-hidden="true">
                <div className="h-6 w-1/2 rounded bg-gray-700/60" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-gray-700/40" />
                  <div className="h-4 w-5/6 rounded bg-gray-700/40" />
                  <div className="h-4 w-2/3 rounded bg-gray-700/30" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-700/30" />
                  <div className="h-4 w-1/2 rounded bg-gray-700/30" />
                </div>
              </div>
            </VibePanel>
          ) : (
            <p style={{ fontFamily: visualTokens.bodyFont, fontSize: '1rem' }}>
              {getSectionTitle('wrapPartyNotReady')}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
