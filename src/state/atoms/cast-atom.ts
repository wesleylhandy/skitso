/**
 * Cast Atom
 *
 * Manages the generated characters (cast) for the current session
 * with persistent storage backed by safe browser storage.
 */

import type { Character } from '../types/session';
import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Cast atom with persistent storage
 *
 * Key: 'cast'
 * Default: []
 */
export const castAtom = createPersistentAtom<Character[]>('cast', []);
