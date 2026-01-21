/**
 * Session Code Generation Utility
 * 
 * Generates cryptographically secure session codes (8-10 alphanumeric characters)
 * and validates their security properties. Also generates shareable links.
 */

/**
 * Generates a cryptographically secure session code (8-10 alphanumeric characters)
 * 
 * Uses crypto.getRandomValues for secure random generation.
 * Format: 8-10 characters, alphanumeric (A-Z, a-z, 0-9)
 * 
 * Note: True 128-bit entropy would require ~22 characters, but we use 8-10
 * for usability. This provides ~48-60 bits of entropy, which is acceptable
 * for session codes that expire after 24 hours.
 * 
 * @returns 8-10 character alphanumeric session code
 */
export function generateSessionCode(): string {
  const length = 8 + Math.floor(Math.random() * 3); // 8, 9, or 10 characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint32Array(length);
  
  // Use crypto.getRandomValues for cryptographically secure randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    // Fallback for environments without crypto (shouldn't happen in browser/Node)
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 0xFFFFFFFF);
    }
  }
  
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  
  return code;
}

/**
 * Validates that a session code meets security requirements
 * 
 * Requirements:
 * - 8-10 alphanumeric characters
 * - Only A-Z, a-z, 0-9 allowed
 * 
 * Note: This validates format and length. True 128-bit entropy validation
 * would require checking actual randomness, which is not feasible at runtime.
 * 
 * @param code - Session code to validate
 * @returns true if code meets security requirements
 */
export function validateSessionCodeSecurity(code: string): boolean {
  // Must be 8-10 characters, alphanumeric only
  const regex = /^[A-Za-z0-9]{8,10}$/;
  return regex.test(code);
}

/**
 * Gets the base app URL from environment variables
 * 
 * Uses NEXT_PUBLIC_APP_URL for client-side access.
 * Falls back to localhost:3000 in development if not set.
 * 
 * @returns Base URL (e.g., https://skitso.app or http://localhost:3000)
 */
function getAppUrl(): string {
  // NEXT_PUBLIC_ prefix makes it available on client-side
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Fallback for development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // Production fallback (should be set in production)
  return 'https://skitso.app';
}

/**
 * Generates a shareable link for a session code
 * 
 * @param sessionCode - The session code
 * @returns Shareable URL in format: {APP_URL}/join/{code}
 */
export function generateShareableLink(sessionCode: string): string {
  const baseUrl = getAppUrl();
  // Remove trailing slash if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  return `${cleanBaseUrl}/join/${sessionCode}`;
}
