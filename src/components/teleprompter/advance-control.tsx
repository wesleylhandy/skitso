/**
 * Script Advancement Control Component
 * 
 * Provides controls for advancing the script. Both Director and Actors
 * can advance, but Director has override authority.
 */

'use client';

import { useAtomValue } from 'jotai';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { performanceProgressAtom } from '@/src/state/atoms/performance-atom';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface AdvanceControlProps {
  onAdvance: () => void;
  onPause?: () => void;
  onResume?: () => void;
  canAdvance: boolean;
  isPaused: boolean;
}

/**
 * AdvanceControl Component
 * 
 * Displays advancement controls with Director override authority.
 */
export function AdvanceControl({
  onAdvance,
  onPause,
  onResume,
  canAdvance,
  isPaused,
}: AdvanceControlProps) {
  const participant = useAtomValue(participantAtom);
  const progress = useAtomValue(performanceProgressAtom);
  const { getButtonLabel, visualTokens } = useVibe();

  const isDirector = participant?.role === 'director';
  const hasOverride = progress.advancementControl.directorOverride && isDirector;

  return (
    <div className="flex items-center justify-center gap-4 p-4">
      {isPaused ? (
        <button
          onClick={onResume}
          disabled={!canAdvance || (!isDirector && hasOverride)}
          className="px-6 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-bg)',
            borderRadius: visualTokens.borderRadius,
            fontFamily: visualTokens.headerFont,
            cursor: (!canAdvance || (!isDirector && hasOverride)) ? 'not-allowed' : 'pointer',
          }}
          aria-label={getButtonLabel('resume') || 'Resume'}
        >
          {getButtonLabel('resume') || 'Resume'}
        </button>
      ) : (
        <>
          {onPause && isDirector && (
            <button
              onClick={onPause}
              className="px-6 py-3 font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-bg)',
                borderRadius: visualTokens.borderRadius,
                fontFamily: visualTokens.headerFont,
                cursor: 'pointer',
              }}
              aria-label={getButtonLabel('pause') || 'Pause'}
            >
              {getButtonLabel('pause') || 'Pause'}
            </button>
          )}
          <button
            onClick={onAdvance}
            disabled={!canAdvance || (!isDirector && hasOverride)}
            className="px-6 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
              borderRadius: visualTokens.borderRadius,
              fontFamily: visualTokens.headerFont,
              cursor: (!canAdvance || (!isDirector && hasOverride)) ? 'not-allowed' : 'pointer',
            }}
            aria-label={getButtonLabel('advance') || 'Advance'}
          >
            {getButtonLabel('advance') || 'Advance'}
          </button>
        </>
      )}
      {hasOverride && !isDirector && (
        <p className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
          Director has control
        </p>
      )}
    </div>
  );
}
