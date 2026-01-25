/**
 * OpenAI Model Configuration
 * 
 * Centralized model configuration matching the spec requirements.
 * Note: Spec mentions "gpt-5-mini" which doesn't exist yet, so we use
 * the closest available model (gpt-5-mini for cost, gpt-4o for quality).
 * 
 * Based on research.md: "Use GPT-4o for quality, not GPT-4 Turbo"
 */

/**
 * Model configuration for different generation tasks
 */
export const OPENAI_MODELS = {
  /**
   * Character generation model
   * Spec: gpt-5-mini (future model)
   * Current: gpt-5-mini (cost-effective) or gpt-4o (better quality)
   */
  CHARACTER_GENERATION: process.env.OPENAI_MODEL_CHARACTER ?? 'gpt-5-mini',

  /**
   * Script generation model
   * Spec: gpt-5-mini (future model)
   * Current: gpt-5-mini (cost-effective) or gpt-4o (better quality)
   */
  SCRIPT_GENERATION: process.env.OPENAI_MODEL_SCRIPT ?? 'gpt-5-mini',

  /**
   * Image prompt generation model
   * Used to generate optimized prompts for gpt-image-1.5
   * Current: gpt-5-mini (cost-effective) or gpt-4o (better quality)
   */
  IMAGE_PROMPT_GENERATION: process.env.OPENAI_MODEL_IMAGE_PROMPT ?? 'gpt-5-mini',

  /**
   * Image generation model (when available)
   * Spec: gpt-image-1.5
   * Note: This model may not be available yet, so image generation
   * currently only generates prompts, not actual images
   */
  IMAGE_GENERATION: 'gpt-image-1.5', // Future model
} as const;

/**
 * Get the model name for a specific task
 */
export function getModel(task: keyof typeof OPENAI_MODELS): string {
  return OPENAI_MODELS[task];
}

/**
 * Check if a model supports custom temperature values
 * 
 * Reasoning models (GPT-5 series, o1, o3) have restrictions:
 * - GPT-5 series: Only support temperature=1 (default)
 * - o1/o3 series: Don't support temperature parameter at all
 * - Standard models (GPT-4o, GPT-4, GPT-3.5): Support custom temperature
 */
function isReasoningModel(modelName: string): boolean {
  // GPT-5 series (gpt-5, gpt-5-mini, gpt-5-nano, etc.)
  if (modelName.startsWith('gpt-5')) {
    return true;
  }
  
  // o-series reasoning models (o1, o1-mini, o3, o3-mini, etc.)
  if (/^o\d+/.test(modelName)) {
    return true;
  }
  
  return false;
}

/**
 * Get temperature parameter for a model
 * 
 * Returns undefined for models that don't support temperature,
 * or the appropriate value for models that do.
 * 
 * @param modelName - The OpenAI model name
 * @param desiredTemperature - The desired temperature value (default: 0.8)
 * @returns Temperature value or undefined
 */
export function getTemperatureForModel(
  modelName: string,
  desiredTemperature: number = 0.8
): number | undefined {
  // Reasoning models (GPT-5, o1, o3) don't support custom temperature
  // For GPT-5, we can omit it (uses default 1) or explicitly set to 1
  // For o-series, we must omit it entirely
  if (isReasoningModel(modelName)) {
    // o-series models don't support temperature at all
    if (/^o\d+/.test(modelName)) {
      return undefined;
    }
    // GPT-5 series only support temperature=1
    // We'll omit it to use the default, but could set to 1 explicitly
    return undefined; // Let it use default (1)
  }
  
  // Standard models support custom temperature
  return desiredTemperature;
}
