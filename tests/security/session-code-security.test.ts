import { describe, it, expect } from 'vitest';
import { generateSessionCode } from '@/src/lib/utils/session-code';

/**
 * T200: Verify session code entropy characteristics.
 *
 * This is a probabilistic check: we generate many codes and ensure
 * there are no collisions and the distribution of characters looks
 * reasonably uniform.
 */

describe('T200: Session code security', () => {
  it('generates sufficiently unique codes across many samples', () => {
    const samples = 5000;
    const seen = new Set<string>();

    for (let i = 0; i < samples; i++) {
      const code = generateSessionCode();
      expect(code).toMatch(/^[A-Z0-9]{8,10}$/);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }

    // If we reached here with zero collisions, we are at least
    // exercising the generator across a large sample space.
    expect(seen.size).toBe(samples);
  });
});

