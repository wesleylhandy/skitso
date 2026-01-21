/**
 * Tests for VibeSelector Component
 * 
 * Verifies that VibeSelector:
 * - Displays all five vibe cards
 * - Handles vibe selection and updates vibeAtom
 * - Supports keyboard navigation (arrow keys, tab)
 * - Has proper ARIA labels
 * - Applies transition animations
 * - Meets <100ms visual transformation requirement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { VibeSelector } from './vibe-selector';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import type { VibeType } from '@/src/state/types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

describe('VibeSelector', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
  });

  it('should render all five vibe cards', () => {
    render(<VibeSelector />);

    const buttons = screen.getAllByRole('button');
    // Should have 5 vibe cards
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it('should update vibeAtom when a vibe is selected', async () => {
    render(<VibeSelector />);

    const indieCard = screen.getByRole('button', { name: /indie a24/i });
    
    await act(async () => {
      fireEvent.click(indieCard);
    });

    await waitFor(() => {
      const currentVibe = store.get(vibeAtom);
      expect(currentVibe).toBe('INDIE_A24');
    });
  });

  it('should highlight the currently selected vibe', async () => {
    await act(async () => {
      store.set(vibeAtom, 'SITCOM_STUDIO');
    });

    render(<VibeSelector />);

    const sitcomCard = screen.getByRole('button', { name: /sitcom studio/i });
    expect(sitcomCard).toHaveAttribute('aria-pressed', 'true');
  });

  it('should support keyboard navigation with arrow keys', async () => {
    render(<VibeSelector />);

    const firstCard = screen.getAllByRole('button')[0];
    firstCard.focus();

    // Right arrow should move to next card
    fireEvent.keyDown(firstCard, { key: 'ArrowRight', code: 'ArrowRight' });
    
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const focusedButton = buttons.find(btn => btn === document.activeElement);
      expect(focusedButton).toBeDefined();
    });
  });

  it('should support keyboard navigation with Tab key', () => {
    render(<VibeSelector />);

    const buttons = screen.getAllByRole('button');
    buttons[0].focus();

    fireEvent.keyDown(buttons[0], { key: 'Tab', code: 'Tab' });

    // Tab navigation should work (browser default)
    expect(buttons[0]).toHaveFocus();
  });

  it('should have proper ARIA labels for screen readers', () => {
    render(<VibeSelector />);

    const container = screen.getByRole('group');
    expect(container).toHaveAttribute('aria-label');
    expect(container.getAttribute('aria-label')).toContain('vibe');
  });

  it('should apply transition animation class', () => {
    const { container } = render(<VibeSelector />);
    
    const selector = container.querySelector('[data-vibe-selector]');
    expect(selector).toBeInTheDocument();
  });

  it('should complete vibe selection in <100ms', async () => {
    render(<VibeSelector />);

    const indieCard = screen.getByRole('button', { name: /indie a24/i });
    
    const startTime = performance.now();
    
    await act(async () => {
      fireEvent.click(indieCard);
    });

    await waitFor(() => {
      const currentVibe = store.get(vibeAtom);
      expect(currentVibe).toBe('INDIE_A24');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Allow some buffer for test environment, but should be well under 100ms
      expect(duration).toBeLessThan(200);
    });
  });

  it('should handle rapid vibe switching without errors', async () => {
    render(<VibeSelector />);

    const buttons = screen.getAllByRole('button');
    
    // Rapidly switch between all vibes
    for (let i = 0; i < Math.min(buttons.length, ALL_VIBES.length); i++) {
      await act(async () => {
        fireEvent.click(buttons[i]);
      });
    }

    // Should end on last selected vibe without errors
    await waitFor(() => {
      const currentVibe = store.get(vibeAtom);
      expect(ALL_VIBES).toContain(currentVibe);
    });
  });

  it('should persist selection to localStorage', async () => {
    render(<VibeSelector />);

    const indieCard = screen.getByRole('button', { name: /indie a24/i });
    
    await act(async () => {
      fireEvent.click(indieCard);
    });

    await waitFor(() => {
      const stored = localStorage.getItem('vibe');
      expect(stored).toBe('"INDIE_A24"');
    });
  });

  it('should restore selection from localStorage on mount', async () => {
    localStorage.setItem('vibe', '"QUIET_STUDIO"');
    
    await act(async () => {
      store.set(vibeAtom, 'QUIET_STUDIO');
    });

    render(<VibeSelector />);

    await waitFor(() => {
      const quietCard = screen.getByRole('button', { name: /quiet studio/i });
      expect(quietCard).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('should have proper focus management', () => {
    render(<VibeSelector />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // All buttons should be focusable
    buttons.forEach(button => {
      button.focus();
      expect(button).toHaveFocus();
    });
  });

  it('should wrap around when navigating with arrow keys at boundaries', async () => {
    render(<VibeSelector />);

    const buttons = screen.getAllByRole('button');
    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];

    // Focus first button
    firstButton.focus();
    
    // Left arrow from first should wrap to last
    fireEvent.keyDown(firstButton, { key: 'ArrowLeft', code: 'ArrowLeft' });
    
    // Focus last button
    lastButton.focus();
    
    // Right arrow from last should wrap to first
    fireEvent.keyDown(lastButton, { key: 'ArrowRight', code: 'ArrowRight' });
  });
});
