/**
 * Current Script Atom
 *
 * Manages the generated script for the current session
 * with persistent storage backed by safe browser storage.
 */

import type { Script } from '../types/session';
import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Current script atom with persistent storage
 *
 * Key: 'current_script'
 * Default: null
 */
export const currentScriptAtom = createPersistentAtom<Script | null>('current_script', null);
