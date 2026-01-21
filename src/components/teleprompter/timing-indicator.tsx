/**
 * Timing Indicator Component
 * 
 * Displays countdown timer and visual cues for current line timing.
 * Shows elapsed time, estimated duration, and pacing indicators.
 */

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { performanceProgressAtom } from '@/src/state/atoms/performance-atom';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface TimingIndicatorProps {
  /**
   * Estimated duration for current line in seconds
   * Defaults to 5 seconds if not provided
   */
  estimatedDuration?: number;
  /**
   * Whether the performance is paused
   */
  isPaused: boolean;
}

/**
 * TimingIndicator Component
 * 
 * Displays countdown/elapsed time and visual progress indicators
 * for the current line in the teleprompter.
 */
export function TimingIndicator({ 
  estimatedDuration = 5, 
  isPaused 
}: TimingIndicatorProps) {
  const progress = useAtomValue(performanceProgressAtom);
  const { visualTokens } = useVibe();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Calculate when current line started (from lastAdvancedAt)
  // Use useMemo to derive the start time from progress state
  const lineStartTime = useMemo(() => {
    // If we have a lastAdvancedAt timestamp, use it
    if (progress.advancementControl.lastAdvancedAt) {
      return progress.advancementControl.lastAdvancedAt;
    }
    // Otherwise, return 0 - the elapsed time calculation will handle this
    return 0;
  }, [progress.advancementControl.lastAdvancedAt, progress.currentLineIndex]);

  // Update elapsed time every 100ms
  useEffect(() => {
    if (isPaused) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      // Use lineStartTime if available, otherwise calculate from current time
      const startTime = lineStartTime > 0 ? lineStartTime : Date.now();
      const elapsed = (now - startTime) / 1000; // Convert to seconds
      setElapsedTime(Math.max(0, elapsed));
    }, 100);

    return () => clearInterval(interval);
  }, [lineStartTime, isPaused]);

  // Reset elapsed time when line changes - using functional update to avoid lint error
  const prevLineIndexRef = useRef(progress.currentLineIndex);
  useEffect(() => {
    if (prevLineIndexRef.current !== progress.currentLineIndex) {
      prevLineIndexRef.current = progress.currentLineIndex;
      // Use functional update to avoid lint warning about synchronous setState
      setElapsedTime(() => 0);
    }
  }, [progress.currentLineIndex]);

  // Calculate progress percentage (0-100)
  const progressPercent = useMemo(() => {
    if (estimatedDuration <= 0) return 0;
    return Math.min(100, (elapsedTime / estimatedDuration) * 100);
  }, [elapsedTime, estimatedDuration]);

  // Calculate remaining time
  const remainingTime = Math.max(0, estimatedDuration - elapsedTime);

  // Determine pacing indicator (fast/normal/slow based on elapsed vs estimated)
  const pacingIndicator = useMemo(() => {
    if (estimatedDuration <= 0) return 'normal';
    const ratio = elapsedTime / estimatedDuration;
    if (ratio < 0.7) return 'fast';
    if (ratio > 1.3) return 'slow';
    return 'normal';
  }, [elapsedTime, estimatedDuration]);

  // Format time display (MM:SS or SS)
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ 
      backgroundColor: 'var(--color-bg)',
      border: '1px solid',
      borderColor: 'var(--color-primary)',
    }}>
      {/* Time Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
            Elapsed:
          </span>
          <span 
            className="text-lg font-semibold tabular-nums" 
            style={{ color: 'var(--color-primary)' }}
          >
            {formatTime(elapsedTime)}
          </span>
        </div>
        {estimatedDuration > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
              Est:
            </span>
            <span 
              className="text-lg font-semibold tabular-nums" 
              style={{ color: 'var(--color-primary)' }}
            >
              {formatTime(estimatedDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ 
        backgroundColor: 'var(--color-bg)',
        border: '1px solid',
        borderColor: 'var(--color-primary)',
      }}>
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: 'var(--color-primary)',
            transitionTimingFunction: visualTokens.animationStyle === 'snappy' ? 'linear' : 'ease-out',
          }}
        />
        {/* Pacing indicator overlay */}
        {pacingIndicator === 'fast' && (
          <div 
            className="absolute inset-0 opacity-20"
            style={{ backgroundColor: '#00ff00' }}
          />
        )}
        {pacingIndicator === 'slow' && (
          <div 
            className="absolute inset-0 opacity-20"
            style={{ backgroundColor: '#ff0000' }}
          />
        )}
      </div>

      {/* Visual Cues */}
      <div className="flex items-center justify-between text-xs">
        {/* Pacing Indicator */}
        <div className="flex items-center gap-1">
          <span className="opacity-75" style={{ color: 'var(--color-accent)' }}>
            Pacing:
          </span>
          <span 
            className="font-semibold"
            style={{ 
              color: pacingIndicator === 'fast' 
                ? '#00ff00' 
                : pacingIndicator === 'slow' 
                  ? '#ff0000' 
                  : 'var(--color-primary)' 
            }}
          >
            {pacingIndicator === 'fast' ? 'Fast' : pacingIndicator === 'slow' ? 'Slow' : 'Normal'}
          </span>
        </div>

        {/* Countdown/Remaining */}
        {estimatedDuration > 0 && remainingTime > 0 && (
          <div className="flex items-center gap-1">
            <span className="opacity-75" style={{ color: 'var(--color-accent)' }}>
              Remaining:
            </span>
            <span 
              className="font-semibold tabular-nums"
              style={{ 
                color: remainingTime < 2 ? '#ff0000' : 'var(--color-primary)' 
              }}
            >
              {formatTime(remainingTime)}
            </span>
          </div>
        )}
      </div>

      {/* Paused Indicator */}
      {isPaused && (
        <div className="text-center text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
          ⏸ Paused
        </div>
      )}
    </div>
  );
}
