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
  updateSessionState,
} from '@/src/lib/partykit/client';
import type { ConnectionStatus } from '@/src/lib/partykit/client';
import { ConnectionStatusBadge } from '@/src/components/ui/connection-status-badge';

interface TeleprompterProps {
  sessionCode: string;
  participantsCount?: number;
}

/** Extra px above/below a line when scrolled into view so the top/bottom are not cut off. */
const SCROLL_LINE_BUFFER = 30;
/** Offset from top of scroll viewport when positioning current line. Smaller = line appears higher. */
const SCROLL_LINE_TOP_OFFSET = 30;

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
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
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

  // Measure header height (varies by viewport: wrap, optional banner, Director vs Actor layout)
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [
    participant?.role,
    participantsCount,
    readThroughBannerDismissed,
    safeProgress?.startedAt,
    hasExceededExpectedDuration,
  ]);

  // Auto-scroll to current line - keep current action below header with buffer.
  // Always use explicit container.scrollTo so we only scroll the container (never the window).
  // scrollIntoView scrolls the window too; lines 1–3 near the top end up under the header.
  const initialScrollRetryRef = useRef(false);

  useEffect(() => {
    const currentIndex = currentLineIndex;

    let scrollBehavior: ScrollBehavior = visualTokens.animationStyle === 'snappy' ? 'auto' : 'smooth';
    try {
      if (typeof window !== 'undefined') {
        const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const reduced = !!(mq?.matches) || document.documentElement.getAttribute('data-reduced-motion') === 'reduce';
        if (reduced) scrollBehavior = 'auto';
      }
    } catch {
      /* use existing */
    }
    const behavior = scrollBehavior === 'smooth' ? 'smooth' : 'auto';

    let retryId: ReturnType<typeof setTimeout> | undefined;

    const scrollToLine = (container: HTMLElement, lineEl: HTMLElement) => {
      if (typeof container.scrollTo !== 'function') return;
      const cr = container.getBoundingClientRect();
      const lr = lineEl.getBoundingClientRect();
      const delta = lr.top - cr.top - SCROLL_LINE_TOP_OFFSET;
      const maxScroll = container.scrollHeight - container.clientHeight;
      const target = Math.max(0, Math.min(maxScroll, container.scrollTop + delta));
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Teleprompter] scrollToLine', {
          currentIndex,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          scrollTop: container.scrollTop,
          maxScroll,
          delta,
          target,
          canScroll: maxScroll > 0,
        });
      }
      container.scrollTo({ top: target, behavior: behavior as ScrollBehavior });
    };

    const runScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (currentIndex === 0) {
        if (typeof container.scrollTo === 'function') {
          if (process.env.NODE_ENV === 'development') {
            const maxScroll = container.scrollHeight - container.clientHeight;
            console.debug('[Teleprompter] scrollTo(0)', {
              scrollHeight: container.scrollHeight,
              clientHeight: container.clientHeight,
              maxScroll,
              canScroll: maxScroll > 0,
            });
          }
          container.scrollTo({ top: 0, behavior: behavior as ScrollBehavior });
        }
        return;
      }

      let lineEl: HTMLElement | null = null;
      if (currentLineRef.current?.getAttribute('data-line-index') === String(currentIndex)) {
        lineEl = currentLineRef.current;
      }
      if (!lineEl) {
        lineEl = container.querySelector(`[data-line-index="${currentIndex}"]`) as HTMLElement | null;
      }

      if (!lineEl) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[Teleprompter] line not found, retry in 50ms', { currentIndex });
        }
        retryId = setTimeout(() => {
          const retry = container.querySelector(`[data-line-index="${currentIndex}"]`) as HTMLElement | null;
          if (retry) scrollToLine(container, retry);
        }, 50);
        return;
      }

      scrollToLine(container, lineEl);
    };

    requestAnimationFrame(() => requestAnimationFrame(runScroll));

    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const needsRetries =
      (currentIndex === 0 && !initialScrollRetryRef.current) || (currentIndex >= 1 && currentIndex <= 3);
    if (currentIndex === 0 && !initialScrollRetryRef.current) {
      initialScrollRetryRef.current = true;
    }
    if (needsRetries) {
      t1 = setTimeout(runScroll, currentIndex === 0 ? 120 : 80);
      t2 = setTimeout(runScroll, currentIndex === 0 ? 320 : 200);
    }

    return () => {
      if (retryId) clearTimeout(retryId);
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [currentLineIndex, visualTokens.animationStyle, headerHeight]);

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

  // Handle go back to casting couch
  const handleGoBack = useCallback(() => {
    if (!sessionCode || participant?.role !== 'director') return;
    // Reset performance progress to first line
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
    // Update session state to 'casting' - this will redirect all participants back to casting couch
    setSessionState('casting');
    updateSessionState(sessionCode, 'casting');
    // Redirect director to director-desk where casting couch will be shown
    router.push('/director-desk');
  }, [sessionCode, participant, router, setSessionState, setProgress]);

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
    <div className="flex-1 min-h-0 flex flex-col" style={{ backgroundColor: visualTokens.bgColor }}>
      {/* Fixed Header with Controls (Director only) */}
      {isDirector && (
        <div
          ref={headerRef}
          className="sticky top-0 z-10 border-b p-3 sm:p-4"
          style={{
            backgroundColor: visualTokens.bgColor,
            borderColor: visualTokens.primaryColor,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate" style={{ color: visualTokens.primaryColor }}>
                {script.title}
              </h1>
              <p className="text-xs sm:text-sm opacity-75" style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}>
                Scene {safeProgress.currentScene + 1} • Line {safeProgress.currentLineIndex + 1} of {scriptLines.length}
              </p>
              {hasExceededExpectedDuration && (
                <p className="mt-1 text-xs opacity-80" style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}>
                  This performance has run longer than expected. It&apos;s okay to wrap whenever it feels right.
                </p>
              )}
            </div>
            {/* Timing Indicator and connection status */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="hidden sm:block">
                <ConnectionStatusBadge variant="compact" />
              </div>
              <div className="shrink-0 min-w-[120px] sm:min-w-[200px]">
                <TimingIndicator
                  estimatedDuration={5} // Default 5 seconds per line (can be enhanced with script timing data)
                  isPaused={isPaused}
                />
              </div>
            </div>
          </div>
          {/* Control Buttons - Responsive layout */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-2">
            {!hasStarted ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStart();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStart();
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: visualTokens.primaryColor,
                  color: visualTokens.bgColor,
                  borderRadius: visualTokens.borderRadius,
                  fontFamily: visualTokens.headerFont,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  minWidth: '44px',
                  minHeight: '44px',
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
                    className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: visualTokens.primaryColor,
                      color: visualTokens.bgColor,
                      borderRadius: visualTokens.borderRadius,
                      fontFamily: visualTokens.headerFont,
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      minWidth: '44px',
                      minHeight: '44px',
                    }}
                    aria-label={getButtonLabel('resume') || 'Resume'}
                  >
                    {getButtonLabel('resume') || 'Resume'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePause();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePause();
                    }}
                    className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: visualTokens.accentColor || visualTokens.primaryColor,
                      color: visualTokens.bgColor,
                      borderRadius: visualTokens.borderRadius,
                      fontFamily: visualTokens.headerFont,
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                      minWidth: '44px',
                      minHeight: '44px',
                    }}
                    aria-label={getButtonLabel('pause') || 'Pause'}
                  >
                    {getButtonLabel('pause') || 'Pause'}
                  </button>
                )}
                <button
                  onClick={handleAdvance}
                  disabled={!canAdvance}
                  className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: visualTokens.primaryColor,
                    color: visualTokens.bgColor,
                    borderRadius: visualTokens.borderRadius,
                    fontFamily: visualTokens.headerFont,
                    cursor: canAdvance ? 'pointer' : 'not-allowed',
                    touchAction: 'manipulation',
                    minWidth: '44px',
                    minHeight: '44px',
                  }}
                  aria-label={getButtonLabel('advance') || 'Advance'}
                >
                  {getButtonLabel('advance') || 'Advance'}
                </button>
              </>
            )}
            {/* Go Back Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleGoBack();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleGoBack();
              }}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                color: visualTokens.primaryColor,
                border: `2px solid ${visualTokens.primaryColor}`,
                borderRadius: visualTokens.borderRadius,
                fontFamily: visualTokens.headerFont,
                cursor: 'pointer',
                touchAction: 'manipulation',
                minWidth: '44px',
                minHeight: '44px',
              }}
              aria-label={getButtonLabel('goBack') || 'Go Back to Casting'}
            >
              {getButtonLabel('goBack') || 'Go Back'}
            </button>
            {/* End Scene Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowExitConfirm(true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowExitConfirm(true);
              }}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: visualTokens.errorColor,
                color: visualTokens.bgColor,
                borderRadius: visualTokens.borderRadius,
                fontFamily: visualTokens.headerFont,
                cursor: 'pointer',
                touchAction: 'manipulation',
                minWidth: '44px',
                minHeight: '44px',
              }}
              aria-label={getButtonLabel('endScene') || 'End Scene'}
            >
              {getButtonLabel('endScene') || 'End Scene'}
            </button>
          </div>
          {/* Read-through mode banner (solo director, screen-share) */}
          {participantsCount === 1 && !readThroughBannerDismissed && (
            <div
              className="mt-3 flex items-center justify-between gap-4 rounded-lg px-4 py-2"
              style={{
                backgroundColor: visualTokens.infoColor || visualTokens.accentColor || visualTokens.primaryColor,
                color: visualTokens.bgColor,
                opacity: 0.9,
              }}
              role="status"
            >
              <p className="text-sm font-medium">
                {getSectionTitle('readThroughBanner')}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReadThroughBannerDismissed(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setReadThroughBannerDismissed(true);
                }}
                className="shrink-0 rounded px-2 py-1 text-sm font-semibold transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  color: 'var(--color-bg)',
                  backgroundColor: 'transparent',
                  minHeight: '44px',
                  minWidth: '44px',
                  touchAction: 'manipulation',
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
          ref={headerRef}
          className="sticky top-0 z-10 border-b p-3 sm:p-4"
          style={{
            backgroundColor: visualTokens.bgColor,
            borderColor: visualTokens.primaryColor,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate" style={{ color: visualTokens.primaryColor }}>
                {script.title}
              </h1>
              <p className="text-xs sm:text-sm opacity-75" style={{ color: visualTokens.accentColor || visualTokens.primaryColor }}>
                Scene {safeProgress.currentScene + 1} • Line {safeProgress.currentLineIndex + 1} of {scriptLines.length}
              </p>
            </div>
            {/* Timing Indicator */}
            <div className="shrink-0 min-w-[120px] sm:min-w-[200px]">
              <TimingIndicator 
                estimatedDuration={5}
                isPaused={isPaused}
              />
            </div>
          </div>
          {/* Advancement Controls for Actors */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 pt-2">
            <AdvanceControl
              onAdvance={handleAdvance}
              onPause={undefined}
              onResume={undefined}
              canAdvance={canAdvance}
              isPaused={isPaused}
            />
            {/* Exit Button for Actors */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowExitConfirm(true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowExitConfirm(true);
              }}
              className="px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: visualTokens.errorColor,
                color: visualTokens.bgColor,
                borderRadius: visualTokens.borderRadius,
                fontFamily: visualTokens.headerFont,
                cursor: 'pointer',
                touchAction: 'manipulation',
                minWidth: '44px',
                minHeight: '44px',
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
        className={`flex-1 min-h-0 overflow-y-auto px-8 pb-8 ${isDirector ? '' : ''}`}
        style={{
          scrollBehavior: visualTokens.animationStyle === 'snappy' ? 'auto' : 'smooth',
          paddingTop: (headerHeight > 0 ? headerHeight : 32) + SCROLL_LINE_BUFFER,
          scrollPaddingTop: (headerHeight > 0 ? headerHeight : 32) + SCROLL_LINE_BUFFER,
          scrollPaddingBottom: SCROLL_LINE_BUFFER,
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
                  ...(isCurrent && {
                    scrollMarginTop: (headerHeight > 0 ? headerHeight : 32) + SCROLL_LINE_BUFFER,
                    scrollMarginBottom: SCROLL_LINE_BUFFER,
                  }),
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
        title={getSectionTitle('endSceneConfirm') || 'End Scene?'}
        message={getSectionTitle('endSceneConfirmMessage') || 'This will end the performance and move everyone to the wrap party.'}
        confirmLabel={getButtonLabel('endScene') || 'End Scene'}
        cancelLabel={getButtonLabel('cancel') || 'Cancel'}
        variant="danger"
      />
    </div>
  );
}
