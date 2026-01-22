/**
 * Casting Couch Component
 * 
 * Director's view of the session lobby showing all participants,
 * character assignments, and connection status. Allows Director to
 * override character assignments and start the performance.
 */

'use client';

import { useEffect, useState } from 'react';
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
        setConnectionStatus(status === 'connected' ? 'connected' : 'disconnected');
      };

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
      const unsubscribeSessionJoined = onSessionJoined((data) => {
        if (data.sessionId === sessionCode && mounted) {
          // Map participants to ensure they have names
          const participantsWithNames = data.participants.map((p) => ({
            ...p,
            name: p.name || `Participant ${p.participantId.slice(-6)}`,
          }));
          setParticipants(participantsWithNames);
          // Sync VibeContext from server
          if (data.vibeContext !== vibe) {
            setVibe(data.vibeContext);
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
        console.log('Casting couch received cast:updated event:', data);
        if (data.sessionId === sessionCode && mounted) {
          console.log('Updating cast atom with full cast sync');
          setCast(data.cast);
        } else {
          console.log('Ignoring cast:updated event - session mismatch or unmounted', {
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
          } else if (message.type === 'assignment:approved' && mounted) {
            const { participantId } = message.data;
            setAssignmentRequests((prev) => {
              const next = new Map(prev);
              next.delete(participantId);
              return next;
            });
          } else if (message.type === 'assignment:confirmed' && mounted) {
            const { participantId } = message.data;
            setAssignmentRequests((prev) => {
              const next = new Map(prev);
              next.delete(participantId);
              return next;
            });
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
  }, [sessionCode, participant, vibe, setVibe, setCast]);

  // Get character assignment for a participant
  const getCharacterForParticipant = (participantId: string): Character | null => {
    return cast.find((char) => char.participantId === participantId) || null;
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

    // Verify minimum participants
    if (participants.length < 2) {
      console.warn('At least 2 participants required to start performance');
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
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {isDirector && (
                        <>
                          <button
                            onClick={() => setSelectedCharacterForDossier(character)}
                            className="text-sm underline transition-opacity hover:opacity-75 cursor-pointer"
                            style={{ color: visualTokens.primaryColor }}
                          >
                            View Dossier
                          </button>
                          {!character.isLocked && (
                            <button
                              onClick={() => handleReassignCharacter(p.participantId, character.id)}
                              className="text-sm transition-opacity hover:opacity-75"
                              style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}
                            >
                              Reassign
                            </button>
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
                        style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}
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
                        }}
                      >
                        Approve
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
        title="Start Performance"
        message="Are you sure you want to start the performance? All participants will be notified and the teleprompter will begin."
        confirmLabel="Start Performance"
        cancelLabel="Cancel"
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
                    style={{ color: visualTokens.primaryColor }}
                  >
                    View Dossier
                  </button>
                  {!character.participantId && !character.isLocked && (
                    <button
                      onClick={() => handleAssignCharacter(character.id)}
                      className="text-sm transition-opacity hover:opacity-75"
                      style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}
                    >
                      Assign
                    </button>
                  )}
                  {character.isLocked && (
                    <span className="text-xs" style={{ color: visualTokens.textColor, opacity: 0.7 }}>
                      Locked
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
              <button
                onClick={() => setIsScriptPreviewOpen(true)}
                className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-75"
                style={{
                  backgroundColor: visualTokens.accentColor || visualTokens.primaryColor,
                  color: visualTokens.bgColor,
                  opacity: 0.8,
                }}
              >
                Preview Script
              </button>
            )}

            {/* Start Performance Button */}
            <button
              onClick={handleStartPerformance}
              disabled={!partyKitInitialized || connectionStatus !== 'connected' || participants.length < 2}
              className="px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-75"
              style={{
                backgroundColor: visualTokens.primaryColor,
                color: visualTokens.bgColor,
              }}
            >
              {getButtonLabel('startPerformance')}
            </button>
          </div>
          {participants.length < 2 && (
            <p className="text-sm text-muted-foreground">
              At least 2 participants required to start performance
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
