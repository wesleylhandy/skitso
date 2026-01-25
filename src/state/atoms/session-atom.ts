/**
 * Session Code Atom
 *
 * Manages the current session code with persistent storage.
 * Uses safe storage to handle browser quota limits and SSR.
 */

import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Session code atom with persistent storage
 *
 * Key: 'session_code'
 * Default: null
 */
export const sessionCodeAtom = createPersistentAtom<string | null>('session_code', null);
