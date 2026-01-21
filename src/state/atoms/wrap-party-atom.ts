/**
 * Wrap Party Data Atom
 * 
 * Manages the wrap party data state (votes, awards, feedback, shared links)
 * with localStorage persistence.
 */

import { atomWithStorage } from 'jotai/utils';
import type { WrapPartyData } from '../types/session';

// Re-export for convenience
export type { WrapPartyData } from '../types/session';

/**
 * Wrap party data atom with localStorage persistence
 * 
 * Key: 'wrap_party_data'
 * Default: null (no wrap party data until performance completes)
 */
export const wrapPartyDataAtom = atomWithStorage<WrapPartyData | null>(
  'wrap_party_data',
  null
);
