/**
 * Cast Atom
 * 
 * Manages the generated characters (cast) for the current session
 * with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';
import type { Character } from '../types/session';

/**
 * Cast atom with localStorage persistence
 * 
 * Key: 'cast'
 * Default: []
 */
export const castAtom = atomWithStorage<Character[]>('cast', []);
