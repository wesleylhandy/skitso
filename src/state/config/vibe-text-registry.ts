/**
 * Centralized Text Registry per VibeContext
 * 
 * Provides easy access to all UI textual labels, button text,
 * placeholders, section titles, and messages for each VibeContext.
 * This registry is switched atomically with theme changes.
 */

import { VIBE_CONFIGS } from './vibe-configs';
import type { VibeType } from '../types/vibe';

/**
 * Get text registry for a specific vibe
 */
export function getTextRegistry(vibe: VibeType) {
  return VIBE_CONFIGS[vibe].linguisticTone;
}

/**
 * Get button label for a specific vibe and button type
 */
export function getButtonLabel(vibe: VibeType, buttonType: string): string {
  return VIBE_CONFIGS[vibe].linguisticTone.buttonLabels[buttonType] || buttonType;
}

/**
 * Get placeholder text for a specific vibe and field type
 */
export function getPlaceholder(vibe: VibeType, fieldType: string): string {
  return VIBE_CONFIGS[vibe].linguisticTone.placeholders[fieldType] || '';
}

/**
 * Get error message for a specific vibe and error type
 */
export function getErrorMessage(vibe: VibeType, errorType: string): string {
  return VIBE_CONFIGS[vibe].linguisticTone.errorMessages[errorType] || 'An error occurred';
}

/**
 * Get success message for a specific vibe and success type
 */
export function getSuccessMessage(vibe: VibeType, successType: string): string {
  return VIBE_CONFIGS[vibe].linguisticTone.successMessages[successType] || 'Success';
}

/**
 * Get section title for a specific vibe and section type
 */
export function getSectionTitle(vibe: VibeType, sectionType: string): string {
  return VIBE_CONFIGS[vibe].linguisticTone.sectionTitles[sectionType] || sectionType;
}
