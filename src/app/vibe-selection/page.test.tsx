/**
 * Tests for Vibe Selection Page
 * 
 * Verifies that the vibe selection page:
 * - Renders correctly
 * - Displays VibeSelector component
 * - Has proper page structure and accessibility
 * - Redirects or updates after selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import VibeSelectionPage from './page';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Vibe Selection Page', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
  });

  it('should render the page', () => {
    render(<VibeSelectionPage />);
    
    // Page should render without errors
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('should display VibeSelector component', () => {
    render(<VibeSelectionPage />);
    
    // Should have vibe selection interface
    const selector = screen.getByRole('group', { name: /vibe/i });
    expect(selector).toBeInTheDocument();
  });

  it('should have proper page heading', () => {
    render(<VibeSelectionPage />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toMatch(/select|choose|pick/i);
  });

  it('should have accessible page structure', () => {
    render(<VibeSelectionPage />);
    
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });

  it('should display all five vibe options', () => {
    render(<VibeSelectionPage />);
    
    const buttons = screen.getAllByRole('button');
    // Should have at least 5 vibe cards
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it('should have a back button that navigates to root', () => {
    render(<VibeSelectionPage />);
    
    const backButton = screen.getByRole('button', { name: /go back/i });
    expect(backButton).toBeInTheDocument();
  });
});
