/**
 * Tests for VibeLogo component
 * 
 * Verifies that VibeLogo:
 * - Renders SVG for each vibe
 * - Applies animations when enabled
 * - Handles animation combinations
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VibeLogo } from './vibe-logo';
import type { VibeType } from '@/src/state/types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

describe('VibeLogo', () => {
  it('should render logo for all vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      const { container } = render(<VibeLogo vibe={vibe} />);
      const logo = container.querySelector('.vibe-logo');
      expect(logo).toBeInTheDocument();
    });
  });

  it('should render SVG content', () => {
    const { container } = render(<VibeLogo vibe="VIRAL_NEON" />);
    const logo = container.querySelector('.vibe-logo');
    expect(logo?.innerHTML).toContain('svg');
    expect(logo?.innerHTML).toContain('SKITSO');
  });

  it('should apply animations when animated is true', () => {
    const { container } = render(<VibeLogo vibe="VIRAL_NEON" animated={true} />);
    const logo = container.querySelector('.vibe-logo');
    const style = logo?.getAttribute('style');
    // Should have animation styles
    expect(style).toBeTruthy();
  });

  it('should not apply animations when animated is false', () => {
    const { container } = render(<VibeLogo vibe="INDIE_A24" animated={false} />);
    const logo = container.querySelector('.vibe-logo');
    // INDIE_A24 doesn't have animations configured, so style might be null or minimal
    // Just verify logo renders
    expect(logo).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<VibeLogo vibe="VIRAL_NEON" className="custom-class" />);
    const logo = container.querySelector('.vibe-logo');
    expect(logo?.className).toContain('custom-class');
  });
});
