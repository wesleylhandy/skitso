/**
 * Performance Progress Atom
 *
 * Manages the performance progress state (current line, completed lines, etc.)
 * with persistent storage backed by safe browser storage.
 */

import { createPersistentAtom } from '../utils/safe-storage';

export interface PerformanceProgress {
  currentLineIndex: number;
  currentScene: number;
  startedAt: number | null;
  pausedAt: number | null;
  completedLines: number[];
  advancementControl: {
    lastAdvancedBy: string | null;
    lastAdvancedAt: number | null;
    directorOverride: boolean;
  };
}

const defaultProgress: PerformanceProgress = {
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

/**
 * Performance progress atom with persistent storage
 *
 * Key: 'performance_progress'
 * Default: Initial progress state
 */
export const performanceProgressAtom = createPersistentAtom<PerformanceProgress>(
  'performance_progress',
  defaultProgress
);
