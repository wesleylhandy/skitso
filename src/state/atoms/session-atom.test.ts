import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { sessionCodeAtom } from './session-atom';

describe('sessionCodeAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(sessionCodeAtom, null);
  });

  it('should default to null', () => {
    const value = store.get(sessionCodeAtom);
    expect(value).toBeNull();
  });

  it('should persist session code to localStorage', async () => {
    const code = 'ABC12345';
    store.set(sessionCodeAtom, code);
    
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('session_code');
        expect(stored).toBe(`"${code}"`);
        resolve();
      }, 100);
    });
  });

  it('should handle session code updates correctly', () => {
    const code1 = 'ABC12345';
    const code2 = 'XYZ98765';
    
    store.set(sessionCodeAtom, code1);
    expect(store.get(sessionCodeAtom)).toBe(code1);
    
    store.set(sessionCodeAtom, code2);
    expect(store.get(sessionCodeAtom)).toBe(code2);
  });

  it('should handle null value', () => {
    store.set(sessionCodeAtom, null);
    expect(store.get(sessionCodeAtom)).toBeNull();
  });
});
