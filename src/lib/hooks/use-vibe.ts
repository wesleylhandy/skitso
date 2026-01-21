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

/**
 * Hook to access current vibe configuration and text registry
 */
export function useVibe() {
  const currentVibe = useAtomValue(vibeAtom);
  const config = useMemo(
    () => VIBE_CONFIGS[currentVibe],
    [currentVibe]
  );

  // Ensure textColor is always available and WCAG-compliant
  const visualTokens = useMemo(() => {
    const tokens = config.visualTokens;
    // If textColor is not defined, calculate it from bgColor
    if (!tokens.textColor) {
      return {
        ...tokens,
        textColor: getContrastingTextColor(tokens.bgColor),
      };
    }
    return tokens;
  }, [config.visualTokens]);

  return useMemo(
    () => ({
      vibe: currentVibe,
      config,
      visualTokens,
      linguisticTone: config.linguisticTone,
      aiParameters: config.aiParameters,
      interactionPatterns: config.interactionPatterns,
      logo: config.logo,
      // Text registry helpers
      getButtonLabel: (buttonType: string) => getButtonLabel(currentVibe, buttonType),
      getPlaceholder: (fieldType: string) => getPlaceholder(currentVibe, fieldType),
      getErrorMessage: (errorType: string) => getErrorMessage(currentVibe, errorType),
      getSuccessMessage: (successType: string) => getSuccessMessage(currentVibe, successType),
      getSectionTitle: (sectionType: string) => getSectionTitle(currentVibe, sectionType),
    }),
    [currentVibe, config, visualTokens]
  );
}
