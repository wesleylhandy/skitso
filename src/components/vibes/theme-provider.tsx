'use client';

/**
 * ThemeProvider Component
 * 
 * Subscribes to vibeAtom and applies the data-theme attribute to the root element.
 * Switches text registry atomically with theme changes.
 * Handles logo display and animations.
 * 
 * Performance requirement: Theme switching must complete in <100ms
 * (including text and logo changes, per constitution Principle 5)
 */

import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';

const DEFAULT_VIBE = 'VIRAL_NEON' as const;
import { VibeLogo } from './logos/vibe-logo';
import { SessionStateInitializer } from '@/src/components/session/session-state-initializer';

interface ThemeProviderProps {
  children: React.ReactNode;
  showLogo?: boolean;
  logoAnimated?: boolean;
}

export function ThemeProvider({
  children,
  showLogo = false,
  logoAnimated = false,
}: ThemeProviderProps) {
  const currentVibe = useAtomValue(vibeAtom);
  const vibeConfig = useMemo(
    () => VIBE_CONFIGS[currentVibe] ?? VIBE_CONFIGS[DEFAULT_VIBE],
    [currentVibe]
  );

  // Track user reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    // Fallback for older browsers
    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  // Apply data-theme attribute to root element atomically
  useEffect(() => {
    const root = document.documentElement;
    const startTime = performance.now();
    const effectiveVibe = vibeConfig.id;

    // Apply theme attribute
    root.setAttribute('data-theme', effectiveVibe);

    // Apply CSS custom properties for immediate visual update
    const tokens = vibeConfig.visualTokens;
    const interactionPatterns = vibeConfig.interactionPatterns;
    root.style.setProperty('--color-bg', tokens.bgColor);
    root.style.setProperty('--color-primary', tokens.primaryColor);
    root.style.setProperty('--color-accent', tokens.accentColor);
    // Use WCAG-compliant textColor from config
    root.style.setProperty('--color-text', tokens.textColor);
    
    // Semantic colors with fallbacks
    root.style.setProperty('--color-success', tokens.successColor || tokens.primaryColor);
    root.style.setProperty('--color-warning', tokens.warningColor || tokens.accentColor || tokens.primaryColor);
    root.style.setProperty('--color-error', tokens.errorColor || '#EF4444'); // Fallback to standard red
    root.style.setProperty('--color-info', tokens.infoColor || tokens.accentColor || tokens.primaryColor);
    
    // Add neutral color variables for better color balance
    const isLightBg = effectiveVibe === 'QUIET_STUDIO' || effectiveVibe === 'SITCOM_STUDIO';
    root.style.setProperty('--color-muted', isLightBg ? '#6B7280' : '#9CA3AF'); // Gray for labels, helper text
    root.style.setProperty('--color-border', isLightBg ? '#D1D5DB' : '#4B5563'); // Subtle borders
    root.style.setProperty('--color-border-focus', tokens.accentColor); // Accent color for focused inputs
    root.style.setProperty('--color-placeholder', isLightBg ? '#9CA3AF' : '#6B7280'); // Placeholder text
    
    root.style.setProperty('--font-header', tokens.headerFont);
    root.style.setProperty('--font-body', tokens.bodyFont);
    root.style.setProperty('--border-radius', tokens.borderRadius);

    // Reduced motion: lower or disable animation speeds
    const effectiveAnimationSpeed = prefersReducedMotion ? 0 : interactionPatterns.animationSpeed;
    root.style.setProperty('--animation-speed', `${effectiveAnimationSpeed}ms`);
    root.setAttribute('data-reduced-motion', prefersReducedMotion ? 'reduce' : 'no-preference');

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Log performance (only in development)
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.warn(`Theme switch took ${duration.toFixed(2)}ms (target: <100ms)`);
    }

    // Cleanup function (optional, for theme switching)
    return () => {
      // No cleanup needed - next theme will override
    };
  }, [vibeConfig, prefersReducedMotion]);

  return (
    <>
      <SessionStateInitializer />
      {showLogo && (
        <VibeLogo
          vibe={vibeConfig.id}
          animated={logoAnimated}
          className="theme-logo"
        />
      )}
      {children}
    </>
  );
}
