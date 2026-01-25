/**
 * Actor Preview Component
 * 
 * Displays characters and script preview for actors after joining.
 * Allows actors to request character assignments.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import {
  onCharacterAssigned,
  onAssignmentApproved,
  onAssignmentSuggested,
  onAssignmentConfirmed,
} from '@/src/lib/partykit/client';
import { CharacterCard } from '@/src/components/actor/character-card';
import { CharacterDossier } from '@/src/components/actor/character-dossier';
import { ScriptPreviewModal } from '@/src/components/director/script-preview-modal';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { getPartyKitClient } from '@/src/lib/partykit/client';
import type { Character } from '@/src/state/types/session';

interface ActorPreviewProps {
  onAssignmentLocked?: () => void;
}

export function ActorPreview({ onAssignmentLocked }: ActorPreviewProps) {
  const [participant, setParticipant] = useAtom(participantAtom);
  const [cast, setCast] = useAtom(castAtom);
  const script = useAtomValue(currentScriptAtom);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const { visualTokens, getSectionTitle } = useVibe();
  
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isScriptPreviewOpen, setIsScriptPreviewOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lock body scroll when dossier modal is open
  useEffect(() => {
    if (isDossierOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDossierOpen]);

  // Prevent scroll propagation to background in dossier modal
  useEffect(() => {
    if (!isDossierOpen) return;

    const scrollableContent = document.getElementById('actor-dossier-scroll');
    if (!scrollableContent) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollableContent;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Prevent scroll propagation if not at boundaries
      if (!isAtTop && !isAtBottom) {
        e.stopPropagation();
      } else if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        // At boundary and trying to scroll further - prevent background scroll
        e.preventDefault();
        e.stopPropagation();
      }
    };

    scrollableContent.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollableContent.removeEventListener('wheel', handleWheel);
    };
  }, [isDossierOpen]);

  // Listen for assignment events
  useEffect(() => {
    if (!sessionCode || !participant) {
      return;
    }

    const unsubscribeCharacterAssigned = onCharacterAssigned((data) => {
      if (data.sessionId === sessionCode && data.participantId === participant.id) {
        setCast((currentCast) => {
          return currentCast.map((char) => {
            if (char.id === data.characterId) {
              return { ...char, participantId: data.participantId, isLocked: data.isLocked };
            }
            if (data.participantId && char.participantId === data.participantId && char.id !== data.characterId) {
              return { ...char, participantId: null, isLocked: false };
            }
            return char;
          });
        });

        const assignedCharacter = cast.find((c) => c.id === data.characterId);
        if (assignedCharacter) {
          setParticipant({
            ...participant,
            characterAssignment: assignedCharacter,
            assignmentStatus: data.isLocked ? 'locked' : 'pending',
          });
        }
      }
    });

    const unsubscribeAssignmentApproved = onAssignmentApproved((data) => {
      if (data.sessionId === sessionCode && data.participantId === participant.id) {
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
      if (data.sessionId === sessionCode && data.participantId === participant.id) {
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
      if (data.sessionId === sessionCode) {
        setCast((currentCast) => {
          return currentCast.map((char) => {
            if (char.id === data.characterId) {
              return { ...char, isLocked: true };
            }
            return char;
          });
        });

        if (data.participantId === participant.id) {
          setParticipant({
            ...participant,
            assignmentStatus: 'locked',
          });
          onAssignmentLocked?.();
        }
      }
    });

    return () => {
      unsubscribeCharacterAssigned();
      unsubscribeAssignmentApproved();
      unsubscribeAssignmentSuggested();
      unsubscribeAssignmentConfirmed();
    };
  }, [sessionCode, participant, cast, setCast, setParticipant, onAssignmentLocked]);

  // CRITICAL: Only show assignment UI if participant belongs to current session
  // This prevents stale localStorage data from previous sessions showing confirmation modals
  const participantBelongsToCurrentSession = participant?.sessionId === sessionCode;

  // Check if actor has a locked assignment (only if participant belongs to current session)
  const hasLockedAssignment = participantBelongsToCurrentSession &&
    participant?.characterAssignment && 
    participant.assignmentStatus === 'locked';

  // Check if actor has a pending assignment (only if participant belongs to current session)
  const hasPendingAssignment = participantBelongsToCurrentSession &&
    participant?.characterAssignment && 
    participant.assignmentStatus === 'pending';

  // Check if actor has requested a character (only if participant belongs to current session)
  const hasRequested = participantBelongsToCurrentSession &&
    participant?.assignmentStatus === 'requested';

  // Get available characters (not locked to other participants)
  // Only show if participant belongs to current session
  const availableCharacters = participantBelongsToCurrentSession
    ? cast.filter((char) => 
        !char.isLocked || char.participantId === participant?.id
      )
    : [];

  const handleRequestAssignment = async (characterId: string) => {
    if (!sessionCode || !participant || participant.sessionId !== sessionCode) {
      setError('Session or participant not found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getPartyKitClient();
      if (!client || client.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to session');
      }

      // Send assignment request
      client.send(JSON.stringify({
        type: 'assignment:request',
        data: {
          sessionId: sessionCode,
          participantId: participant.id,
          characterId,
        },
      }));

      // Update local state
      setParticipant({
        ...participant,
        assignmentStatus: 'requested',
        requestedCharacterId: characterId,
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request assignment');
      setLoading(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!sessionCode || !participant || !participant.characterAssignment) {
      setError('No assignment to confirm');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getPartyKitClient();
      if (!client || client.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to session');
      }

      // Confirm assignment (locks it)
      client.send(JSON.stringify({
        type: 'assignment:confirm',
        data: {
          sessionId: sessionCode,
          participantId: participant.id,
          characterId: participant.characterAssignment.id,
        },
      }));

      setLoading(false);
      onAssignmentLocked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm assignment');
      setLoading(false);
    }
  };

  // Don't render assignment UI if participant doesn't belong to current session
  // This prevents stale localStorage data from showing confirmation modals
  if (!participantBelongsToCurrentSession) {
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg" style={{ borderColor: visualTokens.primaryColor }}>
          <p className="text-sm" style={{ color: visualTokens.textColor, opacity: 0.8 }}>
            Please join this session to see available characters.
          </p>
        </div>
      </div>
    );
  }

  if (hasLockedAssignment) {
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg" style={{ borderColor: visualTokens.primaryColor }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: visualTokens.primaryColor }}>
            Your Character
          </h2>
          {participant.characterAssignment && (
            <CharacterCard character={participant.characterAssignment} />
          )}
          <p className="mt-4 text-sm" style={{ color: visualTokens.textColor, opacity: 0.8 }}>
            Your assignment is locked. Waiting for director to start the performance...
          </p>
        </div>
      </div>
    );
  }

  if (hasPendingAssignment) {
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg" style={{ borderColor: visualTokens.primaryColor }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: visualTokens.primaryColor }}>
            Character Assignment
          </h2>
          {participant.characterAssignment && (
            <>
              <CharacterCard character={participant.characterAssignment} />
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleConfirmAssignment}
                  disabled={loading}
                  className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: visualTokens.primaryColor,
                    color: visualTokens.bgColor,
                    pointerEvents: loading ? 'none' : 'auto',
                  }}
                >
                  {loading ? 'Confirming...' : 'Confirm Assignment'}
                </button>
                <p className="text-sm" style={{ color: visualTokens.textColor, opacity: 0.8 }}>
                  The director has assigned you this character. Confirm to lock it in.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: visualTokens.primaryColor }}>
          {getSectionTitle('castingCouch')}
        </h2>
        {script && (
          <button
            onClick={() => setIsScriptPreviewOpen(true)}
            className="px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: visualTokens.accentColor || visualTokens.primaryColor,
              color: visualTokens.bgColor,
              pointerEvents: 'auto',
            }}
          >
            Preview Script
          </button>
        )}
      </div>

      {error && (
        <ErrorMessage message={error} />
      )}

      {hasRequested && (
        <div className="p-4 border rounded-lg" style={{ borderColor: visualTokens.primaryColor }}>
          <p className="text-sm" style={{ color: visualTokens.textColor }}>
            Your assignment request is pending director approval...
          </p>
        </div>
      )}

      <div>
        <h3 className="text-xl font-semibold mb-4" style={{ color: visualTokens.textColor }}>
          Available Characters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableCharacters.map((character) => {
            const isRequested = participant?.requestedCharacterId === character.id;
            const isAssigned = character.participantId === participant?.id;
            
            return (
              <div key={character.id} className="space-y-2">
                <CharacterCard character={character} />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedCharacter(character);
                      setIsDossierOpen(true);
                    }}
                    className="text-sm underline transition-opacity hover:opacity-75"
                    style={{ color: visualTokens.primaryColor }}
                  >
                    View Dossier
                  </button>
                  {!isAssigned && !isRequested && !hasRequested && (
                    <button
                      onClick={() => handleRequestAssignment(character.id)}
                      disabled={loading || hasRequested}
                      className="text-sm transition-opacity hover:opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}
                    >
                      {loading ? 'Requesting...' : 'Request Assignment'}
                    </button>
                  )}
                  {isRequested && (
                    <span className="text-sm" style={{ color: visualTokens.textColor, opacity: 0.8 }}>
                      Requested
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Script Preview Modal */}
      <ScriptPreviewModal
        isOpen={isScriptPreviewOpen}
        onClose={() => setIsScriptPreviewOpen(false)}
      />

      {/* Character Dossier Modal */}
      {selectedCharacter && (
        <div
          className={`fixed inset-0 z-50 ${isDossierOpen ? 'block' : 'hidden'}`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setIsDossierOpen(false)}
        >
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] rounded-lg overflow-hidden flex flex-col"
            style={{
              backgroundColor: visualTokens.bgColor,
              color: visualTokens.textColor,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b" style={{ borderColor: visualTokens.primaryColor }}>
              <h2 className="text-2xl font-bold" style={{ color: visualTokens.primaryColor }}>
                Character Dossier
              </h2>
              <button
                onClick={() => setIsDossierOpen(false)}
                className="px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: visualTokens.primaryColor,
                  color: visualTokens.bgColor,
                  pointerEvents: 'auto',
                }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain" id="actor-dossier-scroll">
              <CharacterDossier character={selectedCharacter} onBack={() => setIsDossierOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
