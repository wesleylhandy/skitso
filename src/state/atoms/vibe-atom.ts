/**
 * VibeContext Atom
 *
 * Central atom for managing the current VibeContext selection.
 * Persists using safe browser storage with graceful degradation
 * when localStorage is unavailable or quota is exceeded.
 */

import type { VibeType } from '../types/vibe';
import { createPersistentAtom } from '../utils/safe-storage';

/**
 * Default vibe type
 */
const DEFAULT_VIBE: VibeType = 'VIRAL_NEON';

/**
 * VibeContext atom with persistent storage
 *
 * Key: 'vibe'
 * Default: 'VIRAL_NEON'
 */
export const vibeAtom = createPersistentAtom<VibeType>('vibe', DEFAULT_VIBE);
