/**
 * Session Join Page
 * 
 * Dynamic route for joining a session via shareable link.
 * Extracts session code from URL, validates session, and syncs VibeContext.
 */

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom, useAtomValue } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { SessionJoinForm } from '@/src/components/actor/session-join-form';
import { CharacterCard } from '@/src/components/actor/character-card';
import { ActorPreview } from '@/src/components/actor/actor-preview';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { BackButton } from '@/src/components/ui/back-button';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import {
  initializePartyKitClient,
  onPerformanceStart,
  onCharacterAssigned,
  onAssignmentApproved,
  onAssignmentSuggested,
  onAssignmentConfirmed,
  onScriptUpdate,
  onCastUpdate,
  onSessionStateUpdate,
  onGenerationProgress,
  onReconnect,
  getPartyKitClient,
  joinSession,
  getCharacterImageUrl,
  fetchSessionState,
} from '@/src/lib/partykit/client';
import { ConnectionStatusBadge } from '@/src/components/ui/connection-status-badge';
import { SessionExpirationWarning } from '@/src/components/ui/session-expiration-warning';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { VibeHeading } from '@/src/components/ui/vibe-heading';
import { VibePanel } from '@/src/components/ui/vibe-panel';
import type { VibeType } from '@/src/state/types/vibe';
import type { Character, Script } from '@/src/state/types/session';
import { clearSessionState } from '@/src/lib/utils/session-state-cleanup';

interface SessionJoinPageProps {
  params: Promise<{ sessionCode: string }>;
}

export default function SessionJoinPage({ params }: SessionJoinPageProps) {
  const { sessionCode } = use(params);
  const router = useRouter();
  const [, setVibe] = useAtom(vibeAtom);
  const [, setSessionCode] = useAtom(sessionCodeAtom);
  const [participant, setParticipant] = useAtom(participantAtom);
  const [sessionState, setSessionState] = useAtom(sessionStateAtom);
  const [cast, setCast] = useAtom(castAtom);
  const [script, setScript] = useAtom(currentScriptAtom);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinedDuringPerformance, setJoinedDuringPerformance] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ phase: string; message: string } | null>(null);
  const { visualTokens, getSectionTitle, getErrorMessage } = useVibe();

  // Load session data via PartyKit first (with REST API fallback)
  useEffect(() => {
    let mounted = true;
    let socketCleanup: (() => void) | null = null;

    // Check if we're refreshing the same session or joining a new one
    const currentStoredSessionCode = typeof window !== 'undefined' 
      ? (() => {
          try {
            const stored = localStorage.getItem('session_code');
            return stored ? JSON.parse(stored) : null;
          } catch {
            return null;
          }
        })()
      : null;
    
    const currentStoredParticipant = typeof window !== 'undefined'
      ? (() => {
          try {
            const stored = localStorage.getItem('participant');
            return stored ? JSON.parse(stored) : null;
          } catch {
            return null;
          }
        })()
      : null;
    
    const isSameSession = currentStoredSessionCode === sessionCode;
    const hasExistingParticipant = currentStoredParticipant && 
      currentStoredParticipant.sessionId === sessionCode;
    
    console.log('[JoinPage] Session state check:', {
      storedSessionCode: currentStoredSessionCode,
      newSessionCode: sessionCode,
      isSameSession,
      hasExistingParticipant,
      participantId: currentStoredParticipant?.id,
      reason: isSameSession 
        ? (hasExistingParticipant ? 'refresh_same_session' : 'same_session_no_participant')
        : 'session_code_changed',
    });
    
    // Only clear state if session code changed
    // If same session, preserve participant to avoid duplicate joins
    if (!isSameSession) {
      console.log('[JoinPage] Different session, clearing all state');
      clearSessionState();
      setGenerationProgress(null);
      setCast([]);
      setScript(null);
      setParticipant(null);
      setSessionState('idle');
    } else {
      // Same session - preserve participant but clear other state
      // PartyKit will hydrate cast/script/state via state:recovered
      console.log('[JoinPage] Same session, preserving participant, clearing other state');
      
      // CRITICAL: Validate that existing participant belongs to this session
      // Clear participant if it belongs to a different session (stale data)
      if (currentStoredParticipant && currentStoredParticipant.sessionId !== sessionCode) {
        console.log('[JoinPage] Stale participant data detected (different sessionId), clearing participant');
        setParticipant(null);
        // Also clear from localStorage to prevent future issues
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('participant');
          } catch (error) {
            console.error('Failed to clear stale participant from localStorage:', error);
          }
        }
      }
      
      setGenerationProgress(null);
      setCast([]);
      setScript(null);
      setSessionState('idle');
      // Keep participant only if it belongs to this session
      // If participant exists in localStorage, it will be restored by the atom
    }

    async function loadSession() {
      // Primary path: connect via PartyKit and hydrate full state
      try {
        let retryCount = 0;
        const maxRetries = 5;
        const baseDelay = 500; // 500ms base delay
        let client: ReturnType<typeof initializePartyKitClient> | null = null;

        const connectWithRetry = async (): Promise<void> => {
          while (retryCount < maxRetries) {
            try {
              client = initializePartyKitClient(sessionCode);

              // Wait for PartyKit connection
              await new Promise<void>((resolve, reject) => {
                if (client && client.readyState === WebSocket.OPEN) {
                  resolve();
                  return;
                }

                const timeout = setTimeout(() => {
                  reject(new Error('PartyKit connection timeout'));
                }, 5000);

                let connectionClosed = false;

                const onClose = () => {
                  connectionClosed = true;
                  clearTimeout(timeout);
                  reject(new Error('ROOM_NOT_READY'));
                };

                const onError = () => {
                  if (!connectionClosed) {
                    clearTimeout(timeout);
                    reject(new Error('ROOM_NOT_READY'));
                  }
                };

                const onOpen = () => {
                  clearTimeout(timeout);
                  if (client) {
                    client.removeEventListener('close', onClose);
                    client.removeEventListener('error', onError);
                    client.removeEventListener('open', onOpen);
                  }
                  resolve();
                };

                if (client) {
                  if (client.readyState === WebSocket.OPEN) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                  }

                  client.addEventListener('close', onClose, { once: true });
                  client.addEventListener('error', onError, { once: true });
                  client.addEventListener('open', onOpen, { once: true });
                }
              });

              // Success
              return;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage === 'ROOM_NOT_READY' && retryCount < maxRetries - 1) {
                retryCount++;
                const delay = baseDelay * Math.pow(2, retryCount - 1);
                console.log(`PartyKit room not ready, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
              }
              throw error;
            }
          }
        };

        await connectWithRetry();

        if (!client) {
          client = initializePartyKitClient(sessionCode);
        }

        const STATE_RECOVERY_RETRY_MAX = 3;
        let stateRecoveryRetryCount = 0;
        let stateRecoveryRetryTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const requestStateRecovery = () => {
          const currentClient = getPartyKitClient();
          if (currentClient && currentClient.readyState === WebSocket.OPEN && mounted) {
            currentClient.send(JSON.stringify({
              type: 'state:recover',
              data: {
                sessionId: sessionCode,
                timestamp: Date.now(),
              },
            }));
          }
        };

        const scheduleRecoveryRetry = (delayMs: number) => {
          if (stateRecoveryRetryCount >= STATE_RECOVERY_RETRY_MAX) {
            console.warn('[JoinPage] Max state recovery retries reached, stopping');
            return;
          }
          stateRecoveryRetryCount++;
          if (stateRecoveryRetryTimeoutId) clearTimeout(stateRecoveryRetryTimeoutId);
          stateRecoveryRetryTimeoutId = setTimeout(() => {
            stateRecoveryRetryTimeoutId = null;
            if (!mounted) return;
            requestStateRecovery();
          }, delayMs);
        };

        // Define state recovery handler and message listener first (must be attached
        // before sending state:recover so we don't miss the server's reply).
        const handleStateRecovered = (recoveredData: {
          sessionId: string;
          vibeContext: VibeType;
          status: string;
          participants: unknown[];
          cast?: Character[];
          script?: Script | null;
          vibeLockedAt?: number | null;
          isExpired?: boolean;
          expiresAt?: number;
        }) => {
          let recoveryRetryNeeded = false;

          if (recoveredData.sessionId === sessionCode && mounted) {
            // If the session is expired, clear stale state and show a vibe-aware message
            if (recoveredData.status === 'expired' || recoveredData.isExpired) {
              clearSessionState();
              setError(getErrorMessage('sessionExpired'));
              setLoading(false);
              return;
            }

            setVibe(recoveredData.vibeContext);

            // Always set session state from recovery data (source of truth)
            // This ensures actors see the correct state even if there's a race condition
            if (
              recoveredData.status === 'performing' ||
              recoveredData.status === 'casting' ||
              recoveredData.status === 'configuring' ||
              recoveredData.status === 'completed' ||
              recoveredData.status === 'expired' ||
              recoveredData.status === 'idle'
            ) {
              console.log('[JoinPage] Setting session state from recovery:', recoveredData.status);
              setSessionState(
                recoveredData.status as 'performing' | 'casting' | 'configuring' | 'completed' | 'expired' | 'idle'
              );
              // If still configuring, director may move to casting shortly. Retry state
              // recovery so we refetch and pick up casting (avoids stuck configuring).
              if (recoveredData.status === 'configuring') {
                recoveryRetryNeeded = true;
              }
            } else {
              console.warn('[JoinPage] Unknown session state from recovery:', recoveredData.status);
            }

            // Always update cast from PartyKit (source of truth)
            // Even if empty array, this overwrites any stale local storage data
            if (recoveredData.cast !== undefined) {
              const castWithoutImages = recoveredData.cast || [];
              
              // Images are now served via HTTP endpoint, not included in WebSocket messages
              // Update cast with HTTP image URLs
              // PartyKit now sends HTTP URLs instead of data URLs
              // Update cast with HTTP image URLs (convert any data URLs to HTTP URLs)
              const castWithImageUrls = castWithoutImages.map((char) => {
                const existingImageUrl = char.visualRepresentation?.imageUrl;
                const httpImageUrl = existingImageUrl && existingImageUrl.length > 0 && !existingImageUrl.startsWith('data:')
                  ? existingImageUrl
                  : getCharacterImageUrl(recoveredData.sessionId, char.id);
                const finalImageUrl = httpImageUrl.startsWith('data:')
                  ? getCharacterImageUrl(recoveredData.sessionId, char.id)
                  : httpImageUrl;
                return {
                  ...char,
                  visualRepresentation: {
                    ...char.visualRepresentation,
                    imageUrl: finalImageUrl,
                  },
                };
              });
              
              setCast(castWithImageUrls);

              if (recoveredData.status === 'casting' && castWithImageUrls.length === 0) {
                recoveryRetryNeeded = true;
              }
              
              setParticipant((currentParticipant) => {
                if (!currentParticipant) return currentParticipant;

                const assignedCharacter = recoveredData.cast?.find(
                  (char) => char.participantId === currentParticipant.id
                );
                if (assignedCharacter) {
                  // Only set assignment status if character is locked (confirmed assignment)
                  // For unlocked characters, assignment status should only be set via PartyKit events
                  // (assignment:approved, assignment:suggested, assignment:confirmed)
                  // This prevents showing confirmation UI when no assignment was actually made
                  if (assignedCharacter.isLocked) {
                    return {
                      ...currentParticipant,
                      characterAssignment: assignedCharacter,
                      assignmentStatus: 'locked',
                    };
                  }
                  // If character has participantId but is not locked, only set characterAssignment
                  // if assignmentStatus is already 'pending' or 'requested' (from a previous event)
                  // Otherwise, don't set assignment status - let PartyKit events handle it
                  if (currentParticipant.assignmentStatus === 'pending' || currentParticipant.assignmentStatus === 'requested') {
                    return {
                      ...currentParticipant,
                      characterAssignment: assignedCharacter,
                      // Keep existing assignmentStatus - don't override
                    };
                  }
                  // If assignmentStatus is 'none', clear characterAssignment to avoid showing confirmation UI
                  // The character might have participantId from stale data or a previous session
                  return {
                    ...currentParticipant,
                    characterAssignment: null,
                    assignmentStatus: 'none',
                  };
                }
                // If no assigned character found, clear assignment if it exists
                if (currentParticipant.characterAssignment) {
                  return {
                    ...currentParticipant,
                    characterAssignment: null,
                    assignmentStatus: 'none',
                  };
                }
                return currentParticipant;
              });
            } else {
              setCast([]);
              if (recoveredData.status === 'casting') {
                recoveryRetryNeeded = true;
              }
            }

            setScript(recoveredData.script ?? null);

            if ((recoveredData.status === 'casting' || recoveredData.status === 'performing') && !recoveredData.script) {
              recoveryRetryNeeded = true;
            }

            if (recoveryRetryNeeded) {
              const delay = recoveredData.status === 'configuring' ? 2000 : 1000;
              scheduleRecoveryRetry(delay);
            }

            // CRITICAL: If participant exists, send join message to PartyKit
            // This ensures director's desk knows the participant is connected
            if (participant && participant.sessionId === sessionCode && client) {
              console.log('[JoinPage] Participant exists, sending join message to PartyKit:', {
                participantId: participant.id,
                participantName: participant.name,
                sessionId: sessionCode,
              });
              try {
                joinSession(sessionCode, participant.id, {
                  role: 'actor',
                  name: participant.name,
                });
              } catch (error) {
                console.error('[JoinPage] Failed to send join message:', error);
              }
            }
          }
        };

        const onMessage = async (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type !== 'state:recovered') return;
            const data = message.data as { sessionId?: string; recovered?: boolean; isExpired?: boolean; vibeContext?: VibeType };
            if (data.sessionId !== sessionCode || !mounted) return;

            if (data.isExpired) {
              clearSessionState();
              setError(getErrorMessage('sessionExpired'));
              setLoading(false);
              return;
            }

            if (data.recovered) {
              let fetched;
              try {
                fetched = await fetchSessionState(sessionCode);
              } catch {
                if (mounted) setError(getErrorMessage('network'));
                setLoading(false);
                return;
              }
              if (!fetched || !mounted) {
                if (mounted) setError(getErrorMessage('sessionExpired'));
                setLoading(false);
                return;
              }
              handleStateRecovered(fetched);
              return;
            }

            handleStateRecovered(message.data);
          } catch {
            // ignore parse errors
          }
        };

        // Subscribe to live updates (session:state:updated, cast:updated, etc.) BEFORE
        // sending state:recover so we never miss e.g. director moving to casting.
        const unsubscribePerformance = onPerformanceStart((data) => {
          if (data.sessionId === sessionCode && mounted) {
            setSessionState('performing');
            router.push(`/stage/${sessionCode}`);
          }
        });

        const unsubscribeCharacterAssigned = onCharacterAssigned((data) => {
          if (data.sessionId === sessionCode && mounted) {
            let updatedCharacter: Character | null = null;

            setCast((currentCast) => {
              const updatedCast = currentCast.map((char) => {
                if (char.id === data.characterId) {
                  updatedCharacter = { ...char, participantId: data.participantId, isLocked: data.isLocked };
                  return updatedCharacter;
                }
                if (data.participantId && char.participantId === data.participantId && char.id !== data.characterId) {
                  return { ...char, participantId: null, isLocked: false };
                }
                return char;
              });
              return updatedCast;
            });

            if (updatedCharacter) {
              setParticipant((currentParticipant) => {
                if (!currentParticipant || data.participantId !== currentParticipant.id) {
                  return currentParticipant;
                }

                return {
                  ...currentParticipant,
                  characterAssignment: updatedCharacter,
                  assignmentStatus: data.isLocked ? 'locked' : 'pending',
                };
              });
            }
          }
        });

        const unsubscribeAssignmentApproved = onAssignmentApproved((data) => {
          if (data.sessionId === sessionCode && mounted && participant && data.participantId === participant.id) {
            const approvedCharacter = cast.find((c) => c.id === data.characterId);
            if (approvedCharacter) {
              setParticipant({
                ...participant,
                characterAssignment: approvedCharacter,
                assignmentStatus: 'pending',
                requestedCharacterId: null,
              });
            }
          }
        });

        const unsubscribeAssignmentSuggested = onAssignmentSuggested((data) => {
          if (data.sessionId === sessionCode && mounted && participant && data.participantId === participant.id) {
            const suggestedCharacter = cast.find((c) => c.id === data.suggestedCharacterId);
            if (suggestedCharacter) {
              setParticipant({
                ...participant,
                characterAssignment: suggestedCharacter,
                assignmentStatus: 'pending',
                requestedCharacterId: null,
              });
            }
          }
        });

        const unsubscribeAssignmentConfirmed = onAssignmentConfirmed((data) => {
          if (data.sessionId === sessionCode && mounted) {
            setCast((currentCast) =>
              currentCast.map((char) => (char.id === data.characterId ? { ...char, isLocked: true } : char))
            );

            if (participant && data.participantId === participant.id) {
              setParticipant({
                ...participant,
                assignmentStatus: 'locked',
              });
            }
          }
        });

        const unsubscribeScriptUpdate = onScriptUpdate((data) => {
          if (data.sessionId === sessionCode && mounted) {
            console.log('[JoinPage] Script update received via PartyKit:', {
              sessionId: data.sessionId,
              scriptTitle: data.script?.title || null,
              scriptScenes: data.script?.scenes?.length || 0,
            });
            setScript(data.script);
          }
        });

        const unsubscribeCastUpdate = onCastUpdate((data) => {
          if (data.sessionId === sessionCode && mounted) {
            const castWithoutImages = data.cast || [];
            
            // Images are now served via HTTP endpoint, not included in WebSocket messages
            // PartyKit now sends HTTP URLs instead of data URLs
            // Update cast with HTTP image URLs (convert any data URLs to HTTP URLs)
            const castWithImageUrls = castWithoutImages.map((char) => {
              // PartyKit now sends HTTP URLs in cast updates
              // If character has an image URL, use it (should be HTTP URL from PartyKit)
              // Otherwise, construct HTTP endpoint URL
              const existingImageUrl = char.visualRepresentation?.imageUrl;
              const httpImageUrl = existingImageUrl && existingImageUrl.length > 0 && !existingImageUrl.startsWith('data:')
                ? existingImageUrl
                : getCharacterImageUrl(data.sessionId, char.id);
              
              // Ensure we're using HTTP URLs, not data URLs
              // If somehow we get a data URL, convert it to HTTP URL
              const finalImageUrl = httpImageUrl.startsWith('data:')
                ? getCharacterImageUrl(data.sessionId, char.id)
                : httpImageUrl;
              
              return {
                ...char,
                visualRepresentation: {
                  ...char.visualRepresentation,
                  imageUrl: finalImageUrl,
                },
              };
            });
            
            const imageCount = castWithImageUrls.filter(
              (char) => char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0
            ).length;
            console.log('[JoinPage] Cast update received', {
              sessionId: data.sessionId,
              castLength: castWithImageUrls.length,
              charactersWithImages: imageCount,
              imageUrls: castWithImageUrls.map((char) => ({
                name: char.name,
                hasImage: Boolean(char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0),
                imageUrl: char.visualRepresentation?.imageUrl || null,
              })),
            });
            setCast(castWithImageUrls);
            setParticipant((currentParticipant) => {
              if (!currentParticipant) return currentParticipant;

              const assignedCharacter = data.cast.find((char) => char.participantId === currentParticipant.id);
              if (assignedCharacter) {
                // Only set assignment status if character is locked (confirmed assignment)
                // For unlocked characters, assignment status should only be set via PartyKit events
                // (assignment:approved, assignment:suggested, assignment:confirmed)
                // This prevents showing confirmation UI when no assignment was actually made
                if (assignedCharacter.isLocked) {
                  return {
                    ...currentParticipant,
                    characterAssignment: assignedCharacter,
                    assignmentStatus: 'locked',
                  };
                }
                // If character has participantId but is not locked, only update characterAssignment
                // if assignmentStatus is already 'pending' or 'requested' (from a previous event)
                // Otherwise, don't set assignment status - let PartyKit events handle it
                if (currentParticipant.assignmentStatus === 'pending' || currentParticipant.assignmentStatus === 'requested') {
                  return {
                    ...currentParticipant,
                    characterAssignment: assignedCharacter,
                    // Keep existing assignmentStatus - don't override
                  };
                }
                // If assignmentStatus is 'none', clear characterAssignment to avoid showing confirmation UI
                // The character might have participantId from stale data or a previous session
                if (
                  !currentParticipant.characterAssignment ||
                  currentParticipant.characterAssignment.id !== assignedCharacter.id
                ) {
                  return {
                    ...currentParticipant,
                    characterAssignment: null,
                    assignmentStatus: 'none',
                  };
                }
              } else {
                // If no assigned character found, clear assignment if it exists
                if (currentParticipant.characterAssignment) {
                  return {
                    ...currentParticipant,
                    characterAssignment: null,
                    assignmentStatus: 'none',
                  };
                }
              }
              return currentParticipant;
            });
          }
        });

        const unsubscribeSessionStateUpdate = onSessionStateUpdate((data) => {
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
            console.log('Reconnection detected, requesting state recovery');
            setTimeout(() => {
              requestStateRecovery();
            }, 100);
          }
        });

        client.addEventListener('message', onMessage);

        // Request state recovery only after listener + live-update subs are attached.
        client.send(JSON.stringify({
          type: 'state:recover',
          data: {
            sessionId: sessionCode,
            timestamp: Date.now(),
          },
        }));

        socketCleanup = () => {
          if (stateRecoveryRetryTimeoutId) {
            clearTimeout(stateRecoveryRetryTimeoutId);
            stateRecoveryRetryTimeoutId = null;
          }
          if (client) {
            client.removeEventListener('message', onMessage);
          }
          unsubscribePerformance();
          unsubscribeCharacterAssigned();
          unsubscribeAssignmentApproved();
          unsubscribeAssignmentSuggested();
          unsubscribeAssignmentConfirmed();
          unsubscribeScriptUpdate();
          unsubscribeCastUpdate();
          unsubscribeSessionStateUpdate();
          unsubscribeReconnect();
        };

        if (mounted) {
          setLoading(false);
        }
      } catch (partyKitError) {
        console.warn('Failed to connect via PartyKit, falling back to REST API:', partyKitError);

        try {
          const response = await fetch(`/api/sessions/${sessionCode}`, {
            method: 'POST',
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (mounted) {
              const message =
                errorData.error === 'Session expired'
                  ? getErrorMessage('sessionExpired')
                  : errorData.error || getErrorMessage('sessionLoadFailed');

              if (errorData.error === 'Session expired') {
                clearSessionState();
              }

              setError(message);
              setLoading(false);
            }
            return;
          }

          const data = await response.json();
          const initialVibe = data.session.vibeContext as VibeType;

          if (mounted) {
            setVibe(initialVibe);
            setSessionCode(sessionCode);
            setLoading(false);
          }
        } catch (err) {
          if (mounted) {
            const isNetworkError =
              err instanceof TypeError ||
              (err instanceof Error && /network|fetch/i.test(err.message));

            setError(
              isNetworkError
                ? getErrorMessage('network')
                : err instanceof Error
                  ? err.message
                  : getErrorMessage('sessionLoadFailed'),
            );
            setLoading(false);
          }
        }
      }
    }

    if (sessionCode) {
      // Always record session code locally when entering join flow
      setSessionCode(sessionCode);
      loadSession();
    }

    return () => {
      mounted = false;
      if (socketCleanup) {
        socketCleanup();
      }
    };
  }, [sessionCode, setVibe, setSessionCode, setSessionState, setCast, setParticipant, setScript]);

  // Track whether this actor appears to have joined after the performance was already
  // in progress. If we first observe the session in a 'performing' state, treat this
  // as a mid-performance join and keep them on the waiting/preview screen instead of
  // dropping them directly into the teleprompter (T189).
  useEffect(() => {
    if (!participant) {
      return;
    }

    if (sessionState === 'performing' && !joinedDuringPerformance) {
      setJoinedDuringPerformance(true);
    }
  }, [participant, sessionState, joinedDuringPerformance]);

  // Debug: Log state changes to help diagnose why preview isn't showing
  useEffect(() => {
    if (participant) {
      console.log('[JoinPage] State change detected:', {
        participantId: participant.id,
        participantName: participant.name,
        sessionState,
        castLength: cast.length,
        hasScript: Boolean(script),
        isCastingState: sessionState === 'casting',
        shouldShowPreview: sessionState === 'casting' || (script && cast.length > 0) || (participant.characterAssignment && cast.length > 0),
      });
    }
  }, [participant, sessionState, cast, script]);

  // Redirect to stage if session is performing and script exists and the actor was
  // already present before the performance started. Mid-performance joins instead
  // see the waiting/preview UI until the Director decides how to bring them in (T189).
  useEffect(() => {
    if (participant && sessionState === 'performing' && script && !joinedDuringPerformance) {
      router.push(`/stage/${sessionCode}`);
    }
  }, [participant, sessionState, script, sessionCode, router, joinedDuringPerformance]);

  // Sync character assignment from cast if it exists but participant doesn't have it
  // This must be outside conditional blocks to follow Rules of Hooks
  const assignedCharacterFromCast = participant ? cast.find((char) => char.participantId === participant.id) : null;
  const assignedCharacterFromParticipant = participant?.characterAssignment ?? null;
  
  useEffect(() => {
    if (participant && assignedCharacterFromCast && !assignedCharacterFromParticipant) {
      // Only sync if character is locked (confirmed assignment)
      // For unlocked characters, assignment status should only be set via PartyKit events
      // This prevents showing confirmation UI when no assignment was actually made
      if (assignedCharacterFromCast.isLocked) {
        console.log('Syncing locked character assignment from cast:', assignedCharacterFromCast);
        setParticipant({
          ...participant,
          characterAssignment: assignedCharacterFromCast,
          assignmentStatus: 'locked',
        });
      }
      // If character is not locked, don't automatically set assignment status
      // Let PartyKit events (assignment:approved, assignment:suggested) handle it
    }
  }, [participant?.id, assignedCharacterFromCast?.id, assignedCharacterFromParticipant?.id, setParticipant]);

    // If participant already joined, show preview interface or locked character
    // CRITICAL: Check if participant belongs to this session to avoid showing wrong participant
  if (participant && participant.sessionId === sessionCode) {
    // If session is performing and script exists, show loading while redirecting
    if (sessionState === 'performing' && script) {
      return (
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
        >
          <VibePanel className="w-full max-w-md text-center">
            <VibeHeading level={2} sectionKey="redirectingToStage" className="mb-2 text-2xl font-semibold" />
          </VibePanel>
        </div>
      );
    }

    // If character is locked, show simple view
    if (participant.characterAssignment && participant.assignmentStatus === 'locked') {
      return (
        <div
          className="min-h-screen px-4 py-6"
          style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
        >
          <div className="max-w-3xl mx-auto">
            <div
              style={{
                marginBottom: '2rem',
              }}
            >
              <BackButton to="/" />
            </div>
            <VibePanel>
              <div className="flex items-center justify-between mb-4 gap-4">
                <VibeHeading level={1} sectionKey="actorWelcomeTitle" className="text-2xl font-bold">
                  Welcome, {participant.name}!
                </VibeHeading>
                <ConnectionStatusBadge />
              </div>
              <p className="mb-4">
                {getSectionTitle('lockedAssignmentIntro')}
              </p>
              <CharacterCard character={participant.characterAssignment} />
              <p className="mt-4 text-sm">
                {getSectionTitle('waitingForPerformance')}
              </p>
            </VibePanel>
          </div>
        </div>
      );
    }

    // Check if participant has a character assignment (from participant object or from cast)
    const hasCharacterAssignment = assignedCharacterFromParticipant !== null || assignedCharacterFromCast !== undefined;
    
    // Show preview interface when:
    // 1. Script AND cast are ready (complete generation) - preferred
    // 2. OR session is in 'casting' state (session is ready for casting - cast may still be loading but state indicates ready)
    // 3. OR participant has a character assignment AND cast exists (they can see their character)
    // 
    // NOTE: When session is in 'casting' state, PartyKit has confirmed generation is complete.
    // We show preview even if cast is empty because it might still be loading from state recovery.
    const hasScriptAndCast = script && cast.length > 0;
    const isCastingState = sessionState === 'casting';
    // More aggressive: if in casting state, show preview (cast will load via state recovery)
    // Don't show preview during configuration/generation - wait for casting state
    const isConfiguringState = sessionState === 'configuring';
    const shouldShowPreview = !isConfiguringState && (hasScriptAndCast || isCastingState || (hasCharacterAssignment && cast.length > 0));
    
    console.log('[JoinPage] Render check for casting interface:', {
      hasScriptAndCast,
      isCastingState,
      hasCharacterAssignment,
      castLength: cast.length,
      sessionState,
      hasScript: Boolean(script),
      assignedCharacterFromParticipant: assignedCharacterFromParticipant?.id,
      assignedCharacterFromCast: assignedCharacterFromCast?.id,
      shouldShowPreview,
      participantId: participant?.id,
      participantName: participant?.name,
    });
    
    if (shouldShowPreview) {
      return (
        <div
          className="min-h-screen px-4 py-6"
          style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
        >
          <div className="max-w-3xl mx-auto">
            <div
              style={{
                marginBottom: '2rem',
              }}
            >
              <BackButton to="/" />
            </div>
            <VibePanel>
              <div className="flex items-center justify-between mb-4 gap-4">
                <VibeHeading level={1} sectionKey="actorWelcomeTitle" className="text-2xl font-bold">
                  Welcome, {participant.name}!
                </VibeHeading>
                <ConnectionStatusBadge />
              </div>
              <ActorPreview />
            </VibePanel>
          </div>
        </div>
      );
    }

    // If joined but script/characters not ready yet
    return (
      <div
        className="min-h-screen px-4 py-6"
        style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            style={{
              marginBottom: '2rem',
            }}
          >
            <BackButton to="/" />
          </div>
          <VibePanel>
            <div className="flex items-center justify-between mb-4 gap-4">
              <VibeHeading level={1} sectionKey="actorWelcomeTitle" className="text-2xl font-bold">
                Welcome, {participant.name}!
              </VibeHeading>
              <ConnectionStatusBadge />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="animate-spin rounded-full h-6 w-6 border-b-2 shrink-0" 
                style={{ 
                  borderColor: visualTokens.primaryColor,
                }}
                aria-hidden="true"
              />
              <p className="mb-0">
                {getSectionTitle('waitingForGeneration')}
              </p>
            </div>
            {generationProgress && (
              <p className="text-sm opacity-90" role="status" aria-live="polite">
                Right now: {generationProgress.message}
              </p>
            )}
          </VibePanel>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
      >
        <div className="w-full max-w-md space-y-4">
          <BackButton to="/" className="mb-2" />
          <VibePanel>
            <div className="animate-pulse space-y-4" aria-hidden="true">
              <div className="h-6 w-2/3 rounded bg-gray-700/60" />
              <div className="space-y-3">
                <div className="h-4 w-1/3 rounded bg-gray-700/40" />
                <div className="h-10 w-full rounded bg-gray-700/40" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-1/3 rounded bg-gray-700/40" />
                <div className="h-10 w-full rounded bg-gray-700/40" />
              </div>
              <div className="h-10 w-full rounded bg-gray-700/60" />
            </div>
          </VibePanel>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
      >
        <div className="w-full max-w-md">
          <BackButton to="/" className="mb-6" />
          <VibePanel>
            <ErrorMessage message={error || getErrorMessage('sessionLoadFailed')} />
          </VibePanel>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/" />
        </div>
        <VibePanel>
          <VibeHeading level={1} sectionKey="joinSessionTitle" className="mb-4 text-2xl font-bold" />
          <SessionJoinForm initialSessionCode={sessionCode} />
        </VibePanel>
      </div>
    </div>
  );
}
