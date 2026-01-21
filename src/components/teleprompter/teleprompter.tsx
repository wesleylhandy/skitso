/**
 * Teleprompter Component
 * 
 * Displays synchronized teleprompter with script lines, character assignments,
 * current line highlighting, and advancement controls. Synchronizes across
 * all devices via Socket.io.
 */

'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { performanceProgressAtom, type PerformanceProgress } from '@/src/state/atoms/performance-atom';
import { AdvanceControl } from './advance-control';
import { flattenScriptLines, getUpcomingLines } from './script-lines';
import {
  initializeSocketClient,
  onPerformanceProgress,
  advancePerformance,
} from '@/src/lib/socket/client';

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
  const { visualTokens } = useVibe();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);
  
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

  // Initialize socket and listen for progress updates
  useEffect(() => {
    initializeSocketClient();
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (!isPaused && !progress.advancementControl.directorOverride) {
          handleAdvance();
        }
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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-primary)' }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
          {script.title}
        </h1>
        <p className="text-sm opacity-75" style={{ color: 'var(--color-accent)' }}>
          Scene {progress.currentScene + 1} • Line {progress.currentLineIndex + 1} of {scriptLines.length}
        </p>
      </div>

      {/* Script Display */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-8"
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

            return (
              <div
                key={line.index}
                ref={isCurrent ? currentLineRef : null}
                className={`p-4 rounded transition-all ${
                  isCurrent
                    ? 'ring-2 scale-105'
                    : isCompleted
                      ? 'opacity-50'
                      : isUpcoming
                        ? 'opacity-75'
                        : 'opacity-30'
                }`}
                style={{
                  backgroundColor: isCurrent ? 'var(--color-primary)' : 'transparent',
                  color: isCurrent ? 'var(--color-bg)' : 'var(--color-primary)',
                  borderColor: isCurrent ? 'var(--color-primary)' : 'transparent',
                  borderWidth: isCurrent ? '2px' : '0',
                  borderStyle: 'solid',
                }}
              >
                {line.type === 'dialogue' && (
                  <div>
                    <div
                      className="font-semibold mb-2"
                      style={{
                        color: isCurrent ? 'var(--color-bg)' : 'var(--color-accent)',
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

      {/* Advancement Controls */}
      <div className="border-t p-4" style={{ borderColor: 'var(--color-primary)' }}>
        <AdvanceControl
          onAdvance={handleAdvance}
          onPause={participant?.role === 'director' ? handlePause : undefined}
          onResume={participant?.role === 'director' ? handleResume : undefined}
          canAdvance={canAdvance}
          isPaused={isPaused}
        />
      </div>
    </div>
  );
}
