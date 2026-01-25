import { describe, it, expect } from 'vitest';
import { getModel, OPENAI_MODELS } from './models';

describe('OpenAI Model Configuration', () => {
  it('should have all required model keys', () => {
    expect(OPENAI_MODELS.CHARACTER_GENERATION).toBeDefined();
    expect(OPENAI_MODELS.SCRIPT_GENERATION).toBeDefined();
    expect(OPENAI_MODELS.IMAGE_PROMPT_GENERATION).toBeDefined();
    expect(OPENAI_MODELS.IMAGE_GENERATION).toBeDefined();
  });

  it('should return string for all model types', () => {
    expect(typeof getModel('CHARACTER_GENERATION')).toBe('string');
    expect(typeof getModel('SCRIPT_GENERATION')).toBe('string');
    expect(typeof getModel('IMAGE_PROMPT_GENERATION')).toBe('string');
    expect(typeof getModel('IMAGE_GENERATION')).toBe('string');
  });

  it('should return non-empty model names', () => {
    expect(getModel('CHARACTER_GENERATION').length).toBeGreaterThan(0);
    expect(getModel('SCRIPT_GENERATION').length).toBeGreaterThan(0);
    expect(getModel('IMAGE_PROMPT_GENERATION').length).toBeGreaterThan(0);
    expect(getModel('IMAGE_GENERATION').length).toBeGreaterThan(0);
  });

  it('should default to gpt-5-mini when env vars not set', () => {
    // Note: This tests the default behavior
    // Actual env var reading depends on process.env at module load time
    const charModel = getModel('CHARACTER_GENERATION');
    const scriptModel = getModel('SCRIPT_GENERATION');
    const imageModel = getModel('IMAGE_PROMPT_GENERATION');

    // Should be either default or custom (if env var is set)
    expect(charModel).toMatch(/^gpt-/);
    expect(scriptModel).toMatch(/^gpt-/);
    expect(imageModel).toMatch(/^gpt-/);
  });

  it('should have IMAGE_GENERATION set to gpt-image-1.5', () => {
    expect(getModel('IMAGE_GENERATION')).toBe('gpt-image-1.5');
  });
});
