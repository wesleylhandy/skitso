/**
 * Character Assignment Modal Component
 * 
 * Modal for directors to assign or reassign characters to participants.
 * Allows selecting a character and participant, with support for self-assignment.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { CharacterCard } from '@/src/components/actor/character-card';
import { getPartyKitClient, onCharacterAssigned } from '@/src/lib/partykit/client';
import type { Character } from '@/src/state/types/session';

interface Participant {
  participantId: string;
  name: string;
  role: 'director' | 'actor';
}

interface CharacterAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetParticipantId?: string; // If provided, pre-select this participant
  targetCharacterId?: string; // If provided, pre-select this character (for reassignment)
  participants: Participant[];
}

export function CharacterAssignmentModal({
  isOpen,
  onClose,
  targetParticipantId,
  targetCharacterId,
  participants,
}: CharacterAssignmentModalProps) {
  const director = useAtomValue(participantAtom);
  const cast = useAtomValue(castAtom);
  const setCast = useSetAtom(castAtom);
  const sessionCode = useAtomValue(sessionCodeAtom);
  const { visualTokens } = useVibe();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(targetCharacterId || null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(targetParticipantId || null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedCharacterId(targetCharacterId || null);
      setSelectedParticipantId(targetParticipantId || null);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen, targetCharacterId, targetParticipantId]);

  // Handle dialog open/close and body scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      // Lock body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Prevent scroll propagation to background
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    const scrollableContent = dialog.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
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
  }, [isOpen]);

  // Handle ESC key and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (e.target === dialog) {
      onClose();
    }
  };

  // Get available characters
  // If targetCharacterId is provided (reassignment), only show that character
  // Otherwise, show all available characters (not locked, or locked to selected participant)
  const availableCharacters = targetCharacterId
    ? cast.filter((char) => char.id === targetCharacterId)
    : cast.filter((char) => 
        !char.isLocked || char.participantId === selectedParticipantId
      );

  // Get selected character
  const selectedCharacter = selectedCharacterId 
    ? cast.find((c) => c.id === selectedCharacterId) 
    : null;

  // Track pending assignment for confirmation
  const [pendingAssignment, setPendingAssignment] = useState<{
    characterId: string;
    participantId: string;
    originalCast: Character[];
  } | null>(null);

  // Listen for assignment confirmation
  useEffect(() => {
    if (!pendingAssignment || !sessionCode) return;

    const unsubscribe = onCharacterAssigned((data) => {
      if (
        data.sessionId === sessionCode &&
        data.characterId === pendingAssignment.characterId &&
        data.participantId === pendingAssignment.participantId
      ) {
        setSuccess(true);
        setLoading(false);
        setPendingAssignment(null);
        
        // Close modal after short delay to show success
        setTimeout(() => {
          onClose();
        }, 500);
      }
    });

    // Fallback: if no confirmation after 2 seconds, assume success (optimistic)
    const confirmationTimeout = setTimeout(() => {
      if (pendingAssignment) {
        setSuccess(true);
        setLoading(false);
        setPendingAssignment(null);
        setTimeout(() => {
          onClose();
        }, 500);
      }
    }, 2000);

    return () => {
      clearTimeout(confirmationTimeout);
      unsubscribe();
    };
  }, [pendingAssignment, sessionCode, onClose]);

  const handleAssign = () => {
    if (!sessionCode || !selectedCharacterId || !selectedParticipantId) {
      setError('Please select both a character and participant');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    // Store original cast for rollback
    const originalCast = [...cast];
    const character = cast.find((c) => c.id === selectedCharacterId);
    
    if (!character) {
      setError('Character not found');
      setLoading(false);
      return;
    }

    // Optimistic update - update UI immediately
    const optimisticCast = cast.map((char) => {
      if (char.id === selectedCharacterId) {
        return { ...char, participantId: selectedParticipantId, isLocked: false };
      }
      // Unassign from participant if they got a different character
      if (selectedParticipantId && char.participantId === selectedParticipantId && char.id !== selectedCharacterId) {
        return { ...char, participantId: null, isLocked: false };
      }
      return char;
    });
    
    setCast(optimisticCast);
    setPendingAssignment({
      characterId: selectedCharacterId,
      participantId: selectedParticipantId,
      originalCast,
    });

    try {
      const client = getPartyKitClient();
      if (!client) {
        throw new Error('Not connected to session');
      }

      const assignmentMessage = {
        type: 'character:assign',
        data: {
          sessionId: sessionCode,
          characterId: selectedCharacterId,
          participantId: selectedParticipantId,
        },
      };

      console.log('Sending character assignment:', assignmentMessage);

      // Send assignment (will be queued if disconnected)
      client.send(JSON.stringify(assignmentMessage));

      console.log('Character assignment message sent successfully');
    } catch (err) {
      console.error('Error assigning character:', err);
      // Rollback optimistic update on error
      setCast(originalCast);
      setPendingAssignment(null);
      setError(err instanceof Error ? err.message : 'Failed to assign character');
      setLoading(false);
    }
  };

  // Add backdrop styling
  useEffect(() => {
    const existingStyle = document.getElementById('dialog-backdrop-style');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'dialog-backdrop-style';
    style.textContent = `
      dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Early return must be after all hooks
  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-full max-w-4xl max-h-[90vh] rounded-lg p-0 m-auto"
      style={{
        backgroundColor: visualTokens.bgColor,
        color: visualTokens.textColor,
        borderColor: visualTokens.primaryColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: visualTokens.primaryColor }}
        >
          <h2
            className="text-2xl font-bold"
            style={{ color: visualTokens.primaryColor }}
          >
            {targetCharacterId ? 'Reassign Character' : 'Assign Character'}
          </h2>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: visualTokens.primaryColor,
              color: visualTokens.bgColor,
            }}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
          {error && (
            <div className="p-4 border rounded-lg" style={{ borderColor: 'red' }}>
              <p className="text-sm" style={{ color: 'red' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 border rounded-lg" style={{ borderColor: visualTokens.primaryColor, backgroundColor: `${visualTokens.primaryColor}20` }}>
              <p className="text-sm font-semibold" style={{ color: visualTokens.primaryColor }}>
                ✓ Character assigned successfully!
              </p>
            </div>
          )}

          {/* Participant Selection */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: visualTokens.textColor }}>
              Select Participant
            </label>
            <select
              value={selectedParticipantId || ''}
              onChange={(e) => setSelectedParticipantId(e.target.value || null)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              style={{
                backgroundColor: visualTokens.bgColor,
                color: visualTokens.textColor,
                borderColor: visualTokens.primaryColor,
              }}
            >
              <option value="">Choose a participant...</option>
              {participants.map((p) => (
                <option key={p.participantId} value={p.participantId}>
                  {p.participantId === director?.id ? 'You (Director)' : p.name}
                  {p.role === 'director' && p.participantId !== director?.id && ' (Director)'}
                </option>
              ))}
            </select>
          </div>

          {/* Character Selection - Only show if not a reassignment (targetCharacterId not provided) */}
          {!targetCharacterId && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: visualTokens.textColor }}>
                Select Character
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableCharacters.map((character) => {
                  const isSelected = selectedCharacterId === character.id;
                  const isLocked = character.isLocked && character.participantId !== selectedParticipantId;
                  
                  return (
                    <div
                      key={character.id}
                      onClick={() => !isLocked && setSelectedCharacterId(character.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'ring-2' : ''
                      } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                      style={{
                        borderColor: isSelected ? visualTokens.primaryColor : visualTokens.primaryColor,
                        backgroundColor: isSelected ? `${visualTokens.primaryColor}20` : visualTokens.bgColor,
                      }}
                    >
                      <CharacterCard character={character} />
                      {isLocked && (
                        <p className="text-xs mt-2" style={{ color: visualTokens.textColor, opacity: 0.7 }}>
                          Locked
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Show selected character for reassignment */}
          {targetCharacterId && selectedCharacter && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: visualTokens.textColor }}>
                Character to Reassign
              </label>
              <div className="p-4 border rounded-lg" style={{ borderColor: visualTokens.primaryColor }}>
                <CharacterCard character={selectedCharacter} />
              </div>
            </div>
          )}

          {/* Selected Character Preview - Only show for new assignments, not reassignments */}
          {selectedCharacter && !targetCharacterId && (
            <div className="p-4 border rounded-lg" style={{ borderColor: visualTokens.primaryColor }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: visualTokens.primaryColor }}>
                Selected Character
              </h3>
              <CharacterCard character={selectedCharacter} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-6 border-t flex justify-end gap-4"
          style={{ borderColor: visualTokens.primaryColor }}
        >
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'transparent',
              color: visualTokens.textColor,
              borderColor: visualTokens.primaryColor,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedCharacterId || !selectedParticipantId || loading}
            className="px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
            style={{
              backgroundColor: loading ? visualTokens.textColor + '40' : success ? visualTokens.primaryColor + 'CC' : visualTokens.primaryColor,
              color: visualTokens.bgColor,
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Assigning...
              </span>
            ) : success ? (
              <span className="flex items-center gap-2">
                <span>✓</span>
                Assigned!
              </span>
            ) : (
              'Assign Character'
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
