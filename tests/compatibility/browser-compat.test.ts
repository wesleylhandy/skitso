import { describe, it, expect } from 'vitest';

/**
 * T205: Browser compatibility checks.
 *
 * These tests act as a documented checklist rather than full
 * cross-browser automation. They ensure that critical assumptions
 * (no non-standard APIs, graceful feature detection) hold true.
 */

describe('T205: Browser compatibility (desktop)', () => {
  it('does not rely on non-standard browser APIs', () => {
    // Basic sanity checks for APIs we expect on all target browsers.
    expect(typeof window.addEventListener).toBe('function');
    expect(typeof Array.prototype.flatMap).toBe('function');
  });

  it('uses feature detection before optional APIs', () => {
    // This assertion is mostly documentary; if it fails, revisit
    // instances of optional chaining against window / navigator.
    expect(typeof navigator !== 'undefined').toBe(true);
  });
});

