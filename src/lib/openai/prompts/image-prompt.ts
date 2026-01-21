/**
 * Character Image Generation Prompt Template
 * 
 * Generates the system prompt for character image generation by loading
 * the markdown template from specs/001-skitso-platform/prompts/character-image-generation-prompt.md
 * and performing variable substitution.
 */

import type { VibeType } from '@/src/state/types/vibe';
import type { Character } from '@/src/state/types/session';
import { loadPromptTemplate, formatTemplateValue } from './template-engine';

interface ImageGenerationParams {
  character: Character;
  vibeContext: VibeType;
  optionalImagePrompt?: string;
}

/**
 * Generates the system prompt for character image generation
 * 
 * Loads the markdown template and substitutes variables.
 */
export function generateImagePrompt(params: ImageGenerationParams): string {
  const { character, vibeContext, optionalImagePrompt } = params;

  // Build context for template substitution
  const context: Record<string, string> = {
    vibeContext,
    character: formatTemplateValue(character),
  };

  // Add optional image prompt if provided
  if (optionalImagePrompt) {
    context.optionalImagePrompt = optionalImagePrompt;
  }

  // Load and process the template
  const prompt = loadPromptTemplate(
    'specs/001-skitso-platform/prompts/character-image-generation-prompt.md',
    context
  );

  return prompt;
}
