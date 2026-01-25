/**
 * Input sanitization utilities (T203).
 *
 * These helpers provide a minimal, framework-agnostic way to
 * normalize and safely handle untrusted string input before it
 * reaches business logic or is rendered.
 *
 * Note: This does not replace proper output encoding. For XSS
 * protection you must still rely on React's escaping and avoid
 * dangerouslySetInnerHTML where possible.
 */

/**
 * Strip HTML tags and collapse whitespace.
 */
export function sanitizePlainText(input: string): string {
  const withoutTags = input.replace(/<[^>]*>/g, '');
  return withoutTags.replace(/\s+/g, ' ').trim();
}

/**
 * Escape characters that are dangerous in HTML contexts.
 */
export function escapeForHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Basic normalization for user-provided identifiers (e.g. names,
 * tags). Keeps letters, numbers, spaces, dashes and underscores.
 */
export function sanitizeIdentifier(input: string): string {
  return input.replace(/[^\w\s-]/g, '').trim();
}

/**
 * Recursively sanitize all string properties on a plain object.
 */
export function deepSanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizePlainText(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'string') return sanitizePlainText(item);
        if (item && typeof item === 'object') {
          return deepSanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else if (value && typeof value === 'object') {
      result[key] = deepSanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

