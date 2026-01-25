/**
 * Tests for useVibe hook
 * 
 * Verifies that useVibe:
 * - Returns current vibe configuration
 * - Provides text registry helpers
 * - Updates when vibe changes
 * - Handles edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { useVibe } from './use-vibe';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import type { VibeType } from '@/src/state/types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

describe('useVibe', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
  });

  it('should return current vibe configuration', () => {
    const { result } = renderHook(() => useVibe());

    expect(result.current.vibe).toBe('VIRAL_NEON');
    expect(result.current.config).toBeDefined();
    expect(result.current.visualTokens).toBeDefined();
    expect(result.current.linguisticTone).toBeDefined();
  });

  it('should return correct button labels for VIRAL_NEON', () => {
    const { result } = renderHook(() => useVibe());

    expect(result.current.getButtonLabel('submit')).toBe('Send It');
    expect(result.current.getButtonLabel('cancel')).toBe('Nah');
    expect(result.current.getButtonLabel('start')).toBe('Let\'s Go');
  });

  it('should return correct button labels for INDIE_A24', async () => {
    await act(async () => {
      store.set(vibeAtom, 'INDIE_A24');
    });
    
    const { result } = renderHook(() => useVibe());

    await waitFor(() => {
      expect(result.current.getButtonLabel('submit')).toBe('Submit');
      expect(result.current.getButtonLabel('cancel')).toBe('Cancel');
    });
  });

  it('should return correct section titles', () => {
    const { result } = renderHook(() => useVibe());

    expect(result.current.getSectionTitle('configuration')).toBe('The Vibe');
    expect(result.current.getSectionTitle('participants')).toBe('The Squad');
  });

  it('should return correct placeholders', () => {
    const { result } = renderHook(() => useVibe());

    expect(result.current.getPlaceholder('theme')).toBe('What\'s the vibe? (10-200 chars)');
    expect(result.current.getPlaceholder('name')).toBe('Your name');
  });

  it('should return correct error messages', () => {
    const { result } = renderHook(() => useVibe());

    expect(result.current.getErrorMessage('required')).toBe('This is required, no cap');
    expect(result.current.getErrorMessage('network')).toBe('Connection failed, try again');
  });

  it('should update when vibe changes', async () => {
    const { result } = renderHook(() => useVibe());

    expect(result.current.vibe).toBe('VIRAL_NEON');

    await act(async () => {
      store.set(vibeAtom, 'INDIE_A24');
    });

    await waitFor(() => {
      expect(result.current.vibe).toBe('INDIE_A24');
      expect(result.current.getButtonLabel('submit')).toBe('Submit');
    });
  });

  it('should return text registry for all vibes', async () => {
    const { result } = renderHook(() => useVibe());

    for (const vibe of ALL_VIBES) {
      await act(async () => {
        store.set(vibeAtom, vibe);
      });

      await waitFor(() => {
        expect(result.current.vibe).toBe(vibe);
        // Verify text registry is available
        expect(result.current.linguisticTone).toBeDefined();
        expect(result.current.linguisticTone.buttonLabels).toBeDefined();
        expect(result.current.linguisticTone.sectionTitles).toBeDefined();
      });
    }
  });

  it('should handle missing text registry keys gracefully', () => {
    const { result } = renderHook(() => useVibe());

    // Test with non-existent keys - should return key or empty string
    const missingButton = result.current.getButtonLabel('nonexistent');
    expect(typeof missingButton).toBe('string');

    const missingPlaceholder = result.current.getPlaceholder('nonexistent');
    expect(typeof missingPlaceholder).toBe('string');
  });

  it('should return different text for different vibes', async () => {
    const { result } = renderHook(() => useVibe());

    // Get text for VIRAL_NEON
    const viralSubmit = result.current.getButtonLabel('submit');
    expect(viralSubmit).toBe('Send It');

    // Switch to INDIE_A24
    await act(async () => {
      store.set(vibeAtom, 'INDIE_A24');
    });

    await waitFor(() => {
      const indieSubmit = result.current.getButtonLabel('submit');
      expect(indieSubmit).toBe('Submit');
      expect(indieSubmit).not.toBe(viralSubmit);
    });
  });

  it('should fall back to DEFAULT_VIBE when vibe is invalid (e.g. corrupted storage)', async () => {
    await act(async () => {
      store.set(vibeAtom, 'INVALID_VIBE' as never);
    });

    const { result } = renderHook(() => useVibe());

    expect(result.current.vibe).toBe('INVALID_VIBE');
    expect(result.current.config).toBeDefined();
    expect(result.current.config.id).toBe('VIRAL_NEON');
    expect(result.current.visualTokens).toBeDefined();
    expect(result.current.getButtonLabel('submit')).toBe('Send It');
  });
});
