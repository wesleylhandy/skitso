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
  onAssignmentRejected,
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
  fetchEvents,
  replayEvents,
  getLastEventTimestamp,
  setLastEventTimestamp,
  type EventLogEntry,
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
        let httpPollingInterval: ReturnType<typeof setInterval> | null = null;

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
            console.warn('[JoinPage] Max WebSocket state recovery retries reached, switching to HTTP polling');
            // Switch to HTTP polling as fallback when WebSocket retries are exhausted
            if (httpPollingInterval) {
              clearInterval(httpPollingInterval);
            }
            httpPollingInterval = setInterval(async () => {
              if (!mounted) {
                if (httpPollingInterval) {
                  clearInterval(httpPollingInterval);
                  httpPollingInterval = null;
                }
                return;
              }
              try {
                const fetched = await fetchSessionState(sessionCode);
                if (fetched && mounted) {
                  // Only update if we got meaningful state (not still configuring without data)
                  if (fetched.status !== 'configuring' || (fetched.cast && fetched.cast.length > 0) || fetched.script) {
                    console.log('[JoinPage] HTTP state recovery succeeded, updating state');
                    handleStateRecovered(fetched);
                    // If we got complete state, stop polling
                    if (fetched.status === 'casting' || fetched.status === 'performing') {
                      if (httpPollingInterval) {
                        clearInterval(httpPollingInterval);
                        httpPollingInterval = null;
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('[JoinPage] HTTP state recovery failed:', error);
                // Continue polling on error
              }
            }, 3000); // Poll every 3 seconds
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
        const handleStateRecovered = async (recoveredData: {
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
                
                // CRITICAL: Only show assignments from state recovery if they are LOCKED
                // Unlocked assignments should NEVER be inferred from state recovery
                // They must come from explicit PartyKit events (assignment:approved, assignment:suggested, etc.)
                if (assignedCharacter && assignedCharacter.isLocked) {
                  // Only locked assignments are valid from state recovery
                  return {
                    ...currentParticipant,
                    characterAssignment: assignedCharacter,
                    assignmentStatus: 'locked',
                  };
                }
                
                // If character has participantId but is NOT locked, do NOT set assignment
                // This prevents showing assignment UI when no actual assignment was made
                // The participantId might be from stale data or a previous session
                // Only PartyKit events (assignment:approved, assignment:suggested) should set pending assignments
                
                // Clear any existing assignment if character is not locked
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

                // After joining, check if actor has an assignment in cast that they should see
                // This handles cases where director assigned a character but actor reconnected
                const assignedCharacterInCast = recoveredData.cast?.find(
                  (char) => char.participantId === participant.id
                );
                
                if (assignedCharacterInCast && !participant.characterAssignment) {
                  // Actor has an assignment in cast but participant object doesn't have it
                  // Set it based on lock status
                  if (assignedCharacterInCast.isLocked) {
                    setParticipant({
                      ...participant,
                      characterAssignment: assignedCharacterInCast,
                      assignmentStatus: 'locked',
                    });
                  } else {
                    // Pending assignment - director assigned but actor hasn't confirmed
                    setParticipant({
                      ...participant,
                      characterAssignment: assignedCharacterInCast,
                      assignmentStatus: 'pending',
                    });
                  }
                }

                // After joining, replay missed events if reconnecting
                const lastTimestamp = getLastEventTimestamp(sessionCode);
                if (lastTimestamp > 0) {
                  try {
                    const events = await fetchEvents(sessionCode, lastTimestamp);
                    if (events.length > 0 && mounted) {
                      console.log('[JoinPage] Replaying missed events:', events.length);
                      
                      // Replay events with idempotency checks
                      const currentState = {
                        participants: [],
                        cast,
                        assignmentRequests: new Map(),
                      };

                      await replayEvents(events, currentState, (event: EventLogEntry) => {
                        // Handle each event type for actors
                        if (event.type === 'cast:updated' && event.data) {
                          const eventData = event.data as { cast?: Character[] };
                          if (eventData.cast) {
                            const castWithImageUrls = eventData.cast.map((char) => {
                              const existingImageUrl = char.visualRepresentation?.imageUrl;
                              const httpImageUrl = existingImageUrl && existingImageUrl.length > 0 && !existingImageUrl.startsWith('data:')
                                ? existingImageUrl
                                : getCharacterImageUrl(sessionCode, char.id);
                              const finalImageUrl = httpImageUrl.startsWith('data:')
                                ? getCharacterImageUrl(sessionCode, char.id)
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
                            
                            // Check if actor's assignment changed
                            const currentParticipant = participant;
                            if (currentParticipant) {
                              const newAssignedCharacter = castWithImageUrls.find(
                                (char) => char.participantId === currentParticipant.id
                              );
                              if (newAssignedCharacter) {
                                if (newAssignedCharacter.isLocked) {
                                  setParticipant({
                                    ...currentParticipant,
                                    characterAssignment: newAssignedCharacter,
                                    assignmentStatus: 'locked',
                                  });
                                } else if (!currentParticipant.characterAssignment) {
                                  // New pending assignment
                                  setParticipant({
                                    ...currentParticipant,
                                    characterAssignment: newAssignedCharacter,
                                    assignmentStatus: 'pending',
                                  });
                                }
                              }
                            }
                          }
                        } else if (event.type === 'assignment:approved' && event.data && participant && event.participantId === participant.id) {
                          const eventData = event.data as { characterId: string };
                          const approvedCharacter = cast.find((c) => c.id === eventData.characterId);
                          if (approvedCharacter) {
                            setParticipant({
                              ...participant,
                              characterAssignment: approvedCharacter,
                              assignmentStatus: 'pending',
                              requestedCharacterId: null,
                            });
                          }
                        } else if (event.type === 'assignment:rejected' && event.data && participant && event.participantId === participant.id) {
                          const eventData = event.data as { characterId: string };
                          setParticipant({
                            ...participant,
                            characterAssignment: null,
                            assignmentStatus: 'rejected',
                            requestedCharacterId: null,
                            rejectedCharacterId: eventData.characterId,
                          });
                        } else if (event.type === 'assignment:confirmed' && event.data && participant && event.participantId === participant.id) {
                          setCast((currentCast) =>
                            currentCast.map((char) => (char.id === event.characterId ? { ...char, isLocked: true } : char))
                          );
                          setParticipant({
                            ...participant,
                            assignmentStatus: 'locked',
                          });
                        } else if (event.type === 'character:assigned' && event.data && participant && event.participantId === participant.id) {
                          // Director directly assigned a character
                          const eventData = event.data as { characterId: string; isLocked?: boolean };
                          const assignedCharacter = cast.find((c) => c.id === eventData.characterId);
                          if (assignedCharacter) {
                            setParticipant({
                              ...participant,
                              characterAssignment: assignedCharacter,
                              assignmentStatus: eventData.isLocked ? 'locked' : 'pending',
                            });
                          }
                        }
                        // Update last timestamp
                        setLastEventTimestamp(sessionCode, event.timestamp);
                      });
                    }
                  } catch (error) {
                    console.error('[JoinPage] Failed to replay events:', error);
                  }
                }
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
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
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

        const unsubscribeAssignmentRejected = onAssignmentRejected((data) => {
          if (data.sessionId === sessionCode && mounted && participant && data.participantId === participant.id) {
            // Clear assignment and set status to rejected
            setParticipant({
              ...participant,
              characterAssignment: null,
              assignmentStatus: 'rejected',
              requestedCharacterId: null,
              rejectedCharacterId: data.characterId,
            });
            
            // Update cast to remove assignment
            setCast((currentCast) => {
              return currentCast.map((char) => {
                if (char.id === data.characterId && char.participantId === participant.id) {
                  return { ...char, participantId: null, isLocked: false };
                }
                return char;
              });
            });
            
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
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
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
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
            
            // CRITICAL: Update participant assignment if cast shows an assignment for this actor
            // This ensures actors see their assignments even if they missed the assignment event
            if (participant) {
              const assignedCharacter = castWithImageUrls.find(
                (char) => char.participantId === participant.id
              );
              
              if (assignedCharacter) {
                // Actor has an assignment in cast
                if (assignedCharacter.isLocked) {
                  // Locked assignment - always update
                  setParticipant({
                    ...participant,
                    characterAssignment: assignedCharacter,
                    assignmentStatus: 'locked',
                  });
                } else if (!participant.characterAssignment || participant.characterAssignment.id !== assignedCharacter.id) {
                  // Pending assignment (director assigned, waiting for actor confirmation)
                  // Only update if participant doesn't already have this assignment
                  // to avoid overwriting 'requested' status
                  if (participant.assignmentStatus !== 'requested') {
                    setParticipant({
                      ...participant,
                      characterAssignment: assignedCharacter,
                      assignmentStatus: 'pending',
                    });
                  }
                }
              } else if (participant.characterAssignment) {
                // Character was unassigned - clear assignment
                setParticipant({
                  ...participant,
                  characterAssignment: null,
                  assignmentStatus: 'none',
                });
              }
            }
            
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
            setParticipant((currentParticipant) => {
              if (!currentParticipant) return currentParticipant;

              const assignedCharacter = data.cast.find((char) => char.participantId === currentParticipant.id);
              
              // CRITICAL: Only show assignments from cast updates if they are LOCKED
              // Unlocked assignments should NEVER be inferred from cast updates
              // They must come from explicit PartyKit events (assignment:approved, assignment:suggested, etc.)
              if (assignedCharacter && assignedCharacter.isLocked) {
                // Only locked assignments are valid from cast updates
                return {
                  ...currentParticipant,
                  characterAssignment: assignedCharacter,
                  assignmentStatus: 'locked',
                };
              }
              
              // If character has participantId but is NOT locked, do NOT set assignment
              // This prevents showing assignment UI when no actual assignment was made
              // Only PartyKit events (assignment:approved, assignment:suggested) should set pending assignments
              
              // Clear any existing assignment if character is not locked or not found
              if (currentParticipant.characterAssignment) {
                return {
                  ...currentParticipant,
                  characterAssignment: null,
                  assignmentStatus: 'none',
                };
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
            // Check if it's an interval (HTTP polling) or timeout (WebSocket retry)
            if (typeof stateRecoveryRetryTimeoutId === 'number') {
              clearInterval(stateRecoveryRetryTimeoutId);
            } else {
              clearTimeout(stateRecoveryRetryTimeoutId);
            }
            stateRecoveryRetryTimeoutId = null;
          }
          if (client) {
            client.removeEventListener('message', onMessage);
          }
          unsubscribePerformance();
          unsubscribeCharacterAssigned();
          unsubscribeAssignmentApproved();
          unsubscribeAssignmentRejected();
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
      // Use replace instead of push to avoid adding to history
      // Add a small delay to ensure state is stable before redirecting
      const redirectTimer = setTimeout(() => {
        router.replace(`/stage/${sessionCode}`);
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [participant, sessionState, script, sessionCode, router, joinedDuringPerformance]);

  // Redirect to wrap party when session is completed (e.g. rejoin from wrap party "Rejoin to vote").
  useEffect(() => {
    if (participant && participant.sessionId === sessionCode && sessionState === 'completed') {
      const redirectTimer = setTimeout(() => {
        router.replace(`/wrap-party/${sessionCode}`);
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [participant, sessionState, sessionCode, router]);

  // CRITICAL: Do NOT sync character assignments from cast automatically
  // Assignments should ONLY come from explicit PartyKit events:
  // - assignment:approved (sets pending status)
  // - assignment:suggested (sets pending status)
  // - assignment:confirmed (sets locked status)
  // 
  // State recovery and cast updates should ONLY show locked assignments
  // Unlocked assignments with participantId should be ignored until an explicit event arrives

  // Check if participant has a character assignment (from participant object or from cast)
  // Only consider locked assignments from cast - unlocked ones are ignored
  // This must be outside conditional blocks to follow Rules of Hooks
  const assignedCharacterFromParticipant = participant?.characterAssignment ?? null;
  const assignedCharacterFromCast = participant 
    ? cast.find((char) => char.participantId === participant.id && char.isLocked) ?? null
    : null;

  // If participant already joined, show preview interface or locked character
  // CRITICAL: Check if participant belongs to this session to avoid showing wrong participant
  if (participant && participant.sessionId === sessionCode) {
    // If session is completed, redirect to wrap party (e.g. rejoin from "Rejoin to vote" link).
    if (sessionState === 'completed') {
      return (
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ backgroundColor: visualTokens.bgColor, color: visualTokens.textColor }}
        >
          <VibePanel className="w-full max-w-md text-center">
            <VibeHeading level={2} sectionKey="redirectingToWrapParty" className="mb-2 text-2xl font-semibold" />
          </VibePanel>
        </div>
      );
    }

    // If session is performing and script exists, redirect to stage immediately
    // Only show redirecting message for actors (not directors) who are being redirected
    // Directors should never see this message - they navigate directly to stage
    if (sessionState === 'performing' && script && !joinedDuringPerformance && participant.role !== 'director') {
      // The redirect useEffect will handle the navigation
      // Show a brief loading state while redirect happens
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
    // Only locked assignments are considered
    const hasCharacterAssignment = assignedCharacterFromParticipant !== null || assignedCharacterFromCast !== null;
    
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
