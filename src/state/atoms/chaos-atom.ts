/**
 * Chaos Level Atom
 * 
 * Manages the chaos level (1-10) for the current session
 * with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';

/**
 * Chaos level atom with localStorage persistence
 * 
 * Key: 'chaos_level'
 * Default: 5
 */
export const chaosLevelAtom = atomWithStorage<number>('chaos_level', 5);
