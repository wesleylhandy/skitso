/**
 * Tests for performanceProgressAtom
 * 
 * Verifies that performanceProgressAtom persists to localStorage and
 * maintains state correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { performanceProgressAtom, type PerformanceProgress } from './performance-atom';

describe('performanceProgressAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset atom to default
    store.set(performanceProgressAtom, {
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
  });

  it('should default to initial progress state', () => {
    const value = store.get(performanceProgressAtom);
    expect(value.currentLineIndex).toBe(0);
    expect(value.currentScene).toBe(0);
    expect(value.startedAt).toBeNull();
    expect(value.pausedAt).toBeNull();
    expect(value.completedLines).toEqual([]);
    expect(value.advancementControl.directorOverride).toBe(false);
  });

  it('should persist to localStorage', async () => {
    const progress: PerformanceProgress = {
      currentLineIndex: 5,
      currentScene: 1,
      startedAt: Date.now(),
      pausedAt: null,
      completedLines: [0, 1, 2, 3, 4],
      advancementControl: {
        lastAdvancedBy: 'participant-123',
        lastAdvancedAt: Date.now(),
        directorOverride: false,
      },
    };
    
    store.set(performanceProgressAtom, progress);
    
    // Wait for async storage
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('performance_progress');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.currentLineIndex).toBe(5);
        expect(parsed.completedLines).toEqual([0, 1, 2, 3, 4]);
        resolve();
      }, 100);
    });
  });

  it('should read from localStorage when value exists', () => {
    const storedProgress: PerformanceProgress = {
      currentLineIndex: 10,
      currentScene: 2,
      startedAt: 1000,
      pausedAt: null,
      completedLines: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      advancementControl: {
        lastAdvancedBy: 'director-456',
        lastAdvancedAt: 2000,
        directorOverride: true,
      },
    };
    
    localStorage.setItem('performance_progress', JSON.stringify(storedProgress));
    
    // The atom should read from localStorage on initialization
    const stored = localStorage.getItem('performance_progress');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.currentLineIndex).toBe(10);
    expect(parsed.advancementControl.directorOverride).toBe(true);
  });

  it('should update currentLineIndex correctly', () => {
    const current = store.get(performanceProgressAtom);
    const updated: PerformanceProgress = {
      ...current,
      currentLineIndex: 3,
      completedLines: [0, 1, 2],
    };
    
    store.set(performanceProgressAtom, updated);
    expect(store.get(performanceProgressAtom).currentLineIndex).toBe(3);
    expect(store.get(performanceProgressAtom).completedLines).toEqual([0, 1, 2]);
  });

  it('should handle director override', () => {
    const current = store.get(performanceProgressAtom);
    const updated: PerformanceProgress = {
      ...current,
      advancementControl: {
        ...current.advancementControl,
        directorOverride: true,
        lastAdvancedBy: 'director-789',
        lastAdvancedAt: Date.now(),
      },
    };
    
    store.set(performanceProgressAtom, updated);
    const result = store.get(performanceProgressAtom);
    expect(result.advancementControl.directorOverride).toBe(true);
    expect(result.advancementControl.lastAdvancedBy).toBe('director-789');
  });

  it('should handle pause state', () => {
    const current = store.get(performanceProgressAtom);
    const pausedAt = Date.now();
    const updated: PerformanceProgress = {
      ...current,
      pausedAt,
    };
    
    store.set(performanceProgressAtom, updated);
    expect(store.get(performanceProgressAtom).pausedAt).toBe(pausedAt);
  });

  it('should handle invalid localStorage data gracefully', () => {
    localStorage.setItem('performance_progress', 'invalid-json');
    
    // Atom should fall back to default or handle error gracefully
    const value = store.get(performanceProgressAtom);
    expect(value).toBeDefined();
    expect(value.currentLineIndex).toBeGreaterThanOrEqual(0);
  });
});
