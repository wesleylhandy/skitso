/**
 * Session State Atom
 * 
 * Manages the current session state (idle, configuring, casting, performing, completed, expired)
 * with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';
import type { SessionStatus } from '../types/session';

/**
 * Session state atom with localStorage persistence
 * 
 * Key: 'session_state'
 * Default: 'idle'
 */
export const sessionStateAtom = atomWithStorage<SessionStatus>('session_state', 'idle');
