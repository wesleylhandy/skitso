/**
 * Color Contrast Utilities
 * 
 * Utilities for calculating WCAG-compliant text colors based on background colors.
 * Ensures accessibility standards (WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text).
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance (WCAG formula)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors (WCAG formula)
 */
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 1;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG-compliant text color for a given background
 * Returns white (#FFFFFF) or black (#000000) based on which provides better contrast
 * 
 * @param bgColor - Background color in hex format (e.g., '#0A0A0A')
 * @param minContrast - Minimum contrast ratio (default 4.5 for WCAG AA normal text)
 * @returns Hex color string for text
 */
export function getContrastingTextColor(
  bgColor: string,
  minContrast: number = 4.5
): string {
  const white = '#FFFFFF';
  const black = '#000000';

  const whiteContrast = getContrastRatio(bgColor, white);
  const blackContrast = getContrastRatio(bgColor, black);

  // If white meets minimum contrast, use it (preferred for dark backgrounds)
  if (whiteContrast >= minContrast) {
    return white;
  }

  // If black meets minimum contrast, use it (for light backgrounds)
  if (blackContrast >= minContrast) {
    return black;
  }

  // If neither meets minimum, return the one with better contrast
  return whiteContrast > blackContrast ? white : black;
}

/**
 * Check if a color combination meets WCAG contrast requirements
 * 
 * @param textColor - Text color in hex format
 * @param bgColor - Background color in hex format
 * @param level - WCAG level: 'AA' (4.5:1) or 'AAA' (7:1) for normal text
 * @returns true if contrast meets requirements
 */
export function meetsWCAGContrast(
  textColor: string,
  bgColor: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const minContrast = level === 'AA' ? 4.5 : 7.0;
  const contrast = getContrastRatio(textColor, bgColor);
  return contrast >= minContrast;
}
