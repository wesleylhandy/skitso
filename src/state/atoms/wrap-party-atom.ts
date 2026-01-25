/**
 * Wrap Party Data Atom
 *
 * Manages the wrap party data state (votes, awards, feedback, shared links)
 * with persistent storage backed by safe browser storage.
 */

import type { WrapPartyData } from '../types/session';
import { createPersistentAtom } from '../utils/safe-storage';

// Re-export for convenience
export type { WrapPartyData } from '../types/session';

/**
 * Wrap party data atom with persistent storage
 *
 * Key: 'wrap_party_data'
 * Default: null (no wrap party data until performance completes)
 */
export const wrapPartyDataAtom = createPersistentAtom<WrapPartyData | null>('wrap_party_data', null);
