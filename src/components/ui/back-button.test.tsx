/**
 * Tests for BackButton Component
 * 
 * Verifies that the back button:
 * - Renders correctly with vibe-themed styling
 * - Navigates to the correct route
 * - Uses the correct button label from vibe config
 * - Has proper accessibility attributes
 * - Handles keyboard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { BackButton } from './back-button';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('BackButton', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  it('should render with back button label from vibe config', () => {
    render(<BackButton to="/" />);
    
    const button = screen.getByRole('button', { name: /back|nah/i });
    expect(button).toBeInTheDocument();
  });

  it('should navigate to the specified route when clicked', () => {
    render(<BackButton to="/vibe-selection" />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockPush).toHaveBeenCalledWith('/vibe-selection');
  });

  it('should have proper accessibility attributes', () => {
    render(<BackButton to="/" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
    expect(button.getAttribute('aria-label')).toContain('Go back');
  });

  it('should support keyboard navigation with Enter', () => {
    render(<BackButton to="/" />);
    
    const button = screen.getByRole('button');
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('should support keyboard navigation with Space', () => {
    render(<BackButton to="/" />);
    
    const button = screen.getByRole('button');
    button.focus();
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('should apply vibe-themed styling', () => {
    store.set(vibeAtom, 'VIRAL_NEON');
    render(<BackButton to="/" />);
    
    const button = screen.getByRole('button');
    
    // Should have some styling applied (exact styles depend on vibe)
    expect(button).toBeInTheDocument();
    expect(button).toHaveStyle({ cursor: 'pointer' });
  });

  it('should use different button labels for different vibes', () => {
    act(() => {
      store.set(vibeAtom, 'BRAINROT_THEATER');
    });
    const { rerender } = render(<BackButton to="/" />);
    
    const button1 = screen.getByRole('button');
    const label1 = button1.textContent;
    
    act(() => {
      store.set(vibeAtom, 'QUIET_STUDIO');
    });
    rerender(<BackButton to="/" />);
    
    const button2 = screen.getByRole('button');
    const label2 = button2.textContent;
    
    // Labels should be different for different vibes
    expect(label1).not.toBe(label2);
  });

  it('should use custom label when provided', () => {
    render(<BackButton to="/" label="Custom Back" />);
    
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Custom Back');
  });

  it('should have minimum touch target size for accessibility', () => {
    render(<BackButton to="/" />);
    
    const button = screen.getByRole('button');
    const styles = window.getComputedStyle(button);
    
    // WCAG requires minimum 44x44px touch targets
    expect(parseInt(styles.minHeight || '0')).toBeGreaterThanOrEqual(44);
    expect(parseInt(styles.minWidth || '0')).toBeGreaterThanOrEqual(44);
  });
});
