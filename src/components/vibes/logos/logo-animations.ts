/**
 * Logo Animation System
 * 
 * Provides CSS animation styles for logo effects:
 * - Glitch effects (for Viral Neon, Brainrot Theater)
 * - Pulsing effects
 * - Scanlines overlay
 */

import type { VibeType } from '@/src/state/types/vibe';

interface LogoAnimations {
  animation?: string;
  animationDuration?: string;
  animationIterationCount?: string;
  filter?: string;
  position?: 'relative';
}

interface AnimationConfig {
  glitch?: boolean;
  pulse?: boolean;
  scanlines?: boolean;
}

export function getLogoAnimations(
  vibe: VibeType,
  config: AnimationConfig
): LogoAnimations | null {
  const animations: string[] = [];
  const styles: LogoAnimations = { position: 'relative' };

  if (config.glitch) {
    animations.push('glitch 0.3s infinite');
  }

  if (config.pulse) {
    animations.push('pulse 2s ease-in-out infinite');
  }

  if (config.scanlines) {
    // Scanlines are handled via CSS pseudo-element
    styles.filter = 'url(#scanlines)';
  }

  if (animations.length > 0) {
    styles.animation = animations.join(', ');
    styles.animationDuration = '2s';
    styles.animationIterationCount = 'infinite';
  }

  return Object.keys(styles).length > 1 ? styles : null;
}

/**
 * CSS keyframes for logo animations
 * These should be added to globals.css
 */
export const logoAnimationKeyframes = `
@keyframes glitch {
  0%, 100% {
    transform: translate(0);
    filter: hue-rotate(0deg);
  }
  20% {
    transform: translate(-2px, 2px);
    filter: hue-rotate(90deg);
  }
  40% {
    transform: translate(-2px, -2px);
    filter: hue-rotate(180deg);
  }
  60% {
    transform: translate(2px, 2px);
    filter: hue-rotate(270deg);
  }
  80% {
    transform: translate(2px, -2px);
    filter: hue-rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

@keyframes scanlines {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 4px;
  }
}
`;
