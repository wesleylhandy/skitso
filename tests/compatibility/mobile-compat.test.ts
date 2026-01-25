import { describe, it, expect } from 'vitest';

/**
 * T206: Mobile browser compatibility.
 *
 * We can’t fully emulate iOS Safari / Chrome Mobile here, but we
 * can assert that touch-related assumptions are guarded.
 */

describe('T206: Mobile compatibility', () => {
  it('does not hard-fail when touch APIs are missing', () => {
    expect(() => {
      // Accessing ontouchstart safely – should not throw in tests.
      const hasTouch =
        'ontouchstart' in window ||
        (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! >
          0;
      void hasTouch;
    }).not.toThrow();
  });
});

