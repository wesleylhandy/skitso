/**
 * Reset Session Button
 * 
 * Button component that allows users to clear all session state
 * and start a new session from scratch.
 */

'use client';

import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { performanceProgressAtom } from '@/src/state/atoms/performance-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { ConfirmationModal } from '@/src/components/ui/confirmation-modal';

interface ResetSessionButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

/**
 * Reset Session Button Component
 * 
 * Clears all session-specific state and allows starting fresh.
 * Preserves user preferences (vibe, chaos level).
 */
export function ResetSessionButton({ variant = 'secondary', className = '' }: ResetSessionButtonProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const setSessionState = useSetAtom(sessionStateAtom);
  const setSessionCode = useSetAtom(sessionCodeAtom);
  const setCast = useSetAtom(castAtom);
  const setScript = useSetAtom(currentScriptAtom);
  const setParticipant = useSetAtom(participantAtom);
  const setPerformanceProgress = useSetAtom(performanceProgressAtom);
  const setWrapPartyData = useSetAtom(wrapPartyDataAtom);
  const { getButtonLabel, visualTokens } = useVibe();

  const handleResetClick = () => {
    setShowConfirmModal(true);
  };

  const handleReset = () => {

    // Leave PartyKit session if connected
    try {
      // Dynamic import to avoid issues if module not available
      import('@/src/lib/partykit/client').then((partykitClient) => {
        partykitClient.disconnectPartyKit();
      }).catch(() => {
        // Ignore errors if module not available
      });
    } catch (error) {
      // Ignore errors - might not be connected
      console.warn('Error leaving session:', error);
    }

    // Clear all session state using atom setters
    setSessionCode(null);
    setSessionState('idle');
    setCast([]);
    setScript(null);
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
    setWrapPartyData(null);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buttonStyles = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-bg)',
    },
    secondary: {
      borderColor: 'var(--color-accent)',
      color: 'var(--color-accent)',
      backgroundColor: 'transparent',
    },
    danger: {
      backgroundColor: 'var(--color-error, #ef4444)',
      color: 'var(--color-bg)',
    },
  };

  const style = buttonStyles[variant];

  return (
    <>
      <button
        type="button"
        onClick={handleResetClick}
        className={`px-4 py-2 rounded font-medium ${variant === 'secondary' ? 'border' : ''} ${className}`}
        style={{
          ...style,
          fontFamily: visualTokens.headerFont,
        }}
      >
        Start New Session
      </button>
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleReset}
        title="Start New Session?"
        message="Are you sure you want to start a new session? This will clear all current session data."
        confirmLabel="Start New Session"
        cancelLabel="Cancel"
        variant="default"
      />
    </>
  );
}
