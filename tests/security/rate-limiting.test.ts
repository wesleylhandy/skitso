import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/src/lib/openai/rate-limiter';

/**
 * T204: Verify rate limiting prevents abuse.
 *
 * This leans on the existing rate limiter and just asserts that it
 * eventually blocks after repeated calls for a single user.
 */

describe('T204: OpenAI rate limiting', () => {
  it('eventually blocks after many requests for the same user', () => {
    const userId = 'test-user-rate-limit';
    let allowedCount = 0;

    for (let i = 0; i < 20; i++) {
      const result = checkRateLimit(userId);
      if (result.allowed) allowedCount += 1;
    }

    expect(allowedCount).toBeLessThanOrEqual(10);
  });
});

