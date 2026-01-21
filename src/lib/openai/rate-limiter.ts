/**
 * Rate Limiter for OpenAI API
 * 
 * Implements rate limiting: 10 requests per user per hour.
 * Uses in-memory storage for server-side API routes.
 * 
 * Note: In production with multiple server instances, consider using
 * Redis or a shared cache for distributed rate limiting.
 */

const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface RateLimitData {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// In-memory store for rate limit data
// Key: userId, Value: RateLimitData
const rateLimitStore = new Map<string, RateLimitData>();

// Cleanup expired entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of rateLimitStore.entries()) {
      if (now > data.resetAt) {
        rateLimitStore.delete(userId);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Gets rate limit data for a user from in-memory store
 */
function getRateLimitData(userId: string): RateLimitData | null {
  const data = rateLimitStore.get(userId);
  
  if (!data) {
    return null;
  }
  
  // Check if window has expired
  if (Date.now() > data.resetAt) {
    rateLimitStore.delete(userId);
    return null;
  }
  
  return data;
}

/**
 * Sets rate limit data for a user in in-memory store
 */
function setRateLimitData(userId: string, data: RateLimitData): void {
  rateLimitStore.set(userId, data);
}

/**
 * Checks if a request is allowed under rate limit
 * 
 * @param userId - Unique identifier for the user (can be session ID, IP, etc.)
 * @returns Rate limit check result
 */
export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const data = getRateLimitData(userId);

  if (!data) {
    // First request or window expired - create new window
    const newData: RateLimitData = {
      count: 1,
      resetAt: now + WINDOW_MS,
    };
    setRateLimitData(userId, newData);
    return {
      allowed: true,
      remaining: RATE_LIMIT - 1,
      resetAt: newData.resetAt,
    };
  }

  if (data.count >= RATE_LIMIT) {
    // Limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: data.resetAt,
    };
  }

  // Increment count
  data.count += 1;
  setRateLimitData(userId, data);

  return {
    allowed: true,
    remaining: RATE_LIMIT - data.count,
    resetAt: data.resetAt,
  };
}

/**
 * Resets rate limit for a user (useful for testing or manual reset)
 * 
 * @param userId - User identifier
 */
export function resetRateLimit(userId: string): void {
  rateLimitStore.delete(userId);
}
