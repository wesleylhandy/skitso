import { describe, it, expect, beforeEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { castAtom } from './cast-atom';
import type { Character } from '../types/session';

describe('castAtom', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(castAtom, []);
  });

  it('should default to empty array', () => {
    const value = store.get(castAtom);
    expect(value).toEqual([]);
  });

  it('should persist cast to localStorage', async () => {
    const cast: Character[] = [
      {
        id: 'char1',
        sessionId: 'session1',
        participantId: null,
        name: 'Zayden',
        archetypeLabel: 'The Main Character',
        personalityTraits: ['confident', 'trend-obsessed'],
        hiddenMotivation: 'Wants to prove they are not a one-hit wonder',
        visualRepresentation: {
          imageUrl: 'https://example.com/image1.jpg',
          imagePrompt: 'A confident person',
        },
        dialogueLines: [0, 2, 4],
      },
    ];

    store.set(castAtom, cast);
    
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const stored = localStorage.getItem('cast');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed).toEqual(cast);
        resolve();
      }, 100);
    });
  });

  it('should handle cast updates correctly', () => {
    const cast1: Character[] = [
      {
        id: 'char1',
        sessionId: 'session1',
        participantId: null,
        name: 'Zayden',
        archetypeLabel: 'The Main Character',
        personalityTraits: ['confident'],
        hiddenMotivation: 'Wants to prove themselves',
        visualRepresentation: {
          imageUrl: 'https://example.com/image1.jpg',
          imagePrompt: 'A confident person',
        },
        dialogueLines: [0, 2],
      },
    ];

    const cast2: Character[] = [
      ...cast1,
      {
        id: 'char2',
        sessionId: 'session1',
        participantId: null,
        name: 'Riley',
        archetypeLabel: 'The Sidekick',
        personalityTraits: ['loyal'],
        hiddenMotivation: 'Wants to be the main character',
        visualRepresentation: {
          imageUrl: 'https://example.com/image2.jpg',
          imagePrompt: 'A supportive friend',
        },
        dialogueLines: [1, 3],
      },
    ];

    store.set(castAtom, cast1);
    expect(store.get(castAtom)).toEqual(cast1);

    store.set(castAtom, cast2);
    expect(store.get(castAtom)).toEqual(cast2);
  });

  it('should handle empty cast array', () => {
    store.set(castAtom, []);
    expect(store.get(castAtom)).toEqual([]);
  });
});
