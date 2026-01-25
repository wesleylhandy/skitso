/**
 * Script Generation Prompt Template
 * 
 * Generates the system prompt for script generation by loading
 * the markdown template from src/lib/openai/prompts/templates/script-generation-prompt.md
 * and performing variable substitution.
 */

import type { VibeType } from '@/src/state/types/vibe';
import type { Character } from '@/src/state/types/session';
import { VIRAL_NEON_SLANG_REGISTRY } from '@/src/lib/data/slang-registry';
import { deepSanitizeObject, sanitizePlainText } from '@/src/lib/security/input-sanitizer';
import { loadPromptTemplate, formatTemplateValue } from './template-engine';

interface ScriptGenerationParams {
  vibeContext: VibeType;
  theme: string;
  tone: string;
  characters: Character[];
  sceneCount: number;
  chaosLevel: number;
  plot?: string;
  jokes?: string[];
}

/**
 * Generates the system prompt for script generation
 * 
 * Loads the markdown template and substitutes variables.
 */
export function generateScriptPrompt(params: ScriptGenerationParams): string {
  const { vibeContext, theme, tone, characters, sceneCount, chaosLevel, plot, jokes } = params;

  // Build context for template substitution
  const context: Record<string, string> = {
    vibeContext,
    theme: `"""${sanitizePlainText(theme)}"""`,
    tone: `"""${sanitizePlainText(tone)}"""`,
    sceneCount: String(sceneCount),
    chaosLevel: String(chaosLevel),
    characters: formatTemplateValue(
      characters.map((c) => deepSanitizeObject(c as unknown as Record<string, unknown>) as unknown as Character)
    ),
  };

  // Add optional variables
  if (plot) {
    const safePlot = sanitizePlainText(plot);
    context.plot = `"""${safePlot}"""`;
  }

  if (jokes && jokes.length > 0) {
    const safeJokes = jokes.map((joke) => sanitizePlainText(joke));
    context.jokes = formatTemplateValue(safeJokes);
  }

  // Add slang registry for VIRAL_NEON
  if (vibeContext === 'VIRAL_NEON') {
    context.slangRegistry = formatTemplateValue(VIRAL_NEON_SLANG_REGISTRY);
  }

  // Load and process the template
  const prompt = loadPromptTemplate(
    'src/lib/openai/prompts/templates/script-generation-prompt.md',
    context
  );

  return prompt;
}
