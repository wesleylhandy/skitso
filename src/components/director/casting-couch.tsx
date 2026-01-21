/**
 * Casting Couch Component
 * 
 * Director's view of the session lobby showing all participants,
 * character assignments, and connection status. Allows Director to
 * override character assignments and start the performance.
 */

'use client';

import { useEffect, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
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
import {
  initializePartyKitClient,
  getPartyKitClient,
  isPartyKitConnected,
  getConnectionStatus,
  joinSession,
  onVibeContextChange,
  onScriptUpdate,
  onPerformanceStart,
  startPerformance,
  leaveSession,
} from '@/src/lib/partykit/client';
import type { Participant, Character, ConnectionStatus as ConnectionStatusType } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';

interface PartyKitParticipant {
  participantId: string;
  connectionId: string;
  role: 'director' | 'actor';
  connectionStatus: ConnectionStatusType;
  joinedAt: number;
  lastSeen: number;
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
  const sessionCode = useAtomValue(sessionCodeAtom);
  const participant = useAtomValue(participantAtom);
  const cast = useAtomValue(castAtom);
  const script = useAtomValue(currentScriptAtom);
  const [vibe, setVibe] = useAtom(vibeAtom);
  const [, setSessionState] = useAtom(sessionStateAtom);
  const { getSectionTitle, getButtonLabel, visualTokens } = useVibe();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');
  const [participants, setParticipants] = useState<PartyKitParticipant[]>([]);
  const [partyKitInitialized, setPartyKitInitialized] = useState(false);
  const [isScriptPreviewOpen, setIsScriptPreviewOpen] = useState(false);
  const [selectedCharacterForDossier, setSelectedCharacterForDossier] = useState<Character | null>(null);

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
      const handleSessionJoined = (data: {
        sessionId: string;
        participantId: string;
        role: 'director' | 'actor';
        participants: PartyKitParticipant[];
        vibeContext: VibeType;
      }) => {
        setParticipants(data.participants);
        // Sync VibeContext from server
        if (data.vibeContext !== vibe) {
          setVibe(data.vibeContext);
        }
      };

      // Listen for participant joined/left events
      const handleParticipantJoined = (data: {
        participantId: string;
        connectionId: string;
        role: 'director' | 'actor';
        participants: PartyKitParticipant[];
      }) => {
        setParticipants(data.participants);
      };

      const handleParticipantLeft = (data: {
        connectionId: string;
        participantId?: string;
        participants: PartyKitParticipant[];
      }) => {
        setParticipants(data.participants);
      };

      // Set up event listeners using PartyKit client's message handling
      // Note: PartyKit client handles these via onMessage callback
      // We'll use the event listener system from the client wrapper

      // Listen for VibeContext changes
      const unsubscribeVibe = onVibeContextChange((data) => {
        if (data.sessionId === sessionCode) {
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
        if (data.sessionId === sessionCode) {
          // Update local state
          setSessionState('performing');
          // Call callback if provided
          onStartPerformance?.();
        }
      });

      // Set up connection status polling (PartyKit doesn't have direct event listeners)
      const statusInterval = setInterval(() => {
        updateConnectionStatus();
      }, 1000);

      // Cleanup
      return () => {
        mounted = false;
        clearInterval(statusInterval);
        unsubscribeVibe();
        unsubscribeScript();
        unsubscribePerformance();
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
  }, [sessionCode, participant, vibe, setVibe]);

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

    // Send character override event
    client.send(JSON.stringify({
      type: 'character:override',
      data: {
        sessionId: sessionCode,
        characterId,
        participantId: newParticipantId,
      },
    }));
  };

  // Handle start performance (Director only)
  const handleStartPerformance = () => {
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
                    {p.participantId === participant.id ? 'You' : `Participant ${p.participantId.slice(-6)}`}
                  </span>
                  <ConnectionStatus status={p.connectionStatus} />
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Role: {p.role}
                </div>
                {character ? (
                  <div className="mt-2">
                    <CharacterCard character={character} />
                    {isDirector && (
                      <button
                        onClick={() => setSelectedCharacterForDossier(character)}
                        className="mt-2 text-sm underline transition-opacity hover:opacity-75 cursor-pointer"
                        style={{ color: visualTokens.primaryColor }}
                      >
                        View Dossier
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No character assigned</div>
                )}
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
                  {!character.participantId && (
                    <button
                      onClick={() => handleCharacterOverride(character.id, null)}
                      className="text-sm transition-opacity hover:opacity-75"
                      style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}
                    >
                      Assign
                    </button>
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
    </div>
  );
}
