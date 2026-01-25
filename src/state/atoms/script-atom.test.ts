import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { currentScriptAtom } from './script-atom';
import type { Script } from '../types/session';

describe('currentScriptAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(currentScriptAtom, null);
  });

  it('should default to null', () => {
    const value = store.get(currentScriptAtom);
    expect(value).toBeNull();
  });

  it('should persist script to localStorage', async () => {
    const script: Script = {
      id: 'script1',
      sessionId: 'session1',
      vibeContext: 'VIRAL_NEON',
      title: 'Going Viral',
      length: '3 minutes',
      description: 'A group of friends trying to go viral',
      scenes: [
        {
          title: 'The Plan',
          length: '90 seconds',
          description: 'Friends plan their viral video',
          dialogue: [
            { characterName: 'Zayden', content: 'Let\'s do this!' },
          ],
          stageDirections: [],
          soundCues: [],
        },
      ],
      generatedAt: Date.now(),
      version: 1,
    };

    store.set(currentScriptAtom, script);
    
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('current_script');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.title).toBe(script.title);
        resolve();
      }, 100);
    });
  });

  it('should handle script updates correctly', () => {
    const script1: Script = {
      id: 'script1',
      sessionId: 'session1',
      vibeContext: 'VIRAL_NEON',
      title: 'Going Viral',
      length: '3 minutes',
      description: 'A group of friends trying to go viral',
      scenes: [],
      generatedAt: Date.now(),
      version: 1,
    };

    const script2: Script = {
      ...script1,
      id: 'script2',
      title: 'The Story',
      vibeContext: 'INDIE_A24',
      version: 2,
    };

    store.set(currentScriptAtom, script1);
    expect(store.get(currentScriptAtom)?.title).toBe(script1.title);

    store.set(currentScriptAtom, script2);
    expect(store.get(currentScriptAtom)?.title).toBe(script2.title);
  });

  it('should handle null value', () => {
    store.set(currentScriptAtom, null);
    expect(store.get(currentScriptAtom)).toBeNull();
  });
});
