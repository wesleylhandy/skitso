/**
 * Wrap Party Component
 * 
 * Main component for the wrap party screen after performance completion.
 * Displays voting interface and social sharing options.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { performanceProgressAtom } from '@/src/state/atoms/performance-atom';
import type { SessionStatus } from '@/src/state/types/session';
import {
  initializePartyKitClient,
  getPartyKitClient,
  fetchSessionState,
  onSessionStateUpdate,
  updateSessionState,
  endSession,
  disconnectPartyKit,
} from '@/src/lib/partykit/client';
import type { VibeType } from '@/src/state/types/vibe';
import type { WrapPartyData } from '@/src/state/types/session';
import { VibeHeading } from '@/src/components/ui/vibe-heading';
import { VibePanel } from '@/src/components/ui/vibe-panel';
import { ScriptExportButton } from '@/src/components/ui/script-export-button';
import { ConfirmationModal } from '@/src/components/ui/confirmation-modal';
import { cleanupOnWrapPartyCompletion } from '@/src/lib/utils/session-cleanup';

// Lazy-load below-the-fold content (T178).
const VotingInterface = dynamic(
  () => import('./voting-interface').then((mod) => ({ default: mod.VotingInterface })),
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
  const router = useRouter();
  const { visualTokens, getSectionTitle, getButtonLabel } = useVibe();
  const atomSessionCode = useAtomValue(sessionCodeAtom);
  const setSessionCode = useSetAtom(sessionCodeAtom);
  const [wrapPartyData, setWrapPartyData] = useAtom(wrapPartyDataAtom);
  const sessionState = useAtomValue(sessionStateAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const setVibe = useSetAtom(vibeAtom);
  const participant = useAtomValue(participantAtom);
  const setCast = useSetAtom(castAtom);
  const setScript = useSetAtom(currentScriptAtom);
  const setPerformanceProgress = useSetAtom(performanceProgressAtom);
  const setParticipant = useSetAtom(participantAtom);

  const sessionCode = propSessionCode || atomSessionCode;
  const isDirector = participant?.role === 'director';
  const [showDoAnotherConfirm, setShowDoAnotherConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Sync sessionCode from URL (props) to atom so VotingInterface and other children have it.
  useEffect(() => {
    if (propSessionCode) {
      setSessionCode(propSessionCode);
    }
  }, [propSessionCode, setSessionCode]);

  // When director ends performance, PartyKit broadcasts session:state:updated with
  // status 'completed' and wrapPartyData. On session:end, status 'expired' — cleanup and redirect.
  useEffect(() => {
    if (!sessionCode) return;
    initializePartyKitClient(sessionCode);
    const unsub = onSessionStateUpdate((data) => {
      if (data.sessionId !== sessionCode) return;
      if (data.status === 'completed') {
        setSessionState('completed');
      }
      if (data.status === 'casting') {
        // Director clicked "Go Back" - redirect all participants to casting couch
        setSessionState('casting');
        if (!isDirector) {
          // Participants redirect to join page where casting couch will be shown
          router.push(`/join/${sessionCode}`);
        }
        return;
      }
      if (data.status === 'expired') {
        disconnectPartyKit();
        setSessionCode(null);
        setSessionState('idle');
        setCast([]);
        setScript(null);
        setWrapPartyData(null);
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
        cleanupOnWrapPartyCompletion(sessionCode);
        router.push('/vibe-selection');
        return;
      }
      const d = data as { wrapPartyData?: WrapPartyData | null };
      if (d.wrapPartyData) {
        setWrapPartyData(d.wrapPartyData);
      }
      if (data.vibeContext) {
        setVibe(data.vibeContext as never);
      }
    });
    return unsub;
  }, [
    sessionCode,
    router,
    setSessionState,
    setWrapPartyData,
    setVibe,
    setSessionCode,
    setCast,
    setScript,
    setParticipant,
    setPerformanceProgress,
    isDirector,
  ]);

  const stateRecoveryAttemptedRef = useRef(false);
  const [stateRecoveryAttempted, setStateRecoveryAttempted] = useState(false);
  const httpFallbackAttemptedRef = useRef(false);
  const [recoveryComplete, setRecoveryComplete] = useState(false);
  // Store setters in refs to ensure stable references for useEffect
  const setWrapPartyDataRef = useRef(setWrapPartyData);
  const setVibeRef = useRef(setVibe);
  const setSessionStateRef = useRef(setSessionState);
  const setScriptRef = useRef(setScript);

  useEffect(() => {
    setWrapPartyDataRef.current = setWrapPartyData;
    setVibeRef.current = setVibe;
    setSessionStateRef.current = setSessionState;
    setScriptRef.current = setScript;
  }, [setWrapPartyData, setVibe, setSessionState, setScript]);

  // Request state recovery on mount to hydrate wrap party data from PartyKit
  // Includes timeout and HTTP fallback for director disconnection scenarios
  useEffect(() => {
    if (!sessionCode) return;
    if (stateRecoveryAttemptedRef.current) return; // Prevent multiple attempts

    let mounted = true;
    let recoveryTimeout: NodeJS.Timeout | null = null;
    const RECOVERY_TIMEOUT_MS = 5000; // 5 seconds timeout for WebSocket recovery

    const client = initializePartyKitClient(sessionCode);

    // HTTP fallback: fetch state directly if WebSocket recovery fails
    const attemptHttpFallback = async () => {
      if (httpFallbackAttemptedRef.current || !mounted) return;
      httpFallbackAttemptedRef.current = true;
      
      // Mark recovery as attempted when we actually start HTTP fallback
      // This is set in a callback (async function), not synchronously in effect body
      if (!stateRecoveryAttemptedRef.current) {
        stateRecoveryAttemptedRef.current = true;
        setStateRecoveryAttempted(true);
      }

      try {
        const fetched = await fetchSessionState(sessionCode);
        if (fetched && mounted) {
          if (fetched.vibeContext) setVibeRef.current(fetched.vibeContext);
          if (fetched.wrapPartyData) setWrapPartyDataRef.current(fetched.wrapPartyData);
          if (fetched.script) setScriptRef.current(fetched.script);
          if ((fetched.status as SessionStatus) === 'completed') {
            setSessionStateRef.current('completed');
          }
        }
        if (mounted) {
          setRecoveryComplete(true);
        }
      } catch (error) {
        console.warn('[WrapParty] HTTP fallback failed:', error);
        if (mounted) {
          setRecoveryComplete(true);
        }
      }
    };

    const requestStateRecovery = () => {
      // Mark recovery as attempted when we actually start the recovery request
      // This is set in a callback, not synchronously in effect body
      if (!stateRecoveryAttemptedRef.current) {
        stateRecoveryAttemptedRef.current = true;
        setStateRecoveryAttempted(true);
      }
      
      const currentClient = getPartyKitClient();
      if (currentClient && currentClient.readyState === WebSocket.OPEN) {
        currentClient.send(JSON.stringify({
          type: 'state:recover',
          data: {
            sessionId: sessionCode,
            timestamp: Date.now(),
          },
        }));

        // Set timeout for HTTP fallback if WebSocket recovery doesn't complete
        recoveryTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('[WrapParty] WebSocket recovery timeout, attempting HTTP fallback');
            attemptHttpFallback();
          }
        }, RECOVERY_TIMEOUT_MS);
      } else {
        // If WebSocket isn't open, try HTTP fallback immediately after connection attempt
        client.addEventListener('open', () => {
          requestStateRecovery();
        }, { once: true });

        // Also set a timeout for initial connection
        recoveryTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('[WrapParty] WebSocket connection timeout, attempting HTTP fallback');
            attemptHttpFallback();
          }
        }, RECOVERY_TIMEOUT_MS);
      }
    };

    const handleStateRecovered = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'state:recovered' || !mounted) return;
        const data = message.data as { sessionId?: string; recovered?: boolean; vibeContext?: VibeType; wrapPartyData?: WrapPartyData | null };
        if (data.sessionId !== sessionCode) return;

        // Clear timeout since we got a response
        if (recoveryTimeout) {
          clearTimeout(recoveryTimeout);
          recoveryTimeout = null;
        }

        if (data.recovered) {
          const fetched = await fetchSessionState(sessionCode);
          if (fetched && mounted) {
            if (fetched.vibeContext) setVibeRef.current(fetched.vibeContext);
            if (fetched.wrapPartyData) setWrapPartyDataRef.current(fetched.wrapPartyData);
            if (fetched.script) setScriptRef.current(fetched.script);
            if ((fetched.status as SessionStatus) === 'completed') {
              setSessionStateRef.current('completed');
            }
          }
          if (mounted) {
            setRecoveryComplete(true);
          }
          return;
        }
        if (data.vibeContext) setVibeRef.current(data.vibeContext);
        if (data.wrapPartyData) setWrapPartyDataRef.current(data.wrapPartyData);
        if ((data as { status?: SessionStatus }).status === 'completed') {
          setSessionStateRef.current('completed');
        }
        if (mounted) {
          setRecoveryComplete(true);
        }
      } catch {
        // Ignore parse errors
      }
    };

    client.addEventListener('message', handleStateRecovered);
    
    // Mark ref for guard check (prevents multiple attempts)
    // State will be set in callbacks (requestStateRecovery/attemptHttpFallback) 
    // when recovery actually starts, not synchronously here
    stateRecoveryAttemptedRef.current = true;

    if (client.readyState === WebSocket.OPEN) {
      requestStateRecovery();
    } else {
      client.addEventListener('open', requestStateRecovery, { once: true });
      // Also attempt HTTP fallback if connection takes too long
      recoveryTimeout = setTimeout(() => {
        if (mounted) {
          attemptHttpFallback();
        }
      }, RECOVERY_TIMEOUT_MS);
    }

    return () => {
      mounted = false;
      if (recoveryTimeout) {
        clearTimeout(recoveryTimeout);
      }
      client.removeEventListener('message', handleStateRecovered);
    };
    // setVibe and setWrapPartyData are stable Jotai setters, but included for lint compliance
    // They're accessed via refs in the effect, so they won't cause unnecessary re-runs
  }, [sessionCode, setVibe, setWrapPartyData]);

  // Allow wrap party to render if wrap party data exists, even if session state isn't 'completed'
  // This handles cases where director disconnected before properly ending performance
  // but wrap party data was initialized (e.g., from previous session or partial completion)
  const isCompletedOrHasData = sessionState === 'completed' || !!wrapPartyData;
  // Only show loading if we don't have data AND haven't attempted recovery yet
  // After recovery attempts, show "not ready" instead of infinite loading
  const isLoading = !isCompletedOrHasData && !wrapPartyData && !stateRecoveryAttempted;

  // Defer cleanup until user explicitly leaves (e.g. "Start new skit").
  // cleanupOnWrapPartyCompletion is invoked on session:end (expired) or explicit Exit.

  const handleDoAnother = () => {
    if (!sessionCode) return;
    setShowDoAnotherConfirm(false);
    setCast([]);
    setScript(null);
    setWrapPartyData(null);
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
    setSessionState('configuring');
    updateSessionState(sessionCode, 'configuring');
    if (isDirector) {
      router.push('/director-desk');
    } else {
      router.push(`/join/${sessionCode}`);
    }
  };

  const handleExit = () => {
    if (!sessionCode || !isDirector) return;
    setShowExitConfirm(false);
    endSession(sessionCode);
    // Redirect happens when we receive session:state:updated { status: 'expired' }
  };

  const handleGoBack = () => {
    if (!sessionCode || !isDirector) return;
    // Reset performance progress and wrap party votes for the new run
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
    // Update session state to 'casting' - this will redirect all participants back to casting couch
    setSessionState('casting');
    updateSessionState(sessionCode, 'casting');
    // Redirect director to director-desk where casting couch will be shown
    router.push('/director-desk');
  };

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
        <header style={{ marginBottom: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <VibeHeading
              level={1}
              sectionKey="wrapParty"
              className="text-4xl md:text-5xl font-bold"
              color={visualTokens.accentColor}
            />
            <p style={{ fontFamily: visualTokens.bodyFont, fontSize: '1.2rem' }}>
              {getSectionTitle('wrapPartySubtitle')}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ScriptExportButton variant="secondary" />
            <button
              type="button"
              onClick={() => setShowDoAnotherConfirm(true)}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDoAnotherConfirm(true);
              }}
              style={{
                fontFamily: visualTokens.bodyFont,
                padding: '0.5rem 1rem',
                borderRadius: visualTokens.borderRadius,
                border: 'none',
                color: visualTokens.bgColor,
                background: visualTokens.primaryColor,
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                touchAction: 'manipulation',
              }}
              aria-label={getButtonLabel('switchVibe')}
            >
              {getButtonLabel('switchVibe')}
            </button>
            {isDirector && (
              <>
                <button
                  type="button"
                  onClick={handleGoBack}
                  style={{
                    fontFamily: visualTokens.bodyFont,
                    padding: '0.5rem 1rem',
                    borderRadius: visualTokens.borderRadius,
                    border: `2px solid ${visualTokens.accentColor}`,
                    color: visualTokens.accentColor,
                    background: 'transparent',
                    cursor: 'pointer',
                    minWidth: '44px',
                    minHeight: '44px',
                    touchAction: 'manipulation',
                  }}
                  aria-label={getButtonLabel('goBack') || 'Go Back to Casting'}
                >
                  {getButtonLabel('goBack') || 'Go Back to Casting'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowExitConfirm(true);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowExitConfirm(true);
                  }}
                  style={{
                    fontFamily: visualTokens.bodyFont,
                    padding: '0.5rem 1rem',
                    borderRadius: visualTokens.borderRadius,
                    border: 'none',
                    color: visualTokens.bgColor,
                    background: visualTokens.errorColor,
                    cursor: 'pointer',
                    minWidth: '44px',
                    minHeight: '44px',
                    touchAction: 'manipulation',
                  }}
                  aria-label={getButtonLabel('wrapPartyExit')}
                >
                  {getButtonLabel('wrapPartyExit')}
                </button>
              </>
            )}
          </div>
        </header>

        <ConfirmationModal
          isOpen={showDoAnotherConfirm}
          onClose={() => setShowDoAnotherConfirm(false)}
          onConfirm={handleDoAnother}
          title={getSectionTitle('wrapPartySwitchVibeConfirm')}
          message="You'll return to the director form (or join page) with the same session. Configure again and generate a new script."
          confirmLabel={getButtonLabel('switchVibe')}
          cancelLabel={getButtonLabel('cancel')}
          variant="default"
        />
        <ConfirmationModal
          isOpen={showExitConfirm}
          onClose={() => setShowExitConfirm(false)}
          onConfirm={handleExit}
          title={getSectionTitle('wrapPartyExitConfirm')}
          message="Everyone will be redirected and the session will end. Create a new session from vibe selection to start again."
          confirmLabel={getButtonLabel('wrapPartyExit')}
          cancelLabel={getButtonLabel('cancel')}
          variant="danger"
        />

        <main>
          {isCompletedOrHasData ? (
            <>
              <VibePanel>
                <VotingInterface sessionCode={sessionCode ?? undefined} />
              </VibePanel>
              <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <VibePanel>
                  <p
                    style={{
                      fontFamily: visualTokens.bodyFont,
                      fontSize: '1rem',
                      color: visualTokens.primaryColor,
                      opacity: 0.7,
                    }}
                  >
                    {getSectionTitle('shareComingSoon')}
                  </p>
                </VibePanel>
                <VibePanel>
                  <p
                    style={{
                      fontFamily: visualTokens.bodyFont,
                      fontSize: '1rem',
                      color: visualTokens.primaryColor,
                      opacity: 0.7,
                    }}
                  >
                    {getSectionTitle('chatReactionsComingSoon')}
                  </p>
                </VibePanel>
              </div>
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
