/**
 * useVibe Hook
 * 
 * Provides easy access to the current VibeContext configuration,
 * including text registry access.
 */

import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';
import { getContrastingTextColor } from '@/src/lib/utils/color-contrast';
import {
  getButtonLabel,
  getPlaceholder,
  getErrorMessage,
  getSuccessMessage,
  getSectionTitle,
} from '@/src/state/config/vibe-text-registry';

const DEFAULT_VIBE = 'VIRAL_NEON' as const;

/**
 * Hook to access current vibe configuration and text registry.
 * Falls back to DEFAULT_VIBE when stored/remote vibe is invalid or missing.
 */
export function useVibe() {
  const currentVibe = useAtomValue(vibeAtom);
  const config = useMemo(
    () => VIBE_CONFIGS[currentVibe] ?? VIBE_CONFIGS[DEFAULT_VIBE],
    [currentVibe]
  );

  // Ensure textColor and semantic colors are always available with fallbacks
  const visualTokens = useMemo(() => {
    const tokens = config.visualTokens;
    // If textColor is not defined, calculate it from bgColor
    const textColor = tokens.textColor || getContrastingTextColor(tokens.bgColor);
    
    return {
      ...tokens,
      textColor,
      // Provide fallbacks for semantic colors
      successColor: tokens.successColor || tokens.primaryColor,
      warningColor: tokens.warningColor || tokens.accentColor || tokens.primaryColor,
      errorColor: tokens.errorColor || '#EF4444', // Fallback to standard red
      infoColor: tokens.infoColor || tokens.accentColor || tokens.primaryColor,
    };
  }, [config]);

  return useMemo(
    () => ({
      vibe: currentVibe,
      config,
      visualTokens,
      linguisticTone: config.linguisticTone,
      aiParameters: config.aiParameters,
      interactionPatterns: config.interactionPatterns,
      logo: config.logo,
      // Text registry helpers (use config.id = effective vibe to avoid invalid lookups)
      getButtonLabel: (buttonType: string) => getButtonLabel(config.id, buttonType),
      getPlaceholder: (fieldType: string) => getPlaceholder(config.id, fieldType),
      getErrorMessage: (errorType: string) => getErrorMessage(config.id, errorType),
      getSuccessMessage: (successType: string) => getSuccessMessage(config.id, successType),
      getSectionTitle: (sectionType: string) => getSectionTitle(config.id, sectionType),
    }),
    [currentVibe, config, visualTokens]
  );
}
