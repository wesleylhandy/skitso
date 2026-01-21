/**
 * VibeContext Atom
 * 
 * Central atom for managing the current VibeContext selection.
 * Persists to localStorage using atomWithStorage.
 */

import { atomWithStorage } from 'jotai/utils';
import type { VibeType } from '../types/vibe';

/**
 * Default vibe type
 */
const DEFAULT_VIBE: VibeType = 'VIRAL_NEON';

/**
 * VibeContext atom with localStorage persistence
 * 
 * Key: 'vibe'
 * Default: 'VIRAL_NEON'
 */
export const vibeAtom = atomWithStorage<VibeType>('vibe', DEFAULT_VIBE);
