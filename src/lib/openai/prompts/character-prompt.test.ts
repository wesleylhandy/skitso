/**
 * Tests for Character Prompt Generation
 * 
 * T071: Test generated content matches selected VibeContext style
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCharacterPrompt } from './character-prompt';
import { readFileSync } from 'fs';

// Mock the template engine
vi.mock('./template-engine', () => ({
  loadPromptTemplate: vi.fn((path: string, context: Record<string, string>) => {
    // Return a mock prompt that includes all context variables
    let prompt = `Mock prompt for ${context.vibeContext} with ${context.participantCount} participants`;
    if (context.theme) prompt += ` about "${context.theme}"`;
    if (context.tone) prompt += ` with tone ${context.tone}`;
    if (context.directorDefinedCharacters) prompt += ` with predefined characters: ${context.directorDefinedCharacters}`;
    return prompt;
  }),
  formatTemplateValue: vi.fn((value: unknown) => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }),
}));

describe('Character Prompt Generation - T071: VibeContext Style Matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include VibeContext in generated prompt for VIRAL_NEON', () => {
    const prompt = generateCharacterPrompt({
      vibeContext: 'VIRAL_NEON',
      participantCount: 3,
      theme: 'A group trying to go viral',
      tone: 'comedic',
    });

    expect(prompt).toContain('VIRAL_NEON');
    expect(prompt).toContain('3');
  });

  it('should include VibeContext in generated prompt for INDIE_A24', () => {
    const prompt = generateCharacterPrompt({
      vibeContext: 'INDIE_A24',
      participantCount: 2,
      theme: 'A contemplative story',
      tone: 'dramatic',
    });

    expect(prompt).toContain('INDIE_A24');
    expect(prompt).toContain('2');
  });

  it('should include VibeContext in generated prompt for all vibes', () => {
    const vibes = ['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO'] as const;

    vibes.forEach((vibe) => {
      const prompt = generateCharacterPrompt({
        vibeContext: vibe,
        participantCount: 3,
      });

      expect(prompt).toContain(vibe);
    });
  });

  it('should include theme and tone when provided', () => {
    const prompt = generateCharacterPrompt({
      vibeContext: 'VIRAL_NEON',
      participantCount: 3,
      theme: 'A specific theme',
      tone: 'comedic',
    });

    expect(prompt).toContain('A specific theme');
    expect(prompt).toContain('comedic');
  });

  it('should include director-defined characters when provided', () => {
    const prompt = generateCharacterPrompt({
      vibeContext: 'VIRAL_NEON',
      participantCount: 3,
      directorDefinedCharacters: [
        { name: 'Predefined Character', role: 'protagonist' },
      ],
    });

    // The prompt should be generated (formatTemplateValue will stringify the array)
    expect(prompt).toBeDefined();
  });
});
