/**
 * Tests for VibeContext configurations
 * 
 * Verifies that all five vibes have complete configurations
 * with all required fields.
 */

import { describe, it, expect } from 'vitest';
import { VIBE_CONFIGS } from './vibe-configs';
import type { VibeType } from '../types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

describe('VIBE_CONFIGS', () => {
  it('should have configurations for all five vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      expect(VIBE_CONFIGS[vibe]).toBeDefined();
      expect(VIBE_CONFIGS[vibe].id).toBe(vibe);
    });
  });

  it('should have complete visual tokens for all vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      const config = VIBE_CONFIGS[vibe];
      expect(config.visualTokens).toBeDefined();
      expect(config.visualTokens.bgColor).toBeDefined();
      expect(config.visualTokens.primaryColor).toBeDefined();
      expect(config.visualTokens.accentColor).toBeDefined();
      expect(config.visualTokens.headerFont).toBeDefined();
      expect(config.visualTokens.bodyFont).toBeDefined();
      expect(config.visualTokens.borderRadius).toBeDefined();
      expect(config.visualTokens.animationStyle).toBeDefined();
      expect(config.visualTokens.cardStyle).toBeDefined();
      expect(config.visualTokens.spacing).toBeDefined();
    });
  });

  it('should have complete linguistic tone for all vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      const config = VIBE_CONFIGS[vibe];
      expect(config.linguisticTone).toBeDefined();
      expect(config.linguisticTone.buttonLabels).toBeDefined();
      expect(config.linguisticTone.placeholders).toBeDefined();
      expect(config.linguisticTone.errorMessages).toBeDefined();
      expect(config.linguisticTone.successMessages).toBeDefined();
      expect(config.linguisticTone.sectionTitles).toBeDefined();
    });
  });

  it('should have complete AI parameters for all vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      const config = VIBE_CONFIGS[vibe];
      expect(config.aiParameters).toBeDefined();
      expect(config.aiParameters.slangRegistry).toBeDefined();
      expect(config.aiParameters.toneGuidelines).toBeDefined();
      expect(config.aiParameters.pacing).toBeDefined();
      expect(config.aiParameters.archetypeLabels).toBeDefined();
    });
  });

  it('should have complete interaction patterns for all vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      const config = VIBE_CONFIGS[vibe];
      expect(config.interactionPatterns).toBeDefined();
      expect(config.interactionPatterns.animationSpeed).toBeDefined();
      expect(config.interactionPatterns.hoverEffects).toBeDefined();
      expect(config.interactionPatterns.clickFeedback).toBeDefined();
      expect(config.interactionPatterns.soundEffects).toBeDefined();
    });
  });

  it('should have logo configuration for all vibes', () => {
    ALL_VIBES.forEach((vibe) => {
      const config = VIBE_CONFIGS[vibe];
      expect(config.logo).toBeDefined();
      expect(config.logo.svg).toBeDefined();
      expect(config.logo.typographyStyle).toBeDefined();
    });
  });

  it('should have slang registry for VIRAL_NEON', () => {
    const config = VIBE_CONFIGS['VIRAL_NEON'];
    expect(config.aiParameters.slangRegistry.length).toBeGreaterThan(0);
  });

  it('should have slang registry for BRAINROT_THEATER', () => {
    const config = VIBE_CONFIGS['BRAINROT_THEATER'];
    expect(config.aiParameters.slangRegistry.length).toBeGreaterThan(0);
  });
});
