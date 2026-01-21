'use client';

/**
 * VibeLogo Component
 * 
 * Displays the SKITSO logo with theme-specific typography styling.
 * Supports optional animations (glitch, pulse, scanlines) based on VibeContext.
 */

import { useMemo } from 'react';
import type { VibeType } from '@/src/state/types/vibe';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';
import { getLogoAnimations } from './logo-animations';

interface VibeLogoProps {
  vibe: VibeType;
  animated?: boolean;
  className?: string;
}

export function VibeLogo({ vibe, animated = false, className = '' }: VibeLogoProps) {
  const config = VIBE_CONFIGS[vibe];
  const animations = useMemo(() => {
    if (!animated || !config.logo.animations) return null;
    return getLogoAnimations(vibe, config.logo.animations);
  }, [vibe, animated, config.logo.animations]);

  return (
    <div
      className={`vibe-logo ${className}`}
      dangerouslySetInnerHTML={{ __html: config.logo.svg }}
      style={animations ? { ...animations } : undefined}
    />
  );
}
