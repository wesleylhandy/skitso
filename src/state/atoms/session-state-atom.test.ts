import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { sessionStateAtom } from './session-state-atom';
import type { SessionStatus } from '../types/session';

describe('sessionStateAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(sessionStateAtom, 'idle');
  });

  it('should default to idle', () => {
    const value = store.get(sessionStateAtom);
    expect(value).toBe('idle');
  });

  it('should persist session state to localStorage', async () => {
    const states: SessionStatus[] = ['configuring', 'casting', 'performing', 'completed'];
    
    for (const state of states) {
      store.set(sessionStateAtom, state);
      
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const stored = localStorage.getItem('session_state');
          expect(stored).toBe(`"${state}"`);
          resolve();
        }, 100);
      });
    }
  });

  it('should handle session state transitions correctly', () => {
    const states: SessionStatus[] = ['idle', 'configuring', 'casting', 'performing', 'completed'];
    
    states.forEach((state) => {
      store.set(sessionStateAtom, state);
      expect(store.get(sessionStateAtom)).toBe(state);
    });
  });

  it('should accept all valid session status values', () => {
    const validStates: SessionStatus[] = ['idle', 'configuring', 'casting', 'performing', 'completed', 'expired'];
    
    validStates.forEach((state) => {
      store.set(sessionStateAtom, state);
      expect(store.get(sessionStateAtom)).toBe(state);
    });
  });
});
