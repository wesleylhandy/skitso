/**
 * Teleprompter Component
 * 
 * Displays synchronized teleprompter with script lines, character assignments,
 * current line highlighting, and advancement controls. Synchronizes across
 * all devices via Socket.io.
 */

'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { performanceProgressAtom, type PerformanceProgress } from '@/src/state/atoms/performance-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { AdvanceControl } from './advance-control';
import { TimingIndicator } from './timing-indicator';
import { flattenScriptLines, getUpcomingLines } from './script-lines';
import { ConfirmationModal } from '@/src/components/ui/confirmation-modal';
import {
  initializePartyKitClient,
  onPerformanceProgress,
  advancePerformance,
} from '@/src/lib/partykit/client';

interface TeleprompterProps {
  sessionCode: string;
}

/**
 * Teleprompter Component
 * 
 * Main teleprompter display with synchronized script advancement.
 */
export function Teleprompter({ sessionCode }: TeleprompterProps) {
  const script = useAtomValue(currentScriptAtom);
  const participant = useAtomValue(participantAtom);
  const [progress, setProgress] = useAtom(performanceProgressAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const storedSessionCode = useAtomValue(sessionCodeAtom);
  const router = useRouter();
  const { visualTokens } = useVibe();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Derive pause state from progress
  const isPaused = progress.pausedAt !== null;

  // Flatten script into linear lines
  const scriptLines = useMemo(() => {
    if (!script) return [];
    return flattenScriptLines(script);
  }, [script]);

  // Get upcoming lines
  const upcomingLines = useMemo(
    () => getUpcomingLines(scriptLines, progress.currentLineIndex, 3),
    [scriptLines, progress.currentLineIndex]
  );

  // Initialize PartyKit and listen for progress updates
  useEffect(() => {
    if (!sessionCode) return;
    
    initializePartyKitClient(sessionCode);
    const unsubscribe = onPerformanceProgress((data) => {
      if (data.sessionId === sessionCode) {
        setProgress((prev) => ({
          ...prev,
          currentLineIndex: data.progress.currentLineIndex,
          currentScene: data.progress.currentScene,
          startedAt: data.progress.startedAt,
          pausedAt: data.progress.pausedAt,
          completedLines: data.progress.completedLines,
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionCode, setProgress]);

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLineRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const lineElement = currentLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const lineRect = lineElement.getBoundingClientRect();

      // Calculate scroll position to center the current line
      const scrollTop = lineElement.offsetTop - containerRect.height / 2 + lineRect.height / 2;

      // Apply vibe-appropriate scrolling behavior
      const scrollBehavior = visualTokens.animationStyle === 'snappy' ? 'auto' : 'smooth';

      container.scrollTo({
        top: scrollTop,
        behavior: scrollBehavior as ScrollBehavior,
      });
    }
  }, [progress.currentLineIndex, visualTokens.animationStyle]);

  // Handle start performance (Director only)
  const handleStart = useCallback(() => {
    if (participant?.role !== 'director') return;

    const startedAt = Date.now();
    const updatedProgress: PerformanceProgress = {
      ...progress,
      startedAt,
      pausedAt: null,
      advancementControl: {
        lastAdvancedBy: participant.id,
        lastAdvancedAt: startedAt,
        directorOverride: false,
      },
    };

    setProgress(updatedProgress);

    advancePerformance(sessionCode, {
      currentLineIndex: progress.currentLineIndex,
      currentScene: progress.currentScene,
      startedAt,
      pausedAt: null,
      completedLines: progress.completedLines,
    });
  }, [participant, progress, sessionCode, setProgress]);

  // Handle script advancement
  const handleAdvance = useCallback(() => {
    if (!script || progress.currentLineIndex >= scriptLines.length - 1) {
      return;
    }

    const newIndex = progress.currentLineIndex + 1;
    const newCompletedLines = [...progress.completedLines, progress.currentLineIndex];
    const newScene = scriptLines[newIndex]?.sceneIndex ?? progress.currentScene;

    const updatedProgress: PerformanceProgress = {
      ...progress,
      currentLineIndex: newIndex,
      currentScene: newScene,
      completedLines: newCompletedLines,
      advancementControl: {
        lastAdvancedBy: participant?.id || null,
        lastAdvancedAt: Date.now(),
        directorOverride: false,
      },
    };

    // Optimistic update
    setProgress(updatedProgress);

    // Broadcast to server
    advancePerformance(sessionCode, {
      currentLineIndex: newIndex,
      currentScene: newScene,
      startedAt: progress.startedAt,
      pausedAt: progress.pausedAt,
      completedLines: newCompletedLines,
    });
  }, [script, scriptLines, progress, participant, sessionCode, setProgress]);

  // Handle pause (Director only)
  const handlePause = useCallback(() => {
    if (participant?.role !== 'director') return;

    const pausedAt = Date.now();
    const updatedProgress: PerformanceProgress = {
      ...progress,
      pausedAt,
      advancementControl: {
        ...progress.advancementControl,
        directorOverride: true,
        lastAdvancedBy: participant.id,
        lastAdvancedAt: Date.now(),
      },
    };

    setProgress(updatedProgress);

    advancePerformance(sessionCode, {
      currentLineIndex: progress.currentLineIndex,
      currentScene: progress.currentScene,
      startedAt: progress.startedAt,
      pausedAt,
      completedLines: progress.completedLines,
    });
  }, [participant, progress, sessionCode, setProgress]);

  // Handle resume (Director only)
  const handleResume = useCallback(() => {
    if (participant?.role !== 'director') return;

    const updatedProgress: PerformanceProgress = {
      ...progress,
      pausedAt: null,
      advancementControl: {
        ...progress.advancementControl,
        directorOverride: false,
        lastAdvancedBy: participant.id,
        lastAdvancedAt: Date.now(),
      },
    };

    setProgress(updatedProgress);

    advancePerformance(sessionCode, {
      currentLineIndex: progress.currentLineIndex,
      currentScene: progress.currentScene,
      startedAt: progress.startedAt,
      pausedAt: null,
      completedLines: progress.completedLines,
    });
  }, [participant, progress, sessionCode, setProgress]);

  // Handle exit/stop performance
  const handleExit = useCallback(() => {
    // Reset performance progress
    setProgress({
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

    // Set session state back to casting (keep session active)
    setSessionState('casting');

    // Navigate based on role
    if (participant?.role === 'director') {
      router.push('/director-desk');
    } else if (storedSessionCode) {
      router.push(`/join/${storedSessionCode}`);
    } else {
      router.push('/');
    }
  }, [participant, storedSessionCode, router, setProgress, setSessionState]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (!isPaused && !progress.advancementControl.directorOverride) {
          handleAdvance();
        }
      }
      // Escape key to exit
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowExitConfirm(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleAdvance, isPaused, progress.advancementControl.directorOverride]);


  if (!script || scriptLines.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--color-primary)' }}>No script available</p>
      </div>
    );
  }

  const canAdvance = !isPaused && progress.currentLineIndex < scriptLines.length - 1;
  const isDirector = participant?.role === 'director';
  const hasStarted = progress.startedAt !== null;
  const { getButtonLabel } = useVibe();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Fixed Header with Controls (Director only) */}
      {isDirector && (
        <div 
          className="sticky top-0 z-10 border-b p-4"
          style={{ 
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-primary)',
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {script.title}
              </h1>
              <p className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
                Scene {progress.currentScene + 1} • Line {progress.currentLineIndex + 1} of {scriptLines.length}
              </p>
            </div>
            {/* Timing Indicator */}
            <div className="shrink-0 min-w-[200px]">
              <TimingIndicator 
                estimatedDuration={5} // Default 5 seconds per line (can be enhanced with script timing data)
                isPaused={isPaused}
              />
            </div>
          </div>
          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {!hasStarted ? (
              <button
                onClick={handleStart}
                className="px-6 py-3 font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-bg)',
                  borderRadius: visualTokens.borderRadius,
                  fontFamily: visualTokens.headerFont,
                  cursor: 'pointer',
                }}
                aria-label={getButtonLabel('start') || 'Start Performance'}
              >
                {getButtonLabel('start') || 'Start'}
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    className="px-6 py-3 font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-bg)',
                      borderRadius: visualTokens.borderRadius,
                      fontFamily: visualTokens.headerFont,
                      cursor: 'pointer',
                    }}
                    aria-label={getButtonLabel('resume') || 'Resume'}
                  >
                    {getButtonLabel('resume') || 'Resume'}
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
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
                  onClick={handleAdvance}
                  disabled={!canAdvance}
                  className="px-6 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-bg)',
                    borderRadius: visualTokens.borderRadius,
                    fontFamily: visualTokens.headerFont,
                    cursor: canAdvance ? 'pointer' : 'not-allowed',
                  }}
                  aria-label={getButtonLabel('advance') || 'Advance'}
                >
                  {getButtonLabel('advance') || 'Advance'}
                </button>
              </>
            )}
            {/* Exit Button */}
            <button
              onClick={() => setShowExitConfirm(true)}
              className="px-6 py-3 font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-error, #ef4444)',
                color: 'var(--color-bg)',
                borderRadius: visualTokens.borderRadius,
                fontFamily: visualTokens.headerFont,
                cursor: 'pointer',
              }}
              aria-label={getButtonLabel('exit') || 'Exit Performance'}
            >
              {getButtonLabel('exit') || 'Exit'}
            </button>
          </div>
        </div>
      )}

      {/* Header for Actors (non-fixed) */}
      {!isDirector && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-primary)' }}>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {script.title}
              </h1>
              <p className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
                Scene {progress.currentScene + 1} • Line {progress.currentLineIndex + 1} of {scriptLines.length}
              </p>
            </div>
            {/* Timing Indicator */}
            <div className="shrink-0 min-w-[200px]">
              <TimingIndicator 
                estimatedDuration={5}
                isPaused={isPaused}
              />
            </div>
          </div>
        </div>
      )}

      {/* Script Display */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto p-8 ${isDirector ? '' : ''}`}
        style={{
          scrollBehavior: visualTokens.animationStyle === 'snappy' ? 'auto' : 'smooth',
        }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {scriptLines.map((line, index) => {
            const isCurrent = index === progress.currentLineIndex;
            const isCompleted = progress.completedLines.includes(index);
            const isUpcoming = upcomingLines.some((l) => l.index === index);
            const isMyLine =
              line.type === 'dialogue' && line.characterName === participant?.characterAssignment?.name;
            
            // Highlight all of the actor's lines (not just current)
            const shouldHighlightMyLine = isMyLine;

            return (
              <div
                key={line.index}
                ref={isCurrent ? currentLineRef : null}
                className={`p-4 rounded transition-all relative ${
                  isCurrent
                    ? 'ring-2 scale-105'
                    : shouldHighlightMyLine
                      ? 'ring-2 ring-offset-2'
                      : isCompleted
                        ? 'opacity-50'
                        : isUpcoming
                          ? 'opacity-75'
                          : 'opacity-30'
                }`}
                style={{
                  backgroundColor: isCurrent 
                    ? 'var(--color-primary)' 
                    : shouldHighlightMyLine
                      ? 'var(--color-accent)'
                      : 'transparent',
                  color: isCurrent 
                    ? 'var(--color-bg)' 
                    : shouldHighlightMyLine
                      ? 'var(--color-bg)'
                      : 'var(--color-primary)',
                  borderColor: isCurrent 
                    ? 'var(--color-primary)' 
                    : shouldHighlightMyLine
                      ? 'var(--color-accent)'
                      : 'transparent',
                  borderWidth: (isCurrent || shouldHighlightMyLine) ? '2px' : '0',
                  borderStyle: 'solid',
                  opacity: shouldHighlightMyLine && !isCompleted ? 1 : isCompleted ? 0.5 : undefined,
                }}
              >
                {/* Visual timing cue - pulsing indicator for current line */}
                {isCurrent && !isPaused && (
                  <div 
                    className="absolute top-0 left-0 h-1 rounded-t"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-accent)',
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  />
                )}
                {/* Paused indicator */}
                {isCurrent && isPaused && (
                  <div 
                    className="absolute top-2 right-2 text-xs font-semibold opacity-75"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    ⏸
                  </div>
                )}
                {line.type === 'dialogue' && (
                  <div>
                    <div
                      className="font-semibold mb-2"
                      style={{
                        color: isCurrent 
                          ? 'var(--color-bg)' 
                          : shouldHighlightMyLine
                            ? 'var(--color-bg)'
                            : 'var(--color-accent)',
                      }}
                    >
                      {line.characterName}
                      {isMyLine && (
                        <span className="ml-2 text-xs opacity-75">(You)</span>
                      )}
                    </div>
                    <div>{line.content}</div>
                  </div>
                )}
                {line.type === 'stageDirection' && (
                  <div
                    className="italic text-sm opacity-75"
                    style={{
                      color: isCurrent ? 'var(--color-bg)' : 'var(--color-accent)',
                    }}
                  >
                    [Stage Direction] {line.content}
                  </div>
                )}
                {line.type === 'soundCue' && (
                  <div
                    className="text-sm font-mono"
                    style={{
                      color: isCurrent ? 'var(--color-bg)' : 'var(--color-accent)',
                    }}
                  >
                    🔊 {line.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Advancement Controls (Actors only - Director controls are in fixed header) */}
      {!isDirector && (
        <div className="border-t p-4" style={{ borderColor: 'var(--color-primary)' }}>
          <div className="flex items-center justify-center gap-4">
            <AdvanceControl
              onAdvance={handleAdvance}
              onPause={undefined}
              onResume={undefined}
              canAdvance={canAdvance}
              isPaused={isPaused}
            />
            {/* Exit Button for Actors */}
            <button
              onClick={() => setShowExitConfirm(true)}
              className="px-6 py-3 font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-error, #ef4444)',
                color: 'var(--color-bg)',
                borderRadius: visualTokens.borderRadius,
                fontFamily: visualTokens.headerFont,
                cursor: 'pointer',
              }}
              aria-label={getButtonLabel('exit') || 'Exit Performance'}
            >
              {getButtonLabel('exit') || 'Exit'}
            </button>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      <ConfirmationModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={handleExit}
        title="Exit Performance?"
        message="Are you sure you want to exit the performance? This will stop the script and return you to the previous screen."
        confirmLabel="Exit"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}
