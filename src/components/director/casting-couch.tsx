/**
 * Casting Couch Component
 * 
 * Director's view of the session lobby showing all participants,
 * character assignments, and connection status. Allows Director to
 * override character assignments and start the performance.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { ConnectionStatus } from '@/src/components/ui/connection-status';
import { CharacterCard } from '@/src/components/actor/character-card';
import { ScriptPreviewModal } from './script-preview-modal';
import { CharacterDossierModal } from './character-dossier-modal';
import { CharacterAssignmentModal } from './character-assignment-modal';
import { ConfirmationModal } from '@/src/components/ui/confirmation-modal';
import {
  initializePartyKitClient,
  getPartyKitClient,
  isPartyKitConnected,
  getConnectionStatus,
  joinSession,
  onVibeContextChange,
  onScriptUpdate,
  onPerformanceStart,
  onSessionJoined,
  onParticipantJoined,
  onParticipantLeft,
  onCharacterOverridden,
  onCharacterAssigned,
  onCastUpdate,
  startPerformance,
  leaveSession,
  rejectAssignment,
  fetchEvents,
  replayEvents,
  getLastEventTimestamp,
  setLastEventTimestamp,
  onConnectionStatus,
  type EventLogEntry,
} from '@/src/lib/partykit/client';
import type { Participant, Character, ConnectionStatus as ConnectionStatusType, AssignmentRequest } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';

interface PartyKitParticipant {
  participantId: string;
  connectionId: string;
  role: 'director' | 'actor';
  connectionStatus: ConnectionStatusType;
  joinedAt: number;
  lastSeen: number;
  name: string;
  assignmentStatus?: 'none' | 'requested' | 'pending' | 'locked';
  requestedCharacterId?: string | null;
  characterAssignment?: Character | null;
}

interface CastingCouchProps {
  onStartPerformance?: () => void;
  onCharacterDossierClick?: (character: Character) => void;
}

/**
 * CastingCouch Component
 * 
 * Displays the session lobby with participants, character assignments,
 * and Director controls.
 */
export function CastingCouch({ onStartPerformance }: CastingCouchProps) {
  const [showStartConfirmation, setShowStartConfirmation] = useState(false);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const participant = useAtomValue(participantAtom);
  const cast = useAtomValue(castAtom);
  const setCast = useSetAtom(castAtom);
  const script = useAtomValue(currentScriptAtom);
  const [vibe, setVibe] = useAtom(vibeAtom);
  const [, setSessionState] = useAtom(sessionStateAtom);
  const { getSectionTitle, getButtonLabel, visualTokens } = useVibe();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');
  const [participants, setParticipants] = useState<PartyKitParticipant[]>([]);
  const participantsRef = useRef<PartyKitParticipant[]>([]);
  const [partyKitInitialized, setPartyKitInitialized] = useState(false);
  const [isScriptPreviewOpen, setIsScriptPreviewOpen] = useState(false);
  const [selectedCharacterForDossier, setSelectedCharacterForDossier] = useState<Character | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentModalTarget, setAssignmentModalTarget] = useState<{ participantId?: string; characterId?: string } | null>(null);
  const [assignmentRequests, setAssignmentRequests] = useState<Map<string, AssignmentRequest>>(new Map());

  const isDirector = participant?.role === 'director';

  // Initialize PartyKit client
  useEffect(() => {
    if (!sessionCode || !participant) {
      return;
    }

    let mounted = true;

    try {
      const client = initializePartyKitClient(sessionCode);
      
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        if (mounted) {
          setPartyKitInitialized(true);
        }
      }, 0);

      // Update connection status
      const updateConnectionStatus = () => {
        const status = getConnectionStatus();
        // Handle all connection states properly
        if (status === 'connected') {
          setConnectionStatus('connected');
        } else if (status === 'reconnecting') {
          setConnectionStatus('reconnecting');
        } else {
          setConnectionStatus('disconnected');
        }
      };

      // Listen for connection status changes from PartyKit client
      const unsubscribeConnectionStatus = onConnectionStatus((status) => {
        if (mounted) {
          setConnectionStatus(status);
        }
      });

      // Listen for connection events via PartyKit message handlers
      const handleConnect = () => {
        updateConnectionStatus();
      };

      const handleDisconnect = () => {
        setConnectionStatus('disconnected');
      };

      // Join session with vibeContext and role
      joinSession(sessionCode, participant.id, {
        role: participant.role,
        vibeContext: vibe,
      });

      // Listen for session joined event
      const unsubscribeSessionJoined = onSessionJoined(async (data) => {
        if (data.sessionId === sessionCode && mounted) {
          // Map participants to ensure they have names
          const participantsWithNames = data.participants.map((p) => ({
            ...p,
            name: p.name || `Participant ${p.participantId.slice(-6)}`,
          }));
          setParticipants(participantsWithNames);
          participantsRef.current = participantsWithNames;
          // Sync VibeContext from server (omit vibe from effect deps to avoid setVibe→re-run→join loop)
          if (data.vibeContext != null) {
            setVibe(data.vibeContext);
          }

          // After session joined, replay missed events if reconnecting
          const lastTimestamp = getLastEventTimestamp(sessionCode);
          if (lastTimestamp > 0) {
            try {
              const events = await fetchEvents(sessionCode, lastTimestamp);
              if (events.length > 0 && mounted) {
                console.log('[CastingCouch] Replaying missed events:', events.length);
                
                // Replay events with idempotency checks
                const currentState = {
                  participants: participantsWithNames,
                  cast,
                  assignmentRequests,
                };

                await replayEvents(events, currentState, (event: EventLogEntry) => {
                  // Handle each event type
                  if (event.type === 'participant:joined' && event.data) {
                    const eventData = event.data as { participants?: unknown[] };
                    if (eventData.participants) {
                      const participantsWithNames: PartyKitParticipant[] = eventData.participants.map((p: unknown) => {
                        const participant = p as {
                          participantId: string;
                          connectionId: string;
                          role: 'director' | 'actor';
                          connectionStatus: ConnectionStatusType;
                          joinedAt: number;
                          lastSeen: number;
                          name?: string;
                        };
                        return {
                          participantId: participant.participantId,
                          connectionId: participant.connectionId,
                          role: participant.role,
                          connectionStatus: participant.connectionStatus,
                          joinedAt: participant.joinedAt,
                          lastSeen: participant.lastSeen,
                          name: participant.name || `Participant ${participant.participantId.slice(-6)}`,
                        };
                      });
                      setParticipants(participantsWithNames);
                    }
                  } else if (event.type === 'assignment:requested' && event.data) {
                    const eventData = event.data as { participantId: string; characterId: string };
                    setAssignmentRequests((prev) => {
                      const next = new Map(prev);
                      next.set(eventData.participantId, {
                        participantId: eventData.participantId,
                        characterId: eventData.characterId,
                        requestedAt: event.timestamp,
                      });
                      return next;
                    });
                  } else if (event.type === 'cast:updated' && event.data) {
                    const eventData = event.data as { cast?: Character[] };
                    if (eventData.cast) {
                      setCast(eventData.cast);
                    }
                  }
                  // Update last timestamp
                  setLastEventTimestamp(sessionCode, event.timestamp);
                });
              }
            } catch (error) {
              console.error('[CastingCouch] Failed to replay events:', error);
            }
          }
        }
      });

      // Listen for participant joined/left events
      const unsubscribeParticipantJoined = onParticipantJoined((data) => {
        if (mounted) {
          // Map participants to ensure they have names
          const participantsWithNames = data.participants.map((p) => ({
            ...p,
            name: p.name || `Participant ${p.participantId.slice(-6)}`,
          }));
          setParticipants(participantsWithNames);
        }
      });

      const unsubscribeParticipantLeft = onParticipantLeft((data) => {
        if (mounted) {
          // Map participants to ensure they have names
          const participantsWithNames: PartyKitParticipant[] = data.participants.map((p) => ({
            participantId: p.participantId,
            connectionId: p.connectionId,
            role: p.role,
            connectionStatus: p.connectionStatus,
            joinedAt: p.joinedAt,
            lastSeen: p.lastSeen,
            name: p.name || `Participant ${p.participantId.slice(-6)}`,
          }));
          setParticipants(participantsWithNames);
          participantsRef.current = participantsWithNames;
        }
      });

      // Listen for VibeContext changes
      const unsubscribeVibe = onVibeContextChange((data) => {
        if (data.sessionId === sessionCode && mounted) {
          setVibe(data.vibeContext);
        }
      });

      // Listen for script updates
      const unsubscribeScript = onScriptUpdate((data) => {
        if (data.sessionId === sessionCode) {
          // Script update handled by script atom
        }
      });

      // Listen for performance start
      const unsubscribePerformance = onPerformanceStart((data) => {
        if (data.sessionId === sessionCode && mounted) {
          // Update local state
          setSessionState('performing');
          // Call callback if provided
          onStartPerformance?.();
        }
      });

      // Listen for character override events
      const unsubscribeCharacterOverride = onCharacterOverridden((data) => {
        if (data.sessionId === sessionCode && mounted) {
          // Update cast atom when character is overridden
          setCast((currentCast) => {
            return currentCast.map((char) => {
              if (char.id === data.characterId) {
                return { ...char, participantId: data.participantId };
              }
              // If assigning to a participant, unassign any other character they had
              if (data.participantId && char.participantId === data.participantId) {
                return { ...char, participantId: null };
              }
              return char;
            });
          });
        }
      });

      // Listen for character assignment events (from assignment modal)
      const unsubscribeCharacterAssigned = onCharacterAssigned((data) => {
        console.log('Casting couch received character:assigned event:', data);
        if (data.sessionId === sessionCode && mounted) {
          console.log('Updating cast atom with character assignment');
          // Update cast atom when character is assigned
          setCast((currentCast) => {
            const updatedCast = currentCast.map((char) => {
              if (char.id === data.characterId) {
                return { ...char, participantId: data.participantId, isLocked: data.isLocked };
              }
              // Unassign from participant if they got a different character
              if (data.participantId && char.participantId === data.participantId && char.id !== data.characterId) {
                return { ...char, participantId: null, isLocked: false };
              }
              return char;
            });
            console.log('Updated cast:', updatedCast);
            return updatedCast;
          });
        } else {
          console.log('Ignoring character:assigned event - session mismatch or unmounted', {
            eventSessionId: data.sessionId,
            currentSessionCode: sessionCode,
            mounted,
          });
        }
      });

      // Listen for cast updates (full cast sync)
      const unsubscribeCastUpdate = onCastUpdate((data) => {
        console.log('[CastingCouch] Received cast:updated event:', {
          sessionId: data.sessionId,
          castLength: data.cast?.length || 0,
          charactersWithImages: data.cast?.filter((c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0).length || 0,
          currentSessionCode: sessionCode,
          mounted,
        });
        if (data.sessionId === sessionCode && mounted) {
          console.log('[CastingCouch] Updating cast atom with full cast sync:', {
            castLength: data.cast.length,
            charactersWithImages: data.cast.filter((c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0).length,
          });
          
          // CRITICAL: Clean up stale participantId assignments
          // Only keep participantId if the participant actually exists in the current session
          // This prevents showing assignments for participants who have left
          // Use ref to get latest participants (closure may have stale value)
          const currentParticipantIds = new Set(participantsRef.current.map((p) => p.participantId));
          const cleanedCast = data.cast.map((char) => {
            // If character has a participantId but that participant doesn't exist, clear it
            if (char.participantId && !currentParticipantIds.has(char.participantId)) {
              console.log('[CastingCouch] Clearing stale assignment:', {
                characterId: char.id,
                characterName: char.name,
                staleParticipantId: char.participantId,
              });
              return {
                ...char,
                participantId: null,
                isLocked: false, // Also clear lock status for stale assignments
              };
            }
            return char;
          });
          
          setCast(cleanedCast);
        } else {
          console.log('[CastingCouch] Ignoring cast:updated event - session mismatch or unmounted', {
            eventSessionId: data.sessionId,
            currentSessionCode: sessionCode,
            mounted,
          });
        }
      });

      // Listen for assignment requests
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'assignment:requested' && mounted) {
            const request: AssignmentRequest = message.data;
            setAssignmentRequests((prev) => {
              const next = new Map(prev);
              next.set(request.participantId, request);
              return next;
            });
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
          } else if (message.type === 'assignment:approved' && mounted) {
            const { participantId } = message.data;
            setAssignmentRequests((prev) => {
              const next = new Map(prev);
              next.delete(participantId);
              return next;
            });
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
          } else if (message.type === 'assignment:confirmed' && mounted) {
            const { participantId, characterId } = message.data;
            // Remove assignment request
            setAssignmentRequests((prev) => {
              const next = new Map(prev);
              next.delete(participantId);
              return next;
            });
            // Update cast to reflect locked status
            // The cast:updated event should also fire, but this ensures immediate UI update
            setCast((currentCast) => {
              return currentCast.map((char) => {
                if (char.id === characterId) {
                  return { ...char, isLocked: true, participantId };
                }
                return char;
              });
            });
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
          } else if (message.type === 'participant:joined' && mounted) {
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
          } else if (message.type === 'cast:updated' && mounted) {
            // Update last event timestamp
            setLastEventTimestamp(sessionCode, Date.now());
          }
        } catch (error) {
          // Ignore parse errors
        }
      };

      // Add message listener to the already initialized client
      if (client) {
        client.addEventListener('message', handleMessage);
      }

      // Set up connection status polling (PartyKit doesn't have direct event listeners)
      const statusInterval = setInterval(() => {
        updateConnectionStatus();
      }, 1000);

      // Cleanup
      return () => {
        mounted = false;
        clearInterval(statusInterval);
        unsubscribeSessionJoined();
        unsubscribeParticipantJoined();
        unsubscribeParticipantLeft();
        unsubscribeVibe();
        unsubscribeScript();
        unsubscribePerformance();
        unsubscribeCharacterOverride();
        unsubscribeCharacterAssigned();
        unsubscribeCastUpdate();
        unsubscribeConnectionStatus();
        const client = getPartyKitClient();
        if (client) {
          client.removeEventListener('message', handleMessage);
        }
        if (sessionCode) {
          leaveSession(sessionCode);
        }
      };
    } catch (error) {
      console.error('Failed to initialize PartyKit client:', error);
      setTimeout(() => {
        if (mounted) {
          setConnectionStatus('disconnected');
        }
      }, 0);
    }
  }, [sessionCode, participant, setVibe, setCast]);

  // Clean up stale character assignments when participants change
  // This handles cases where localStorage has stale participantId values
  // from previous sessions or participants who have left
  useEffect(() => {
    if (participants.length === 0 || cast.length === 0) {
      return;
    }

    const currentParticipantIds = new Set(participants.map((p) => p.participantId));
    const hasStaleAssignments = cast.some(
      (char) => char.participantId && !currentParticipantIds.has(char.participantId)
    );

    if (hasStaleAssignments) {
      console.log('[CastingCouch] Cleaning up stale character assignments:', {
        participantIds: Array.from(currentParticipantIds),
        staleAssignments: cast
          .filter((char) => char.participantId && !currentParticipantIds.has(char.participantId))
          .map((char) => ({ characterId: char.id, characterName: char.name, staleParticipantId: char.participantId })),
      });

      setCast((currentCast) =>
        currentCast.map((char) => {
          // If character has a participantId but that participant doesn't exist, clear it
          if (char.participantId && !currentParticipantIds.has(char.participantId)) {
            return {
              ...char,
              participantId: null,
              isLocked: false, // Also clear lock status for stale assignments
            };
          }
          return char;
        })
      );
    }
  }, [participants, cast, setCast]);

  // Get character assignment for a participant
  // Only return assignments that are either:
  // 1. Locked (confirmed by actor)
  // 2. Pending (director assigned or approved, waiting for actor confirmation)
  // We do NOT show characters with participantId that weren't explicitly assigned
  // (to avoid showing stale data or auto-assignments that weren't requested)
  const getCharacterForParticipant = (participantId: string): Character | null => {
    // CRITICAL: Only show assignments if the participant actually exists in the current session
    // This prevents showing stale assignments from localStorage when participants have left
    const participantExists = participants.some((p) => p.participantId === participantId);
    if (!participantExists) {
      // Participant doesn't exist - this is stale data, don't show assignment
      return null;
    }

    const character = cast.find((char) => char.participantId === participantId);
    
    // Only show if:
    // - Character is locked (confirmed assignment)
    // - OR character has participantId but isn't locked (pending assignment from director)
    //   AND there's either an assignment request OR the character was explicitly assigned
    if (character) {
      if (character.isLocked) {
        // Locked assignment - always show
        return character;
      }
      
      // Pending assignment - only show if there's an explicit assignment event
      // Check if there's an assignment request or if this was assigned via director action
      // (We can't easily track "director assigned without request" vs stale data,
      // so we show pending assignments if participantId is set but not locked)
      // The director can see this and reassign if needed
      return character;
    }
    
    return null;
  };

  // Handle character override (Director only)
  const handleCharacterOverride = (characterId: string, newParticipantId: string | null) => {
    if (!isDirector || !sessionCode) {
      return;
    }

    const client = getPartyKitClient();
    if (!client || client.readyState !== WebSocket.OPEN) {
      return;
    }

    // Update cast atom locally first for immediate UI feedback
    const updatedCast = cast.map((char) => {
      if (char.id === characterId) {
        return { ...char, participantId: newParticipantId };
      }
      // If assigning to a participant, unassign any other character they had
      if (newParticipantId && char.participantId === newParticipantId) {
        return { ...char, participantId: null };
      }
      return char;
    });
    setCast(updatedCast);

    // Send character override event to PartyKit for synchronization
    client.send(JSON.stringify({
      type: 'character:override',
      data: {
        sessionId: sessionCode,
        characterId,
        participantId: newParticipantId,
      },
    }));
  };

  // Handle assign button click - opens assignment modal
  const handleAssignCharacter = (characterId?: string, participantId?: string) => {
    if (!isDirector) {
      return;
    }
    setAssignmentModalTarget({ characterId, participantId });
    setIsAssignmentModalOpen(true);
  };

  // Handle reassign button click
  const handleReassignCharacter = (participantId: string, characterId: string) => {
    if (!isDirector) {
      return;
    }
    const character = cast.find((c) => c.id === characterId);
    if (character?.isLocked) {
      console.warn('Cannot reassign locked character');
      return;
    }
    setAssignmentModalTarget({ participantId, characterId });
    setIsAssignmentModalOpen(true);
  };

  // Handle approve assignment request
  const handleApproveRequest = (participantId: string, characterId: string) => {
    if (!isDirector || !sessionCode) {
      return;
    }

    const client = getPartyKitClient();
    if (!client || client.readyState !== WebSocket.OPEN) {
      return;
    }

    client.send(JSON.stringify({
      type: 'assignment:approve',
      data: {
        sessionId: sessionCode,
        participantId,
        characterId,
      },
    }));
  };

  // Handle reject assignment request
  const handleRejectRequest = (participantId: string, characterId: string) => {
    if (!isDirector || !sessionCode) {
      return;
    }

    rejectAssignment(sessionCode, participantId, characterId);
  };

  // Handle suggest different character
  const handleSuggestCharacter = (participantId: string, suggestedCharacterId: string) => {
    if (!isDirector || !sessionCode) {
      return;
    }

    const client = getPartyKitClient();
    if (!client || client.readyState !== WebSocket.OPEN) {
      return;
    }

    client.send(JSON.stringify({
      type: 'assignment:suggest',
      data: {
        sessionId: sessionCode,
        participantId,
        suggestedCharacterId,
      },
    }));
  };

  // Handle start performance (Director only)
  const handleStartPerformance = () => {
    setShowStartConfirmation(true);
  };

  const confirmStartPerformance = () => {
    if (!isDirector || !sessionCode) {
      return;
    }

    if (!isPartyKitConnected()) {
      console.error('PartyKit not connected, cannot start performance');
      return;
    }

    // Require at least director (solo read-through allowed)
    if (participants.length < 1) {
      console.warn('At least 1 participant (director) required to start performance');
      return;
    }

    // Start performance via PartyKit
    startPerformance(sessionCode);
    onStartPerformance?.();
    setShowStartConfirmation(false);

    // Note: State update and navigation will happen via performance:started event
    // This ensures all participants are synchronized
  };

  if (!sessionCode || !participant) {
    return (
      <div className="p-4">
        <p>No active session. Please create or join a session.</p>
      </div>
    );
  }

  return (
    <div className="casting-couch p-6" data-theme={vibe}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{getSectionTitle('castingCouch')}</h1>
        <ConnectionStatus status={connectionStatus} />
      </div>

      {/* Participants List */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Participants ({participants.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.map((p) => {
            const character = getCharacterForParticipant(p.participantId);
            return (
              <div
                key={p.participantId}
                className="participant-card p-4 border rounded-lg"
                style={{
                  borderColor: visualTokens.primaryColor,
                  backgroundColor: visualTokens.bgColor,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {p.participantId === participant.id ? 'You' : (p.name || `Participant ${p.participantId.slice(-6)}`)}
                  </span>
                  <ConnectionStatus status={p.connectionStatus} />
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Role: {p.role}
                </div>
                {character ? (
                  <div className="mt-2">
                    <CharacterCard character={character} />
                    <div className="mt-2 flex gap-2 flex-wrap items-center">
                      {isDirector && (
                        <>
                          <button
                            onClick={() => setSelectedCharacterForDossier(character)}
                            className="text-sm underline transition-opacity hover:opacity-75 cursor-pointer"
                            style={{ 
                              color: visualTokens.primaryColor,
                              pointerEvents: 'auto',
                            }}
                          >
                            View Dossier
                          </button>
                          {!character.isLocked && (
                            <>
                              <button
                                onClick={() => handleReassignCharacter(p.participantId, character.id)}
                                className="text-sm transition-opacity hover:opacity-75"
                                style={{ 
                                  color: visualTokens.accentColor || visualTokens.primaryColor,
                                  cursor: 'pointer',
                                  pointerEvents: 'auto',
                                }}
                              >
                                Reassign
                              </button>
                              <span className="text-xs" style={{ color: visualTokens.textColor, opacity: 0.7 }}>
                                (Pending confirmation)
                              </span>
                            </>
                          )}
                          {character.isLocked && (
                            <span className="text-xs" style={{ color: visualTokens.textColor, opacity: 0.7 }}>
                              Locked
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">No character assigned</div>
                    {isDirector && (
                      <button
                        onClick={() => handleAssignCharacter(undefined, p.participantId)}
                        className="text-sm transition-opacity hover:opacity-75"
                        style={{ 
                          color: visualTokens.accentColor || visualTokens.primaryColor,
                          cursor: 'pointer',
                        }}
                      >
                        Assign Character
                      </button>
                    )}
                  </div>
                )}
                {/* Show assignment request if exists */}
                {assignmentRequests.has(p.participantId) && isDirector && (
                  <div className="mt-2 p-2 border rounded" style={{ borderColor: visualTokens.primaryColor }}>
                    <p className="text-xs mb-2" style={{ color: visualTokens.textColor }}>
                      Requested: {cast.find((c) => c.id === assignmentRequests.get(p.participantId)?.characterId)?.name || 'Unknown'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const request = assignmentRequests.get(p.participantId);
                          if (request) {
                            handleApproveRequest(p.participantId, request.characterId);
                          }
                        }}
                        className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-75"
                        style={{
                          backgroundColor: visualTokens.primaryColor,
                          color: visualTokens.bgColor,
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          minHeight: '44px',
                          minWidth: '44px',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const request = assignmentRequests.get(p.participantId);
                          if (request) {
                            handleRejectRequest(p.participantId, request.characterId);
                          }
                        }}
                        className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-75"
                        style={{
                          backgroundColor: 'transparent',
                          color: visualTokens.textColor,
                          borderColor: visualTokens.primaryColor,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          minHeight: '44px',
                          minWidth: '44px',
                        }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAssignCharacter(undefined, p.participantId)}
                        className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-75"
                        style={{
                          backgroundColor: 'transparent',
                          color: visualTokens.textColor,
                          borderColor: visualTokens.primaryColor,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          minHeight: '44px',
                          minWidth: '44px',
                        }}
                      >
                        Suggest Different
                      </button>
                    </div>
                  </div>
      )}

      {/* Start Performance Confirmation Modal */}
      <ConfirmationModal
        isOpen={showStartConfirmation}
        onClose={() => setShowStartConfirmation(false)}
        onConfirm={confirmStartPerformance}
        title={
          participants.length === 1
            ? getSectionTitle('readThroughConfirmTitle')
            : getButtonLabel('startPerformance')
        }
        message={
          participants.length === 1
            ? getSectionTitle('readThroughConfirmMessage')
            : 'Are you sure you want to start the performance? All participants will be notified and the teleprompter will begin.'
        }
        confirmLabel={getButtonLabel('startPerformance')}
        cancelLabel={getButtonLabel('cancel')}
      />
    </div>
  );
})}
        </div>
      </div>

      {/* Cast (Unassigned Characters) */}
      {isDirector && cast.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Cast</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cast.map((character) => (
              <div key={character.id} className="cast-card">
                <CharacterCard character={character} />
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedCharacterForDossier(character)}
                    className="text-sm underline transition-opacity hover:opacity-75 cursor-pointer"
                    style={{ 
                      color: visualTokens.primaryColor,
                      pointerEvents: 'auto',
                    }}
                  >
                    View Dossier
                  </button>
                  {!character.participantId && !character.isLocked && (
                    <button
                      onClick={() => handleAssignCharacter(character.id)}
                      className="text-sm transition-opacity hover:opacity-75"
                      style={{ 
                        color: visualTokens.accentColor || visualTokens.primaryColor,
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                      }}
                    >
                      Assign
                    </button>
                  )}
                  {character.isLocked && (
                    <span 
                      className="text-xs px-2 py-1 rounded"
                      style={{ 
                        color: visualTokens.bgColor,
                        backgroundColor: visualTokens.primaryColor,
                        opacity: 1,
                        fontWeight: 'semibold',
                      }}
                    >
                      Locked
                    </span>
                  )}
                  {character.participantId && !character.isLocked && (
                    <span 
                      className="text-xs px-2 py-1 rounded"
                      style={{ 
                        color: visualTokens.textColor,
                        backgroundColor: 'transparent',
                        borderColor: visualTokens.primaryColor,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        opacity: 0.8,
                      }}
                    >
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons (Director only) */}
      {isDirector && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-4 flex-wrap">
            {/* Preview Script Button */}
            {script && (
              <>
                <button
                  onClick={() => setIsScriptPreviewOpen(true)}
                  className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-75"
                  style={{
                    backgroundColor: visualTokens.accentColor || visualTokens.primaryColor,
                    color: visualTokens.bgColor,
                    opacity: 0.8,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    minHeight: '44px',
                    minWidth: '44px',
                  }}
                >
                  Preview Script
                </button>
              </>
            )}

            {/* Start Performance Button */}
            <button
              onClick={handleStartPerformance}
              disabled={!partyKitInitialized || connectionStatus !== 'connected' || participants.length < 1}
              className="px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-75"
              style={{
                backgroundColor: visualTokens.primaryColor,
                color: visualTokens.bgColor,
                cursor: (!partyKitInitialized || connectionStatus !== 'connected' || participants.length < 1) ? 'not-allowed' : 'pointer',
                pointerEvents: (!partyKitInitialized || connectionStatus !== 'connected' || participants.length < 1) ? 'none' : 'auto',
                minHeight: '44px',
                minWidth: '44px',
              }}
            >
              {getButtonLabel('startPerformance')}
            </button>
          </div>
          {participants.length === 1 && (
            <p className="text-sm text-muted-foreground">
              {getSectionTitle('readThroughSubtext')}
            </p>
          )}
        </div>
      )}

      {/* Script Preview Modal */}
      <ScriptPreviewModal
        isOpen={isScriptPreviewOpen}
        onClose={() => setIsScriptPreviewOpen(false)}
      />

      {/* Character Dossier Modal */}
      <CharacterDossierModal
        character={selectedCharacterForDossier}
        isOpen={selectedCharacterForDossier !== null}
        onClose={() => setSelectedCharacterForDossier(null)}
      />

      {/* Character Assignment Modal */}
      <CharacterAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          setAssignmentModalTarget(null);
        }}
        targetParticipantId={assignmentModalTarget?.participantId}
        targetCharacterId={assignmentModalTarget?.characterId}
        participants={participants.map((p) => ({
          participantId: p.participantId,
          name: p.name || `Participant ${p.participantId.slice(-6)}`,
          role: p.role,
        }))}
      />
    </div>
  );
}
