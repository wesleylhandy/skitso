'use client';

/**
 * Director's Desk Page
 * 
 * Main page for Directors to configure sessions and generate scripts/characters.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { CastingCouch } from '@/src/components/director/casting-couch';
import { SessionShare } from '@/src/components/director/session-share';
import { ResetSessionButton } from '@/src/components/director/reset-session-button';
import { BackButton } from '@/src/components/ui/back-button';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import {
  initializePartyKitClient,
  onScriptUpdate,
  onCastUpdate,
  onSessionStateUpdate,
  onGenerationProgress,
  onReconnect,
  getPartyKitClient,
  getCharacterImageUrl,
  updateCast,
  fetchSessionState,
  joinSession,
} from '@/src/lib/partykit/client';
import { ConnectionStatusBadge } from '@/src/components/ui/connection-status-badge';
import { SessionExpirationWarning } from '@/src/components/ui/session-expiration-warning';
import { VibeHeading } from '@/src/components/ui/vibe-heading';
import { VibePanel } from '@/src/components/ui/vibe-panel';
import { GenerationStickyHeader } from '@/src/components/director/generation-sticky-header';
import type { Character, Script } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';

function DirectorConfigFormSkeleton() {
  return (
    <div
      className="animate-pulse rounded-lg border p-6 space-y-4"
      style={{
        borderColor: 'var(--color-border, rgba(255,255,255,0.08))',
        backgroundColor: 'var(--color-bg, rgba(0,0,0,0.6))',
      }}
      aria-hidden="true"
    >
      <div className="h-6 w-1/3 rounded bg-gray-700/60" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-gray-700/40" />
        <div className="h-24 w-full rounded bg-gray-700/40" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-2/3 rounded bg-gray-700/40" />
        <div className="h-10 w-full rounded bg-gray-700/40" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-1/2 rounded bg-gray-700/40" />
        <div className="h-10 w-full rounded bg-gray-700/40" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-32 rounded bg-gray-700/60" />
      </div>
    </div>
  );
}

// Code-split the heavy AI generation UI (T177).
const DirectorConfigForm = dynamic(
  () =>
    import('@/src/components/director/director-config-form').then(
      (mod) => ({ default: mod.DirectorConfigForm }),
    ),
  {
    ssr: false,
    loading: () => <DirectorConfigFormSkeleton />,
  },
);

export default function DirectorDeskPage() {
  const router = useRouter();
  const sessionState = useAtomValue(sessionStateAtom);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const [cast, setCast] = useAtom(castAtom);
  const participant = useAtomValue(participantAtom);
  const [script, setScript] = useAtom(currentScriptAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const vibe = useAtomValue(vibeAtom);
  const setVibe = useSetAtom(vibeAtom);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ phase: string; message: string } | null>(null);

  // Only show CastingCouch if we have a valid session and we are in a casting/performing state.
  // For Directors, a session is considered valid as soon as we have a sessionCode plus either a
  // cast or script (even if no participant atom is set yet). This prevents us from "forgetting"
  // a partially configured session when the Director closes and reopens the browser (T187).
  const castLength = cast?.length ?? 0;
  const hasDirectorSession = Boolean(sessionCode && (castLength > 0 || script));
  const hasActorParticipant = participant !== null;
  const hasValidSession = hasActorParticipant ? Boolean(sessionCode && castLength > 0) : hasDirectorSession;
  const isCastingOrPerforming = sessionState === 'casting' || sessionState === 'performing';
  const shouldShowCastingCouch = hasValidSession && isCastingOrPerforming;
  
  // Initialize PartyKit connection immediately on page load
  // This establishes connection status before session creation, preventing confusing "offline" messages
  // We use a unique temporary room per director to avoid interference between directors
  useEffect(() => {
    // If sessionCode already exists, the session sync effect will handle connection
    // Otherwise, connect to a unique temporary room to establish connection status immediately
    if (sessionCode) return;
    
    // Generate a unique temporary room ID for this director instance
    // This ensures isolation between different directors and prevents broadcast interference
    // Format: director-temp-{timestamp}-{random} to ensure uniqueness
    const tempRoomId = `director-temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      initializePartyKitClient(tempRoomId);
    } catch (error) {
      // Log but don't throw - connection will retry automatically
      if (process.env.NODE_ENV === 'development') {
        console.warn('[DirectorDeskPage] Failed to initialize initial PartyKit connection:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - sessionCode changes are handled by the session sync effect below
  
  // Sync state from PartyKit when session code is available
  // This switches from the lobby room to the actual session room
  useEffect(() => {
    if (!sessionCode) return;

    let mounted = true;
    // Initialize/switch to session room (will close lobby connection if needed)
    const client = initializePartyKitClient(sessionCode);

    const requestStateRecovery = () => {
      const currentClient = getPartyKitClient();
      if (currentClient && currentClient.readyState === WebSocket.OPEN) {
        currentClient.send(JSON.stringify({
          type: 'state:recover',
          data: { sessionId: sessionCode, timestamp: Date.now() },
        }));
      }
    };

    const ensureDirectorJoin = () => {
      try {
        const directorId = participant?.id ?? `director-${sessionCode}-${Date.now()}`;
        joinSession(sessionCode, directorId, {
          role: 'director',
          name: 'Director',
          // vibe omitted from effect deps to avoid setVibe→re-run→requestStateRecovery loop.
          // We read from closure; state recovery will sync vibe from server.
          ...(vibe && { vibeContext: vibe }),
        });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[DirectorDeskPage] Director join failed:', e);
        }
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
        const castWithoutImages = data.cast || [];
        
        // Images are now served via HTTP endpoint, not included in WebSocket messages
        // Convert all image URLs to HTTP URLs for consistency
        // PartyKit now sends HTTP URLs instead of data URLs to avoid WebSocket size limits
        setCast((currentCast) => {
          const castWithImageUrls = castWithoutImages.map((char) => {
            // PartyKit now sends HTTP URLs in cast updates
            // If character has an image URL, use it (should be HTTP URL from PartyKit)
            // Otherwise, construct HTTP endpoint URL
            const imageUrl = char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0
              ? char.visualRepresentation.imageUrl
              : getCharacterImageUrl(data.sessionId, char.id);
            
            // Ensure we're using HTTP URLs, not data URLs
            // If somehow we get a data URL, convert it to HTTP URL
            const finalImageUrl = imageUrl.startsWith('data:')
              ? getCharacterImageUrl(data.sessionId, char.id)
              : imageUrl;
            
            return {
              ...char,
              visualRepresentation: {
                ...char.visualRepresentation,
                imageUrl: finalImageUrl,
              },
            };
          });
          return castWithImageUrls;
        });
      }
    });

    // Listen for session state updates
    const unsubscribeState = onSessionStateUpdate((data) => {
      if (data.sessionId === sessionCode && mounted) {
        setSessionState(data.status);
        if (data.vibeContext) {
          setVibe(data.vibeContext);
        }
        if (data.status === 'casting') {
          setGenerationProgress(null);
        }
      }
    });

    const unsubscribeGenerationProgress = onGenerationProgress((data) => {
      if (data.sessionId === sessionCode && mounted) {
        setGenerationProgress({ phase: data.phase, message: data.message });
      }
    });

    const unsubscribeReconnect = onReconnect((data) => {
      if (data.sessionId === sessionCode && mounted) {
        setTimeout(() => {
          ensureDirectorJoin();
          requestStateRecovery();
        }, 100);
      }
    });

    const applyRecoveredData = (recoveredData: {
      sessionId: string;
      vibeContext?: VibeType;
      status?: string;
      cast?: Character[];
      script?: Script | null;
      expiresAt?: number;
    }) => {
      if (recoveredData.sessionId !== sessionCode || !mounted) return;
      if (recoveredData.vibeContext) setVibe(recoveredData.vibeContext);
      if (recoveredData.cast !== undefined) {
        const recoveredCast = recoveredData.cast || [];
        const recoveredCastHasImages = recoveredCast.filter(
          (c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0
        ).length;
        const localCastHasImages = cast.filter(
          (c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0
        ).length;
        console.log('[DirectorDesk] Updating cast from PartyKit state recovery', {
          sessionId: recoveredData.sessionId,
          castLength: recoveredCast.length,
          recoveredCastHasImages,
          localCastHasImages,
        });
        if (localCastHasImages > 0 && recoveredCastHasImages === 0 && cast.length > 0) {
          try {
            updateCast(sessionCode, cast);
          } catch (e) {
            console.error('[DirectorDesk] Failed to resend cast with images:', e);
          }
        }
        setCast(recoveredCast);
      } else {
        setCast([]);
      }
      setScript(recoveredData.script ?? null);
      if (recoveredData.status) {
        setSessionState(recoveredData.status as 'idle' | 'configuring' | 'casting' | 'performing' | 'completed' | 'expired');
      }
      if (typeof recoveredData.expiresAt === 'number') setSessionExpiresAt(recoveredData.expiresAt);
    };

    const handleStateRecovered = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'state:recovered' || !mounted) return;
        const data = message.data as { sessionId?: string; recovered?: boolean; isExpired?: boolean };
        if (data.sessionId !== sessionCode) return;
        if (data.isExpired) {
          setSessionState('expired');
          return;
        }
        if (data.recovered) {
          const fetched = await fetchSessionState(sessionCode);
          if (fetched && mounted) applyRecoveredData(fetched);
          return;
        }
        applyRecoveredData(message.data);
      } catch {
        // Ignore parse errors
      }
    };

    client.addEventListener('message', handleStateRecovered);

    const onOpen = () => {
      ensureDirectorJoin();
      requestStateRecovery();
    };
    if (client.readyState === WebSocket.OPEN) {
      onOpen();
    } else {
      client.addEventListener('open', onOpen, { once: true });
    }

    return () => {
      mounted = false;
      client.removeEventListener('message', handleStateRecovered);
      unsubscribeScript();
      unsubscribeCast();
      unsubscribeState();
      unsubscribeGenerationProgress();
      unsubscribeReconnect();
    };
    // Omit vibe (and cast/script) to avoid loop: setVibe from messages → re-run → requestStateRecovery → setVibe again.
  }, [sessionCode, setScript, setCast, setSessionState, setVibe, participant]);

  // Clear generation progress when session code is cleared (e.g., on reset)
  useEffect(() => {
    if (!sessionCode) {
      setGenerationProgress(null);
    }
  }, [sessionCode, setGenerationProgress]);

  // Auto-fix: If state says casting/performing but we don't have a valid session,
  // reset state to idle to prevent flashing and show form
  // BUT: Don't reset during generation or immediately after connection (allow time for state recovery)
  useEffect(() => {
    if (isCastingOrPerforming && !hasValidSession) {
      // Don't reset if generation is in progress (cast/script might be syncing)
      if (generationProgress) {
        if (process.env.NODE_ENV === 'development') {
           
          console.log('[DirectorDeskPage] Generation in progress, skipping state reset to allow sync');
        }
        return;
      }
      
      // Add a small delay to allow state recovery to complete after reconnection
      // This prevents race conditions where state recovery hasn't updated cast/script yet
      const timeoutId = setTimeout(() => {
        // Re-check after delay - state recovery might have updated cast/script
        // Use a function to get current atom values
        setSessionState((currentState) => {
          // Only reset if still in casting/performing state and still no valid session
          const isStillCastingOrPerforming = currentState === 'casting' || currentState === 'performing';
          if (!isStillCastingOrPerforming) {
            return currentState; // State changed, don't reset
          }
          
          // Re-check cast/script from atoms (they might have been updated by state recovery)
          // Note: We can't directly read atoms here, so we'll use the values from the effect closure
          // The effect will re-run if cast/script change, so this is safe
          const currentCastLength = cast?.length ?? 0;
          const currentHasDirectorSession = Boolean(sessionCode && (currentCastLength > 0 || script));
          const currentHasValidSession = hasActorParticipant 
            ? Boolean(sessionCode && currentCastLength > 0) 
            : currentHasDirectorSession;
          
          if (!currentHasValidSession) {
            if (process.env.NODE_ENV === 'development') {
               
              console.warn('[DirectorDeskPage] Inconsistent state: casting/performing but no valid session after delay. Resetting to idle.');
            }
            return 'idle';
          }
          
          return currentState; // Valid session, keep current state
        });
      }, 1000); // Wait 1 second for state recovery to complete
      
      return () => clearTimeout(timeoutId);
    }
  }, [isCastingOrPerforming, hasValidSession, setSessionState, generationProgress, sessionCode, cast, script, hasActorParticipant]);

  // Ensure body overflow is reset on mount (in case a modal left it hidden)
  useEffect(() => {
    // Reset body overflow to allow page scrolling
    document.body.style.overflow = '';
    return () => {
      // Cleanup: restore overflow if needed (though it should be empty string by default)
      document.body.style.overflow = '';
    };
  }, []);

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
     
    console.log('[DirectorDeskPage] State:', {
      sessionState,
      sessionCode,
      castLength,
      hasParticipant: participant !== null,
      participantRole: participant?.role,
      hasValidSession,
      shouldShowCastingCouch,
    });
  }

  // Determine if generation is in progress
  const isGenerating = sessionState === 'configuring' || generationProgress !== null;

  return (
    <>
      {/* Sticky Header - Shows during generation or when session exists */}
      <GenerationStickyHeader
        generationProgress={generationProgress}
        isGenerating={isGenerating}
      />
      <main className="min-h-screen p-8 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-4xl mx-auto">
          <div
            style={{
              marginBottom: '2rem',
            }}
          >
            <BackButton to="/vibe-selection" />
          </div>
        <VibePanel className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <VibeHeading level={1} sectionKey="configuration" className="text-4xl font-bold" />
            <div className="flex flex-wrap items-center gap-4">
              <ConnectionStatusBadge />
              <ResetSessionButton variant="secondary" />
            </div>
          </div>
        </VibePanel>
        
        {/* Session Code - Show in main content when NOT generating (sticky header shows it during generation) */}
        {!isGenerating && sessionCode && (
          <div className="mb-8">
            <SessionShare />
          </div>
        )}
        
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
    </>
  );
}
