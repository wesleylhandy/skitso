import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { chaosLevelAtom } from './chaos-atom';

describe('chaosLevelAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(chaosLevelAtom, 5);
  });

  it('should default to 5', () => {
    const value = store.get(chaosLevelAtom);
    expect(value).toBe(5);
  });

  it('should persist chaos level to localStorage', async () => {
    store.set(chaosLevelAtom, 7);
    
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('chaos_level');
        expect(stored).toBe('7');
        resolve();
      }, 100);
    });
  });

  it('should handle chaos level updates correctly', () => {
    store.set(chaosLevelAtom, 3);
    expect(store.get(chaosLevelAtom)).toBe(3);

    store.set(chaosLevelAtom, 8);
    expect(store.get(chaosLevelAtom)).toBe(8);

    store.set(chaosLevelAtom, 10);
    expect(store.get(chaosLevelAtom)).toBe(10);
  });

  it('should accept values from 1 to 10', () => {
    for (let i = 1; i <= 10; i++) {
      store.set(chaosLevelAtom, i);
      expect(store.get(chaosLevelAtom)).toBe(i);
    }
  });
});
