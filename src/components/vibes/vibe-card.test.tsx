/**
 * Tests for VibeCard Component
 * 
 * Verifies that VibeCard:
 * - Displays vibe information correctly
 * - Handles click events
 * - Applies correct styling based on vibe
 * - Supports keyboard navigation
 * - Has proper ARIA labels for accessibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VibeCard } from './vibe-card';
import type { VibeType } from '@/src/state/types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

describe('VibeCard', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('should render vibe name', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText(/viral neon/i)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('VIRAL_NEON');
  });

  it('should call onSelect when Enter key is pressed', () => {
    render(
      <VibeCard
        vibe="INDIE_A24"
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('INDIE_A24');
  });

  it('should call onSelect when Space key is pressed', () => {
    render(
      <VibeCard
        vibe="SITCOM_STUDIO"
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('SITCOM_STUDIO');
  });

  it('should have proper ARIA label', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-label');
    expect(card.getAttribute('aria-label')).toContain('Viral Neon');
  });

  it('should be focusable', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    card.focus();
    expect(card).toHaveFocus();
  });

  it('should render for all vibes', () => {
    for (const vibe of ALL_VIBES) {
      const { unmount } = render(
        <VibeCard
          vibe={vibe}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-vibe', vibe);

      unmount();
    }
  });

  it('should apply selected state when isSelected is true', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
        isSelected={true}
      />
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('should apply unselected state when isSelected is false', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
        isSelected={false}
      />
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-pressed', 'false');
  });

  it('should display preview image when provided', () => {
    const previewUrl = '/vibes/viral-neon-preview.jpg';
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
        previewImage={previewUrl}
      />
    );

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    // Next.js Image component transforms the src, so check that it contains the original URL
    const src = image.getAttribute('src') || '';
    expect(src).toContain(encodeURIComponent(previewUrl));
    expect(image).toHaveAttribute('alt');
  });

  it('should not call onSelect for non-interactive keys', () => {
    render(
      <VibeCard
        vibe="VIRAL_NEON"
        onSelect={mockOnSelect}
      />
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Tab', code: 'Tab' });
    fireEvent.keyDown(card, { key: 'Escape', code: 'Escape' });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});
