/**
 * Session State Atom
 *
 * Manages the current session state (idle, configuring, casting, performing, completed, expired)
 * with persistent storage backed by safe browser storage.
 */

import type { SessionStatus } from '../types/session';
import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Session state atom with persistent storage
 *
 * Key: 'session_state'
 * Default: 'idle'
 */
export const sessionStateAtom = createPersistentAtom<SessionStatus>('session_state', 'idle');
