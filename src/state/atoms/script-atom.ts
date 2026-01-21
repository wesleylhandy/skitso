/**
 * Current Script Atom
 * 
 * Manages the generated script for the current session
 * with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';
import type { Script } from '../types/session';

/**
 * Current script atom with localStorage persistence
 * 
 * Key: 'current_script'
 * Default: null
 */
export const currentScriptAtom = atomWithStorage<Script | null>('current_script', null);
