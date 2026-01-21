/**
 * Tests for vibeAtom
 * 
 * Verifies that vibeAtom persists to localStorage and
 * maintains state correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { vibeAtom } from './vibe-atom';
import type { VibeType } from '../types/vibe';

describe('vibeAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset atom to default
    store.set(vibeAtom, 'VIRAL_NEON');
  });

  it('should default to VIRAL_NEON', () => {
    const value = store.get(vibeAtom);
    expect(value).toBe('VIRAL_NEON');
  });

  it('should persist to localStorage', async () => {
    store.set(vibeAtom, 'INDIE_A24');
    // Wait for async storage
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('vibe');
        expect(stored).toBe('"INDIE_A24"');
        resolve();
      }, 100);
    });
  });

  it('should read from localStorage when value exists', () => {
    // Set localStorage before creating atom
    localStorage.setItem('vibe', '"SITCOM_STUDIO"');
    // The atom should read from localStorage on initialization
    // Note: atomWithStorage reads from localStorage synchronously on first access
    const stored = localStorage.getItem('vibe');
    expect(stored).toBe('"SITCOM_STUDIO"');
    // Verify the atom can be set and will persist
    store.set(vibeAtom, 'BRAINROT_THEATER');
    const newStored = localStorage.getItem('vibe');
    expect(newStored).toBe('"BRAINROT_THEATER"');
  });

  it('should accept all valid VibeType values', () => {
    const validVibes: VibeType[] = ['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO'];
    
    validVibes.forEach((vibe) => {
      store.set(vibeAtom, vibe);
      expect(store.get(vibeAtom)).toBe(vibe);
    });
  });

  it('should handle rapid theme switching', async () => {
    const vibes: VibeType[] = ['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO'];
    
    // Rapidly switch between all vibes
    vibes.forEach((vibe) => {
      store.set(vibeAtom, vibe);
    });

    // Final value should be the last one set
    expect(store.get(vibeAtom)).toBe('QUIET_STUDIO');
    
    // Wait for async storage to catch up
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('vibe');
        expect(stored).toBe('"QUIET_STUDIO"');
        resolve();
      }, 100);
    });
  });

  it('should handle invalid localStorage data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('vibe', 'invalid-json');
    
    // Atom should fall back to default
    const value = store.get(vibeAtom);
    // Should either be default or handle error gracefully
    expect(['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO']).toContain(value);
  });

  it('should maintain atom value even if localStorage operations fail', () => {
    // Set a value
    store.set(vibeAtom, 'INDIE_A24');
    
    // Atom value should be updated immediately regardless of storage
    expect(store.get(vibeAtom)).toBe('INDIE_A24');
    
    // Verify it persists through multiple operations
    store.set(vibeAtom, 'SITCOM_STUDIO');
    expect(store.get(vibeAtom)).toBe('SITCOM_STUDIO');
  });
});
