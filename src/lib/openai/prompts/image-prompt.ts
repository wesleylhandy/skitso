/**
 * Character Image Generation Prompt Template
 * 
 * Generates the system prompt for character image generation by loading
 * the markdown template from src/lib/openai/prompts/templates/character-image-generation-prompt.md
 * and performing variable substitution.
 */

import type { VibeType } from '@/src/state/types/vibe';
import type { Character } from '@/src/state/types/session';
import { deepSanitizeObject, sanitizePlainText } from '@/src/lib/security/input-sanitizer';
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
  // Note: deepSanitizeObject expects Record<string, unknown>, but Character is a structured type.
  // We cast through unknown to satisfy the type constraint while preserving runtime behavior.
  const sanitizedCharacter = deepSanitizeObject(character as unknown as Record<string, unknown>) as unknown as Character;
  const context: Record<string, string> = {
    vibeContext,
    character: formatTemplateValue(sanitizedCharacter),
  };

  // Add optional image prompt if provided
  if (optionalImagePrompt) {
    const safePrompt = sanitizePlainText(optionalImagePrompt);
    context.optionalImagePrompt = `"""${safePrompt}"""`;
  }

  // Load and process the template
  const prompt = loadPromptTemplate(
    'src/lib/openai/prompts/templates/character-image-generation-prompt.md',
    context
  );

  return prompt;
}
