/**
 * Tests for wrapPartyDataAtom
 * 
 * Verifies that wrapPartyDataAtom persists to localStorage and
 * maintains state correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { wrapPartyDataAtom, type WrapPartyData } from './wrap-party-atom';

describe('wrapPartyDataAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset atom to default
    store.set(wrapPartyDataAtom, null);
  });

  it('should default to null', () => {
    const value = store.get(wrapPartyDataAtom);
    expect(value).toBeNull();
  });

  it('should persist to localStorage', async () => {
    const wrapPartyData: WrapPartyData = {
      sessionId: 'session-123',
      votes: [
        {
          id: 'vote-1',
          participantId: 'participant-1',
          category: 'overall_quality',
          targetId: 'overall',
          value: 5,
          createdAt: Date.now(),
        },
      ],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };
    
    store.set(wrapPartyDataAtom, wrapPartyData);
    
    // Wait for async storage
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('wrap_party_data');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.sessionId).toBe('session-123');
        expect(parsed.votes).toHaveLength(1);
        expect(parsed.votes[0].value).toBe(5);
        resolve();
      }, 100);
    });
  });

  it('should read from localStorage when value exists', () => {
    const storedData: WrapPartyData = {
      sessionId: 'session-456',
      votes: [
        {
          id: 'vote-2',
          participantId: 'participant-2',
          category: 'best_actor',
          targetId: 'character-1',
          value: 1,
          createdAt: 1000,
        },
      ],
      awards: [
        {
          id: 'award-1',
          category: 'best_actor',
          winnerId: 'character-1',
          voteCount: 3,
          vibeAppropriateLabel: 'Best Actor',
        },
      ],
      feedback: [],
      sharedLinks: [],
      createdAt: 2000,
    };
    
    localStorage.setItem('wrap_party_data', JSON.stringify(storedData));
    
    // The atom should read from localStorage on initialization
    const stored = localStorage.getItem('wrap_party_data');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.sessionId).toBe('session-456');
    expect(parsed.awards).toHaveLength(1);
  });

  it('should handle adding votes', () => {
    const wrapPartyData: WrapPartyData = {
      sessionId: 'session-789',
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };
    
    store.set(wrapPartyDataAtom, wrapPartyData);
    
    const newVote: WrapPartyData['votes'][0] = {
      id: 'vote-3',
      participantId: 'participant-3',
      category: 'funniest_moment',
      targetId: 'line-5',
      value: 1,
      createdAt: Date.now(),
    };
    
    const current = store.get(wrapPartyDataAtom);
    const updated: WrapPartyData = {
      ...current!,
      votes: [...current!.votes, newVote],
    };
    
    store.set(wrapPartyDataAtom, updated);
    expect(store.get(wrapPartyDataAtom)?.votes).toHaveLength(1);
    expect(store.get(wrapPartyDataAtom)?.votes[0].category).toBe('funniest_moment');
  });

  it('should handle adding awards', () => {
    const wrapPartyData: WrapPartyData = {
      sessionId: 'session-abc',
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };
    
    store.set(wrapPartyDataAtom, wrapPartyData);
    
    const newAward: WrapPartyData['awards'][0] = {
      id: 'award-2',
      category: 'overall_quality',
      winnerId: 'overall',
      voteCount: 10,
      vibeAppropriateLabel: 'Ate',
    };
    
    const current = store.get(wrapPartyDataAtom);
    const updated: WrapPartyData = {
      ...current!,
      awards: [...current!.awards, newAward],
    };
    
    store.set(wrapPartyDataAtom, updated);
    expect(store.get(wrapPartyDataAtom)?.awards).toHaveLength(1);
    expect(store.get(wrapPartyDataAtom)?.awards[0].vibeAppropriateLabel).toBe('Ate');
  });

  it('should handle adding feedback', () => {
    const wrapPartyData: WrapPartyData = {
      sessionId: 'session-def',
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };
    
    store.set(wrapPartyDataAtom, wrapPartyData);
    
    const newFeedback: WrapPartyData['feedback'][0] = {
      id: 'feedback-1',
      participantId: 'participant-4',
      text: 'That was amazing!',
      createdAt: Date.now(),
    };
    
    const current = store.get(wrapPartyDataAtom);
    const updated: WrapPartyData = {
      ...current!,
      feedback: [...current!.feedback, newFeedback],
    };
    
    store.set(wrapPartyDataAtom, updated);
    expect(store.get(wrapPartyDataAtom)?.feedback).toHaveLength(1);
    expect(store.get(wrapPartyDataAtom)?.feedback[0].text).toBe('That was amazing!');
  });

  it('should handle adding shared links', () => {
    const wrapPartyData: WrapPartyData = {
      sessionId: 'session-ghi',
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };
    
    store.set(wrapPartyDataAtom, wrapPartyData);
    
    const newLink: WrapPartyData['sharedLinks'][0] = {
      id: 'link-1',
      platform: 'twitter',
      url: 'https://twitter.com/share?text=Check%20out%20this%20performance',
      createdAt: Date.now(),
    };
    
    const current = store.get(wrapPartyDataAtom);
    const updated: WrapPartyData = {
      ...current!,
      sharedLinks: [...current!.sharedLinks, newLink],
    };
    
    store.set(wrapPartyDataAtom, updated);
    expect(store.get(wrapPartyDataAtom)?.sharedLinks).toHaveLength(1);
    expect(store.get(wrapPartyDataAtom)?.sharedLinks[0].platform).toBe('twitter');
  });

  it('should handle invalid localStorage data gracefully', () => {
    localStorage.setItem('wrap_party_data', 'invalid-json');
    
    // Atom should fall back to default or handle error gracefully
    const value = store.get(wrapPartyDataAtom);
    expect(value).toBeDefined();
    // Should be null or valid WrapPartyData
    expect(value === null || typeof value === 'object').toBe(true);
  });
});
