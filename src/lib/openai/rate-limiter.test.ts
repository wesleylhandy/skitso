import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from './rate-limiter';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    resetRateLimit('user1');
  });

  it('should allow request when under limit', () => {
    const result = checkRateLimit('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should track requests per user', () => {
    checkRateLimit('user1');
    checkRateLimit('user1');
    checkRateLimit('user2');

    const result1 = checkRateLimit('user1');
    expect(result1.remaining).toBe(7);

    const result2 = checkRateLimit('user2');
    expect(result2.remaining).toBe(8);
  });

  it('should block request when limit exceeded', () => {
    // Make 10 requests (the limit)
    for (let i = 0; i < 10; i++) {
      checkRateLimit('user1');
    }

    const result = checkRateLimit('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after 1 hour', () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      checkRateLimit('user1');
    }

    // Verify blocked
    const blocked = checkRateLimit('user1');
    expect(blocked.allowed).toBe(false);

    // Manually reset (simulating 1 hour passing)
    resetRateLimit('user1');

    // Should be allowed again
    const allowed = checkRateLimit('user1');
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(9);
  });

  it('should return correct reset time', () => {
    const result = checkRateLimit('user1');
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 3600000); // 1 hour
  });
});

describe('resetRateLimit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should reset rate limit for a user', () => {
    // Make some requests
    checkRateLimit('user1');
    checkRateLimit('user1');

    // Reset
    resetRateLimit('user1');

    // Should be back to full limit
    const result = checkRateLimit('user1');
    expect(result.remaining).toBe(9);
  });

  it('should only reset for specified user', () => {
    checkRateLimit('user1');
    checkRateLimit('user2');

    resetRateLimit('user1');

    const result1 = checkRateLimit('user1');
    expect(result1.remaining).toBe(9);

    const result2 = checkRateLimit('user2');
    expect(result2.remaining).toBe(8);
  });
});
