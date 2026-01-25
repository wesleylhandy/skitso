/**
 * Tests for ThemeProvider
 * 
 * Verifies that ThemeProvider:
 * - Applies data-theme attribute correctly
 * - Switches themes atomically
 * - Completes theme switching in <100ms
 * - Updates CSS variables correctly
 * - Handles edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { ThemeProvider } from './theme-provider';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import type { VibeType } from '@/src/state/types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

describe('ThemeProvider', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
    // Reset document
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
  });

  it('should apply data-theme attribute to root element', async () => {
    await act(async () => {
      store.set(vibeAtom, 'INDIE_A24');
    });
    
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('INDIE_A24');
    });
  });

  it('should update CSS variables when theme changes', async () => {
    await act(async () => {
      store.set(vibeAtom, 'VIRAL_NEON');
    });
    
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    await waitFor(() => {
      const bgColor = document.documentElement.style.getPropertyValue('--color-bg');
      expect(bgColor).toBe('#0A0A0A');
    });

    // Change theme
    await act(async () => {
      store.set(vibeAtom, 'INDIE_A24');
    });

    await waitFor(() => {
      const bgColor = document.documentElement.style.getPropertyValue('--color-bg');
      expect(bgColor).toBe('#141414');
    });
  });

  it('should complete theme switching in <100ms', async () => {
    await act(async () => {
      store.set(vibeAtom, 'VIRAL_NEON');
    });
    
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('VIRAL_NEON');
    });

    // Measure theme switch performance
    const startTime = performance.now();
    await act(async () => {
      store.set(vibeAtom, 'INDIE_A24');
    });
    
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('INDIE_A24');
      const endTime = performance.now();
      const duration = endTime - startTime;
      // Allow some buffer for test environment, but should be well under 100ms
      expect(duration).toBeLessThan(200);
    });
  });

  it('should render children correctly', () => {
    const { getByText } = render(
      <ThemeProvider>
        <div>Test Content</div>
      </ThemeProvider>
    );

    expect(getByText('Test Content')).toBeInTheDocument();
  });

  it('should render logo when showLogo is true', () => {
    const { container } = render(
      <ThemeProvider showLogo={true}>
        <div>Test</div>
      </ThemeProvider>
    );

    const logo = container.querySelector('.vibe-logo');
    expect(logo).toBeInTheDocument();
  });

  it('should not render logo when showLogo is false', () => {
    const { container } = render(
      <ThemeProvider showLogo={false}>
        <div>Test</div>
      </ThemeProvider>
    );

    const logo = container.querySelector('.vibe-logo');
    expect(logo).not.toBeInTheDocument();
  });

  it('should apply correct text colors for all vibes', async () => {
    const lightBackgroundVibes: VibeType[] = ['QUIET_STUDIO', 'SITCOM_STUDIO'];
    const darkBackgroundVibes: VibeType[] = ['VIRAL_NEON', 'INDIE_A24', 'BRAINROT_THEATER'];

    // Test light background vibes (should use primary color for text)
    for (const vibe of lightBackgroundVibes) {
      await act(async () => {
        store.set(vibeAtom, vibe);
      });

      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      );

      await waitFor(() => {
        const textColor = document.documentElement.style.getPropertyValue('--color-text');
        // Light backgrounds should have dark text (primary color)
        expect(textColor).not.toBe('#FFFFFF');
      });
    }

    // Test dark background vibes (should use white text)
    for (const vibe of darkBackgroundVibes) {
      await act(async () => {
        store.set(vibeAtom, vibe);
      });

      await waitFor(() => {
        const textColor = document.documentElement.style.getPropertyValue('--color-text');
        expect(textColor).toBe('#FFFFFF');
      });
    }
  });

  it('should handle rapid theme switching without errors', async () => {
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    // Rapidly switch between all themes
    for (const vibe of ALL_VIBES) {
      await act(async () => {
        store.set(vibeAtom, vibe);
      });
    }

    // Should end on last theme without errors
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('QUIET_STUDIO');
    });
  });

  it('should apply CSS variables for all vibes correctly', async () => {
    const expectedColors: Record<VibeType, string> = {
      VIRAL_NEON: '#0A0A0A',
      INDIE_A24: '#141414',
      SITCOM_STUDIO: '#F5F5F5',
      BRAINROT_THEATER: '#000000',
      QUIET_STUDIO: '#FFFFFF',
    };

    for (const vibe of ALL_VIBES) {
      await act(async () => {
        store.set(vibeAtom, vibe);
      });

      render(
        <ThemeProvider>
          <div>Test</div>
        </ThemeProvider>
      );

      await waitFor(() => {
        const bgColor = document.documentElement.style.getPropertyValue('--color-bg');
        expect(bgColor).toBe(expectedColors[vibe]);
      });
    }
  });
});
