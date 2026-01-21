/**
 * Participant Atom
 * 
 * Manages the current participant data (Actor or Director) for the session
 * with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';
import type { Participant } from '../types/session';

/**
 * Participant atom with localStorage persistence
 * 
 * Key: 'participant'
 * Default: null
 */
export const participantAtom = atomWithStorage<Participant | null>('participant', null);
