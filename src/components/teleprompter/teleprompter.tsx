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
  getConnectionStatus,
  onConnectionStatusChange,
  endPerformance,
} from '@/src/lib/partykit/client';
import type { ConnectionStatus } from '@/src/lib/partykit/client';
import { ConnectionStatusBadge } from '@/src/components/ui/connection-status-badge';

interface TeleprompterProps {
  sessionCode: string;
  participantsCount?: number;
}

/**
 * Teleprompter Component
 * 
 * Main teleprompter display with synchronized script advancement.
 */
export function Teleprompter({ sessionCode, participantsCount }: TeleprompterProps) {
  const script = useAtomValue(currentScriptAtom);
  const participant = useAtomValue(participantAtom);
  const [progress, setProgress] = useAtom(performanceProgressAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const storedSessionCode = useAtomValue(sessionCodeAtom);
  const router = useRouter();
  const { visualTokens, getButtonLabel, getSectionTitle } = useVibe();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [readThroughBannerDismissed, setReadThroughBannerDismissed] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(getConnectionStatus());
  const [hasExceededExpectedDuration, setHasExceededExpectedDuration] = useState(false);
  // Track previous startedAt to detect changes and avoid synchronous setState in effect
  // Guard against null progress during initial render
  const prevStartedAtRef = useRef<number | null>(progress?.startedAt ?? null);
  
  // Derive pause state from progress (guard against null)
  const isPaused = progress?.pausedAt !== null && progress?.pausedAt !== undefined;

  // Flatten script into linear lines
  const scriptLines = useMemo(() => {
    if (!script) return [];
    return flattenScriptLines(script);
  }, [script]);

  // Extract currentLineIndex for dependency tracking (avoid reference equality issues)
  const currentLineIndex = progress?.currentLineIndex ?? 0;

  // Get upcoming lines (guard against null progress)
  const upcomingLines = useMemo(
    () => getUpcomingLines(scriptLines, currentLineIndex, 3),
    [scriptLines, currentLineIndex]
  );

  // Use default progress if null (shouldn't happen, but guard against it)
  const safeProgress = useMemo(() => progress ?? {
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
  }, [progress]);

  // Initialize PartyKit and listen for progress updates
  useEffect(() => {
    if (!sessionCode) return;
    
    initializePartyKitClient(sessionCode);
    const unsubscribeProgress = onPerformanceProgress((data) => {
      if (data.sessionId === sessionCode) {
        setProgress((prev) => {
          // Guard against null prev
          const baseProgress = prev ?? {
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
          };
          return {
            ...baseProgress,
            currentLineIndex: data.progress.currentLineIndex,
            currentScene: data.progress.currentScene,
            startedAt: data.progress.startedAt,
            pausedAt: data.progress.pausedAt,
            completedLines: data.progress.completedLines,
          };
        });
      }
    });

    const unsubscribeConnection = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeConnection();
    };
  }, [sessionCode, setProgress]);

  // Auto-scroll to current line - keep current action at top
  useEffect(() => {
    const currentIndex = currentLineIndex;
    console.log('[Teleprompter] Scroll effect triggered for line index:', currentIndex);
    
    // Wait for DOM to update after state change, then find and scroll to current line
    const scrollToCurrentLine = () => {
      const container = scrollContainerRef.current;
      if (!container) {
        console.warn('[Teleprompter] Scroll container not found');
        return;
      }

      // Try ref first (fastest), then fall back to data attribute lookup
      let lineElement: HTMLElement | null = null;
      
      // Check if ref points to the correct line
      if (currentLineRef.current) {
        const refIndex = currentLineRef.current.getAttribute('data-line-index');
        if (refIndex === String(currentIndex)) {
          lineElement = currentLineRef.current;
        }
      }
      
      // Fall back to querySelector if ref doesn't match or isn't set
      if (!lineElement) {
        lineElement = container.querySelector(
          `[data-line-index="${currentIndex}"]`
        ) as HTMLElement | null;
      }
      
      if (!lineElement) {
        console.warn(`[Teleprompter] Line element not found for index ${currentIndex}, retrying...`);
        // Element not found yet, try again after a short delay
        // This can happen if React hasn't finished rendering
        setTimeout(() => {
          const retryElement = container.querySelector(
            `[data-line-index="${currentIndex}"]`
          ) as HTMLElement | null;
          if (retryElement) {
            scrollElementToTop(container, retryElement);
          } else {
            console.error(`[Teleprompter] Line element still not found for index ${currentIndex} after retry`);
          }
        }, 50);
        return;
      }

      scrollElementToTop(container, lineElement);
    };

    const scrollElementToTop = (container: HTMLElement, lineElement: HTMLElement) => {
      // Determine scroll behavior
      let scrollBehavior: ScrollBehavior = visualTokens.animationStyle === 'snappy' ? 'auto' : 'smooth';

      // Respect reduced motion preferences
      try {
        if (typeof window !== 'undefined') {
          const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
          const reducedFromOS = !!mediaQuery && mediaQuery.matches;
          const reducedFromTheme =
            typeof document !== 'undefined' &&
            document.documentElement.getAttribute('data-reduced-motion') === 'reduce';

          if (reducedFromOS || reducedFromTheme) {
            scrollBehavior = 'auto';
          }
        }
      } catch {
        // Fall back to existing behavior
      }

      // Use scrollIntoView - the simplest and most reliable method
      // block: 'start' scrolls the element to the top of the scroll container
      // This works even when the element is off-screen
      const behavior = scrollBehavior === 'smooth' ? 'smooth' : 'auto';
      
      console.log('[Teleprompter] Calling scrollIntoView for line', {
        currentIndex,
        behavior,
        containerScrollTop: container.scrollTop,
      });
      
      lineElement.scrollIntoView({ 
        block: 'start', 
        inline: 'nearest',
        behavior: behavior as ScrollBehavior
      });

      console.log('[Teleprompter] scrollIntoView completed', {
        currentIndex,
        containerScrollTop: container.scrollTop,
      });
    };

      // Use double requestAnimationFrame to ensure:
      // 1. React has finished rendering and DOM is updated
      // 2. Browser has completed layout calculation
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToCurrentLine);
      });
    }, [currentLineIndex, visualTokens.animationStyle]);

  // Handle start performance (Director only)
  const handleStart = useCallback(() => {
    if (participant?.role !== 'director') {
      console.warn('[Teleprompter] Only director can start performance');
      return;
    }
    if (connectionStatus !== 'connected') {
      console.warn('[Teleprompter] Not connected, cannot start performance');
      return;
    }
    if (!safeProgress) {
      console.warn('[Teleprompter] No progress available, cannot start performance');
      return;
    }

    const startedAt = Date.now();
    const updatedProgress: PerformanceProgress = {
      ...safeProgress,
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
      currentLineIndex: safeProgress.currentLineIndex,
      currentScene: safeProgress.currentScene,
      startedAt,
      pausedAt: null,
      completedLines: safeProgress.completedLines,
    });
  }, [participant, safeProgress, sessionCode, setProgress, connectionStatus]);

  // Handle script advancement
  const handleAdvance = useCallback(() => {
    if (!script || !progress) return;
    if (progress.currentLineIndex >= scriptLines.length - 1) {
      return;
    }

    if (connectionStatus !== 'connected') {
      // Avoid drifting out of sync when the network is unhealthy (T190/T191).
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
  }, [script, scriptLines, progress, participant, sessionCode, setProgress, connectionStatus]);

  // Handle pause (Director only)
  const handlePause = useCallback(() => {
    if (participant?.role !== 'director') return;
    if (connectionStatus !== 'connected') return;

    const pausedAt = Date.now();
    const updatedProgress: PerformanceProgress = {
      ...progress,
      pausedAt,
      advancementControl: {
        ...progress?.advancementControl,
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
  }, [participant, progress, sessionCode, setProgress, connectionStatus]);

  // Handle resume (Director only)
  const handleResume = useCallback(() => {
    if (participant?.role !== 'director') return;
    if (connectionStatus !== 'connected') return;
    if (!progress) return;

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
  }, [participant, progress, sessionCode, setProgress, connectionStatus]);

  // Watch for significantly long performances and surface a soft warning so
  // Directors know it's safe to wrap gracefully when things run long (T193).
  useEffect(() => {
    const prevStartedAt = prevStartedAtRef.current;
    const currentStartedAt = safeProgress.startedAt;
    
    // Only reset when startedAt changes from truthy to falsy (performance stopped)
    if (!currentStartedAt && prevStartedAt !== null) {
      // Use setTimeout to defer state update and avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setHasExceededExpectedDuration(false);
      }, 0);
      prevStartedAtRef.current = null;
      return () => clearTimeout(timeoutId);
    }
    
    // Update ref when startedAt becomes truthy
    if (currentStartedAt && prevStartedAt !== currentStartedAt) {
      prevStartedAtRef.current = currentStartedAt;
    }

    if (!currentStartedAt) {
      return;
    }

    const EXPECTED_DURATION_MS = 10 * 60 * 1000; // 10 minutes heuristic

    const checkDuration = () => {
      const now = Date.now();
      const elapsed = now - currentStartedAt;
      const shouldShow = elapsed > EXPECTED_DURATION_MS;
      // Only update if the value actually needs to change
      setHasExceededExpectedDuration((prev) => (shouldShow !== prev ? shouldShow : prev));
    };

    checkDuration();
    const interval = setInterval(checkDuration, 30000);

    return () => clearInterval(interval);
  }, [safeProgress.startedAt]);

  // Handle exit/stop performance
  const handleExit = useCallback(() => {
    // Mark the session as completed and transition everyone to Wrap Party,
    // even if the performance ends earlier than the script length (T192).
    setSessionState('completed');

    const targetSessionCode = storedSessionCode || sessionCode;

    // If director, use endPerformance to broadcast state change to all participants
    // This ensures all participants transition to wrap party
    if (targetSessionCode && participant?.role === 'director') {
      endPerformance(targetSessionCode);
    }

    // Reset local performance progress so subsequent sessions start clean.
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

    if (targetSessionCode) {
      router.push(`/wrap-party/${targetSessionCode}`);
    } else {
      router.push('/');
    }
  }, [participant, storedSessionCode, sessionCode, router, setProgress, setSessionState]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (!isPaused && !safeProgress?.advancementControl?.directorOverride) {
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
  }, [handleAdvance, isPaused, safeProgress.advancementControl.directorOverride]);


  if (!script || scriptLines.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--color-primary)' }}>No script available</p>
      </div>
    );
  }

  const isConnected = connectionStatus === 'connected';
  const canAdvance = isConnected && !isPaused && safeProgress.currentLineIndex < scriptLines.length - 1;
  const isDirector = participant?.role === 'director';
  const hasStarted = safeProgress.startedAt !== null && safeProgress.startedAt !== undefined;
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
                Scene {safeProgress.currentScene + 1} • Line {safeProgress.currentLineIndex + 1} of {scriptLines.length}
              </p>
              {hasExceededExpectedDuration && (
                <p className="mt-1 text-xs opacity-80" style={{ color: 'var(--color-accent)' }}>
                  This performance has run longer than expected. It&apos;s okay to wrap whenever it feels right.
                </p>
              )}
            </div>
            {/* Timing Indicator and connection status */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="hidden sm:block">
                <ConnectionStatusBadge variant="compact" />
              </div>
              <div className="shrink-0 min-w-[200px]">
                <TimingIndicator
                  estimatedDuration={5} // Default 5 seconds per line (can be enhanced with script timing data)
                  isPaused={isPaused}
                />
              </div>
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
          {/* Read-through mode banner (solo director, screen-share) */}
          {participantsCount === 1 && !readThroughBannerDismissed && (
            <div
              className="mt-3 flex items-center justify-between gap-4 rounded-lg px-4 py-2"
              style={{
                backgroundColor: 'var(--color-info)',
                color: 'var(--color-bg)',
                opacity: 0.9,
              }}
              role="status"
            >
              <p className="text-sm font-medium">
                {getSectionTitle('readThroughBanner')}
              </p>
              <button
                type="button"
                onClick={() => setReadThroughBannerDismissed(true)}
                className="shrink-0 rounded px-2 py-1 text-sm font-semibold transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  color: 'var(--color-bg)',
                  backgroundColor: 'transparent',
                  minHeight: '44px',
                  minWidth: '44px',
                }}
                aria-label="Dismiss read-through banner"
              >
                {getButtonLabel('cancel')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sticky Header for Actors */}
      {!isDirector && (
        <div
          className="sticky top-0 z-10 border-b p-4"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-primary)',
          }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {script.title}
              </h1>
              <p className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
                Scene {safeProgress.currentScene + 1} • Line {safeProgress.currentLineIndex + 1} of {scriptLines.length}
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
          {/* Advancement Controls for Actors */}
          <div className="flex items-center justify-center gap-4 pt-2">
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

      {/* Script Display */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto p-8 ${isDirector ? '' : ''}`}
        style={{
          scrollBehavior: visualTokens.animationStyle === 'snappy' ? 'auto' : 'smooth',
        }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {scriptLines.map((line, arrayIndex) => {
            const isCurrent = arrayIndex === safeProgress.currentLineIndex;
            const isCompleted = safeProgress.completedLines.includes(arrayIndex);
            const isUpcoming = upcomingLines.some((l) => l === line);
            const isMyLine =
              line.type === 'dialogue' && line.characterName === participant?.characterAssignment?.name;
            
            // Highlight all of the actor's lines (not just current)
            const shouldHighlightMyLine = isMyLine;

            return (
              <div
                key={line.index}
                data-line-index={arrayIndex}
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
                    className="absolute top-0 left-0 h-1 rounded-t teleprompter-current-line-indicator"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-accent)',
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
