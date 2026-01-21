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

import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';
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
    () => VIBE_CONFIGS[currentVibe],
    [currentVibe]
  );

  // Apply data-theme attribute to root element atomically
  useEffect(() => {
    const root = document.documentElement;
    const startTime = performance.now();

    // Apply theme attribute
    root.setAttribute('data-theme', currentVibe);

    // Apply CSS custom properties for immediate visual update
    const tokens = vibeConfig.visualTokens;
    const interactionPatterns = vibeConfig.interactionPatterns;
    root.style.setProperty('--color-bg', tokens.bgColor);
    root.style.setProperty('--color-primary', tokens.primaryColor);
    root.style.setProperty('--color-accent', tokens.accentColor);
    // Use WCAG-compliant textColor from config
    root.style.setProperty('--color-text', tokens.textColor);
    
    // Add neutral color variables for better color balance
    const isLightBg = currentVibe === 'QUIET_STUDIO' || currentVibe === 'SITCOM_STUDIO';
    root.style.setProperty('--color-muted', isLightBg ? '#6B7280' : '#9CA3AF'); // Gray for labels, helper text
    root.style.setProperty('--color-border', isLightBg ? '#D1D5DB' : '#4B5563'); // Subtle borders
    root.style.setProperty('--color-border-focus', tokens.accentColor); // Accent color for focused inputs
    root.style.setProperty('--color-placeholder', isLightBg ? '#9CA3AF' : '#6B7280'); // Placeholder text
    
    root.style.setProperty('--font-header', tokens.headerFont);
    root.style.setProperty('--font-body', tokens.bodyFont);
    root.style.setProperty('--border-radius', tokens.borderRadius);
    root.style.setProperty('--animation-speed', `${interactionPatterns.animationSpeed}ms`);

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
  }, [currentVibe, vibeConfig]);

  return (
    <>
      <SessionStateInitializer />
      {showLogo && (
        <VibeLogo
          vibe={currentVibe}
          animated={logoAnimated}
          className="theme-logo"
        />
      )}
      {children}
    </>
  );
}
