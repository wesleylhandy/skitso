/**
 * Chaos Level Atom
 *
 * Manages the chaos level (1-10) for the current session
 * with persistent storage backed by safe browser storage.
 */

import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Chaos level atom with persistent storage
 *
 * Key: 'chaos_level'
 * Default: 5
 */
export const chaosLevelAtom = createPersistentAtom<number>('chaos_level', 5);
