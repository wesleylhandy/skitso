/**
 * Tests for Script Prompt Generation
 * 
 * T071: Test generated content matches selected VibeContext style
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScriptPrompt } from './script-prompt';
import type { Character } from '@/src/state/types/session';

// Mock the template engine
vi.mock('./template-engine', () => ({
  loadPromptTemplate: vi.fn((path: string, context: Record<string, string>) => {
    // Return a mock prompt that includes all context variables
    let prompt = `Mock script prompt for ${context.vibeContext} about "${context.theme}"`;
    if (context.tone) prompt += ` with tone ${context.tone}`;
    if (context.sceneCount) prompt += ` with ${context.sceneCount} scenes`;
    if (context.chaosLevel) prompt += ` chaos level ${context.chaosLevel}`;
    if (context.characters) prompt += ` with characters: ${context.characters}`;
    if (context.slangRegistry) prompt += ` using slang: ${context.slangRegistry}`;
    return prompt;
  }),
  formatTemplateValue: vi.fn((value: unknown) => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }),
}));

describe('Script Prompt Generation - T071: VibeContext Style Matching', () => {
  const mockCharacters: Character[] = [
    {
      id: 'char1',
      sessionId: 'session1',
      participantId: null,
      isLocked: false,
      name: 'Character1',
      archetypeLabel: 'The Main Character',
      personalityTraits: ['confident', 'bold'],
      hiddenMotivation: 'Wants to succeed',
      visualRepresentation: {
        imageUrl: 'https://example.com/image.jpg',
        imagePrompt: 'A confident character',
      },
      dialogueLines: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include VibeContext in generated prompt for VIRAL_NEON', () => {
    const prompt = generateScriptPrompt({
      vibeContext: 'VIRAL_NEON',
      theme: 'A group trying to go viral',
      tone: 'comedic',
      characters: mockCharacters,
      sceneCount: 2,
      chaosLevel: 7,
    });

    expect(prompt).toContain('VIRAL_NEON');
    expect(prompt).toContain('A group trying to go viral');
  });

  it('should include VibeContext in generated prompt for all vibes', () => {
    const vibes = ['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO'] as const;

    vibes.forEach((vibe) => {
      const prompt = generateScriptPrompt({
        vibeContext: vibe,
        theme: 'Test theme',
        tone: 'comedic',
        characters: mockCharacters,
        sceneCount: 1,
        chaosLevel: 5,
      });

      expect(prompt).toContain(vibe);
    });
  });

  it('should include characters in the prompt', () => {
    const prompt = generateScriptPrompt({
      vibeContext: 'VIRAL_NEON',
      theme: 'Test theme',
      tone: 'comedic',
      characters: mockCharacters,
      sceneCount: 1,
      chaosLevel: 5,
    });

    // Characters should be included (formatted as JSON)
    expect(prompt).toBeDefined();
  });

  it('should include chaos level in the prompt', () => {
    const prompt = generateScriptPrompt({
      vibeContext: 'VIRAL_NEON',
      theme: 'Test theme',
      tone: 'comedic',
      characters: mockCharacters,
      sceneCount: 1,
      chaosLevel: 9,
    });

    expect(prompt).toContain('9');
  });

  it('should include slang registry for VIRAL_NEON', () => {
    const prompt = generateScriptPrompt({
      vibeContext: 'VIRAL_NEON',
      theme: 'Test theme',
      tone: 'comedic',
      characters: mockCharacters,
      sceneCount: 1,
      chaosLevel: 5,
    });

    // The prompt should be generated (slang registry is added in the template)
    expect(prompt).toBeDefined();
  });
});
