/**
 * Session Code Atom
 * 
 * Manages the current session code with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';

/**
 * Session code atom with localStorage persistence
 * 
 * Key: 'session_code'
 * Default: null
 */
export const sessionCodeAtom = atomWithStorage<string | null>('session_code', null);
