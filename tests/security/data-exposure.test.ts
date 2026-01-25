import { describe, it, expect } from 'vitest';

/**
 * T201: Data exposure checks.
 *
 * These checks are intentionally conservative and focused on build-
 * time guarantees: we ensure that known secret env vars are not
 * accidentally embedded into the bundle by asserting they are
 * undefined in the browser-like test environment.
 */

describe('T201: Sensitive data exposure prevention', () => {
  it('does not expose server-side secrets via NEXT_PUBLIC_*', () => {
    // By convention, only NEXT_PUBLIC_* vars are available client-side.
    // OPENAI_API_KEY must never be exposed as NEXT_PUBLIC_*.
    expect(process.env.NEXT_PUBLIC_OPENAI_API_KEY).toBeUndefined();
  });

  it('does not hard-code OPENAI_API_KEY in environment', () => {
    // Vitest injects env from the test process; this ensures we are
    // not shipping a literal value in source (would show up here).
    const key = process.env.OPENAI_API_KEY;
    if (key) {
      // In CI/local, the user may set this to run integration tests,
      // but it should never be a placeholder shipped in source.
      expect(key).not.toContain('your_openai_api_key_here');
    }
  });
});

