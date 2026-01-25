/**
 * Participant Atom
 *
 * Manages the current participant data (Actor or Director) for the session
 * with persistent storage backed by safe browser storage.
 */

import type { Participant } from '../types/session';
import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Participant atom with persistent storage
 *
 * Key: 'participant'
 * Default: null
 */
export const participantAtom = createPersistentAtom<Participant | null>('participant', null);
