/**
 * Tests for Director's Desk Page
 * 
 * T071a: Test theme-specific layout patterns display correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import DirectorDeskPage from './page';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock child components
vi.mock('@/src/components/director/director-config-form', () => ({
  DirectorConfigForm: () => <div data-testid="director-config-form">Director Config Form</div>,
}));

vi.mock('@/src/components/director/session-share', () => ({
  SessionShare: () => <div data-testid="session-share">Session Share</div>,
}));

describe("Director's Desk Page - T071a: Theme-Specific Layout", () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
  });

  it('should render the page with main heading', () => {
    render(<DirectorDeskPage />);
    
    const heading = screen.getByRole('heading', { level: 1, name: /director's desk/i });
    expect(heading).toBeInTheDocument();
  });

  it('should render DirectorConfigForm component', () => {
    render(<DirectorDeskPage />);
    
    const form = screen.getByTestId('director-config-form');
    expect(form).toBeInTheDocument();
  });

  it('should render SessionShare component', () => {
    render(<DirectorDeskPage />);
    
    const share = screen.getByTestId('session-share');
    expect(share).toBeInTheDocument();
  });

  it('should apply theme-specific background color', () => {
    const { container } = render(<DirectorDeskPage />);
    
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveStyle({ backgroundColor: 'var(--color-bg)' });
  });

  it('should use theme-specific header font', () => {
    const { container } = render(<DirectorDeskPage />);
    
    const heading = container.querySelector('h1');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveStyle({ fontFamily: 'var(--font-header)' });
  });

  it('should have a back button that navigates to vibe-selection', () => {
    render(<DirectorDeskPage />);
    
    const backButton = screen.getByRole('button', { name: /go back/i });
    expect(backButton).toBeInTheDocument();
  });
});
