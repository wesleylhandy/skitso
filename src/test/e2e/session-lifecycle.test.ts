/**
 * Session Lifecycle E2E-ish Test
 *
 * T196: Test complete user flow end-to-end (Vibe Selection → Wrap Party)
 *
 * This test exercises the core client-side state flow using atoms and
 * utilities rather than full browser navigation, to verify that:
 * - Session state can be created, progressed, and completed
 * - Wrap party completion triggers client-side cleanup
 * - Session-specific storage is cleared while preferences remain
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDefaultStore } from 'jotai';

import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { performanceProgressAtom } from '@/src/state/atoms/performance-atom';

import type { Character, Script, WrapPartyData, Participant } from '@/src/state/types/session';

import { generateSessionCode } from '@/src/lib/utils/session-code';
import { clearSessionState } from '@/src/lib/utils/session-state-cleanup';
import {
  cleanupOnWrapPartyCompletion,
  runBackgroundSessionCleanup,
} from '@/src/lib/utils/session-cleanup';

const store = getDefaultStore();

describe('T196: Session lifecycle from vibe selection to wrap party', () => {
  beforeEach(() => {
    vi.useRealTimers();
    // Reset localStorage and atoms between tests
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    clearSessionState();

    store.set(vibeAtom, 'VIRAL_NEON');
    store.set(sessionCodeAtom, null);
    store.set(sessionStateAtom, 'idle');
    store.set(castAtom, []);
    store.set(currentScriptAtom, null);
    store.set(wrapPartyDataAtom, null);
    store.set(participantAtom, null);
    store.set(performanceProgressAtom, {
      currentLineIndex: 0,
      currentScene: 0,
      startedAt: null,
      pausedAt: null,
      completedLines: [],
      advancementControl: {
        lastAdvancedBy: null,
        lastAdvancedAt: null,
        directorOverride: false,
      },
    });
  });

  it('walks through Director → Actor → Stage → Wrap Party and cleans up client state', () => {
    // 1. Vibe selection
    expect(store.get(vibeAtom)).toBe('VIRAL_NEON');

    // 2. Director config: create a session and move into casting
    const sessionCode = generateSessionCode();
    store.set(sessionCodeAtom, sessionCode);
    store.set(sessionStateAtom, 'configuring');

    const characters: Character[] = [
      {
        id: 'char-1',
        sessionId: sessionCode,
        participantId: null,
        isLocked: false,
        name: 'Lead',
        archetypeLabel: 'The Main Character',
        personalityTraits: ['confident'],
        hiddenMotivation: 'Prove themselves',
        visualRepresentation: {
          imageUrl: '',
          imagePrompt: 'A confident character',
        },
        dialogueLines: [],
      },
    ];

    const script: Script = {
      id: 'script-1',
      sessionId: sessionCode,
      vibeContext: 'VIRAL_NEON',
      title: 'Test Skit',
      length: '2 minutes',
      description: 'Test script for lifecycle flow',
      scenes: [
        {
          title: 'Scene 1',
          length: '1 minute',
          description: 'Intro',
          dialogue: [{ characterName: 'Lead', content: 'Opening line' }],
          stageDirections: [],
          soundCues: [],
        },
      ],
      generatedAt: Date.now(),
      version: 1,
    };

    store.set(castAtom, characters);
    store.set(currentScriptAtom, script);
    store.set(sessionStateAtom, 'casting');

    expect(store.get(sessionCodeAtom)).toBe(sessionCode);
    expect(store.get(sessionStateAtom)).toBe('casting');
    expect(store.get(castAtom)).toHaveLength(1);
    expect(store.get(currentScriptAtom)?.title).toBe('Test Skit');

    // 3. Actor joins
    const actor: Participant = {
      id: 'actor-1',
      sessionId: sessionCode,
      role: 'actor',
      name: 'Actor One',
      characterAssignment: characters[0],
      assignmentStatus: 'locked',
      requestedCharacterId: null,
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      deviceInfo: {
        userAgent: 'test',
        screenSize: '1920x1080',
        timezone: 'UTC',
      },
    };
    store.set(participantAtom, actor);

    const joined = store.get(participantAtom);
    expect(joined?.sessionId).toBe(sessionCode);
    expect(joined?.characterAssignment?.name).toBe('Lead');

    // 4. Stage: start performance and advance one line
    store.set(sessionStateAtom, 'performing');
    const startedAt = Date.now();
    store.set(performanceProgressAtom, {
      currentLineIndex: 0,
      currentScene: 0,
      startedAt,
      pausedAt: null,
      completedLines: [],
      advancementControl: {
        lastAdvancedBy: actor.id,
        lastAdvancedAt: startedAt,
        directorOverride: false,
      },
    });

    const progressAfterStart = store.get(performanceProgressAtom);
    expect(progressAfterStart.startedAt).toBe(startedAt);
    expect(progressAfterStart.currentLineIndex).toBe(0);

    // Simulate advancing a line
    store.set(performanceProgressAtom, {
      ...progressAfterStart,
      currentLineIndex: 1,
      completedLines: [0],
    });

    const progressAfterAdvance = store.get(performanceProgressAtom);
    expect(progressAfterAdvance.currentLineIndex).toBe(1);
    expect(progressAfterAdvance.completedLines).toEqual([0]);

    // 5. Complete performance and open Wrap Party
    store.set(sessionStateAtom, 'completed');

    const wrapPartyData: WrapPartyData = {
      sessionId: sessionCode,
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };
    store.set(wrapPartyDataAtom, wrapPartyData);

    expect(store.get(sessionStateAtom)).toBe('completed');
    expect(store.get(wrapPartyDataAtom)?.sessionId).toBe(sessionCode);

    // 6. Background cleanup should be safe to run anytime
    expect(() => runBackgroundSessionCleanup()).not.toThrow();

    // 7. Cleanup after wrap party completion
    cleanupOnWrapPartyCompletion(sessionCode);

    // Session-specific atoms should be cleared or reset
    expect(store.get(sessionCodeAtom)).toBeNull();
    expect(store.get(sessionStateAtom)).toBe('idle');
    expect(store.get(castAtom)).toEqual([]);
    expect(store.get(currentScriptAtom)).toBeNull();
    expect(store.get(wrapPartyDataAtom)).toBeNull();
    expect(store.get(participantAtom)).toBeNull();

    // LocalStorage keys for session state should be gone
    if (typeof window !== 'undefined') {
      const ls = window.localStorage;
      expect(ls.getItem('session_code')).toBeNull();
      expect(ls.getItem('session_state')).toBeNull();
      expect(ls.getItem('cast')).toBeNull();
      expect(ls.getItem('current_script')).toBeNull();
      expect(ls.getItem('wrap_party_data')).toBeNull();
    }

    // Vibe preference should remain (not part of session cleanup)
    expect(store.get(vibeAtom)).toBe('VIRAL_NEON');
  });
});

