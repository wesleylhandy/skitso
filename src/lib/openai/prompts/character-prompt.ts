/**
 * Character Generation Prompt Template
 * 
 * Generates the system prompt for character generation by loading
 * the markdown template from src/lib/openai/prompts/templates/character-generation-prompt.md
 * and performing variable substitution.
 */

import type { VibeType } from '@/src/state/types/vibe';
import type { DirectorDefinedCharacter } from '@/src/lib/validation/session-config-schema';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';
import { VIRAL_NEON_SLANG_REGISTRY } from '@/src/lib/data/slang-registry';
import { deepSanitizeObject, sanitizePlainText } from '@/src/lib/security/input-sanitizer';
import { loadPromptTemplate, formatTemplateValue } from './template-engine';

interface CharacterGenerationParams {
  vibeContext: VibeType;
  participantCount: number;
  directorDefinedCharacters?: DirectorDefinedCharacter[];
  theme?: string;
  tone?: string;
}

/**
 * Generates the system prompt for character generation
 * 
 * Loads the markdown template and substitutes variables.
 */
export function generateCharacterPrompt(params: CharacterGenerationParams): string {
  const { vibeContext, participantCount, directorDefinedCharacters, theme, tone } = params;
  const config = VIBE_CONFIGS[vibeContext];

  // Build context for template substitution
  const context: Record<string, string> = {
    vibeContext,
    participantCount: String(participantCount),
  };

  // Add optional variables
  if (directorDefinedCharacters && directorDefinedCharacters.length > 0) {
    const safeCharacters = directorDefinedCharacters.map((c) =>
      deepSanitizeObject<DirectorDefinedCharacter>(c)
    );
    context.directorDefinedCharacters = formatTemplateValue(safeCharacters);
  }

  if (theme) {
    const safeTheme = sanitizePlainText(theme);
    context.theme = `"""${safeTheme}"""`;
  }

  if (tone) {
    const safeTone = sanitizePlainText(tone);
    context.tone = `"""${safeTone}"""`;
  }

  // Load and process the template
  let prompt = loadPromptTemplate(
    'src/lib/openai/prompts/templates/character-generation-prompt.md',
    context
  );

  // Add vibe-specific enhancements that aren't in the base template
  // (These could also be moved to the markdown template with conditional logic)
  const vibeEnhancements = `\n**Additional VibeContext Details:**\n`;
  const archetypeLabels = Object.values(config.aiParameters.archetypeLabels).join(', ');
  let enhancements = `${vibeEnhancements}- Use archetype labels: ${archetypeLabels}\n`;
  
  if (vibeContext === 'VIRAL_NEON') {
    const slangSample = VIRAL_NEON_SLANG_REGISTRY.slice(0, 10).join(', ');
    enhancements += `- Use modern 2026 slang examples: ${slangSample}\n`;
  }

  // Append enhancements to the prompt
  prompt += enhancements;

  return prompt;
}
