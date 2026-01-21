/**
 * Voting Interface Component Tests
 * 
 * Tests for the wrap party voting interface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { VotingInterface } from './voting-interface';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import type { Character } from '@/src/state/types/session';

// Mock PartyKit client
vi.mock('@/src/lib/partykit/client', () => ({
  initializePartyKitClient: vi.fn(),
  getPartyKitClient: vi.fn(() => ({
    readyState: WebSocket.OPEN,
    room: 'test-room',
    send: vi.fn(),
    close: vi.fn(),
  })),
  isPartyKitConnected: vi.fn(() => true),
  onWrapPartyVote: vi.fn(() => () => {}),
  submitVote: vi.fn(),
  getConnectionStatus: vi.fn(() => 'connected'),
}));

const mockCharacters: Character[] = [
  {
    id: 'char-1',
    sessionId: 'session-1',
    participantId: 'participant-1',
    name: 'Character One',
    archetypeLabel: 'The Main Character',
    personalityTraits: ['funny', 'bold'],
    hiddenMotivation: 'To win',
    visualRepresentation: {
      imageUrl: 'https://example.com/char1.jpg',
      imagePrompt: 'A character',
    },
    dialogueLines: [0, 2],
  },
  {
    id: 'char-2',
    sessionId: 'session-1',
    participantId: 'participant-2',
    name: 'Character Two',
    archetypeLabel: 'The Sidekick',
    personalityTraits: ['loyal', 'funny'],
    hiddenMotivation: 'To help',
    visualRepresentation: {
      imageUrl: 'https://example.com/char2.jpg',
      imagePrompt: 'Another character',
    },
    dialogueLines: [1, 3],
  },
];

describe('VotingInterface', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(wrapPartyDataAtom, null);
    store.set(participantAtom, {
      id: 'participant-1',
      sessionId: 'session-1',
      role: 'actor',
      name: 'Test Actor',
      characterAssignment: mockCharacters[0],
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      deviceInfo: {
        userAgent: 'test',
        screenSize: '1920x1080',
        timezone: 'UTC',
      },
    });
    store.set(sessionCodeAtom, 'session-1');
    store.set(castAtom, mockCharacters);
    store.set(vibeAtom, 'VIRAL_NEON');
  });

  it('should render overall quality voting', () => {
    render(<VotingInterface />);
    expect(screen.getByText(/overall quality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/1 star/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/5 stars/i)).toBeInTheDocument();
  });

  it('should render favorite moment voting', () => {
    render(<VotingInterface />);
    expect(screen.getByText(/favorite moment/i)).toBeInTheDocument();
  });

  it('should render best actor voting', () => {
    render(<VotingInterface />);
    expect(screen.getByText(/best actor/i)).toBeInTheDocument();
    // Should show character options
    expect(screen.getByText(/character one/i)).toBeInTheDocument();
    expect(screen.getByText(/character two/i)).toBeInTheDocument();
  });

  it('should render funniest moment voting', () => {
    render(<VotingInterface />);
    expect(screen.getByText(/funniest moment/i)).toBeInTheDocument();
  });

  it('should allow selecting overall quality rating', async () => {
    render(<VotingInterface />);
    const star5 = screen.getByLabelText(/5 stars/i);
    fireEvent.click(star5);
    
    await waitFor(() => {
      const data = store.get(wrapPartyDataAtom);
      expect(data).toBeTruthy();
      expect(data?.votes).toHaveLength(1);
      expect(data?.votes[0].category).toBe('overall_quality');
      expect(data?.votes[0].value).toBe(5);
    });
  });

  it('should allow selecting best actor', async () => {
    render(<VotingInterface />);
    const char1Button = screen.getByRole('button', { name: /character one/i });
    fireEvent.click(char1Button);
    
    await waitFor(() => {
      const data = store.get(wrapPartyDataAtom);
      expect(data).toBeTruthy();
      const bestActorVote = data?.votes.find(v => v.category === 'best_actor');
      expect(bestActorVote).toBeTruthy();
      expect(bestActorVote?.targetId).toBe('char-1');
    });
  });

  it('should display real-time vote results', async () => {
    // Set initial wrap party data with votes
    store.set(wrapPartyDataAtom, {
      sessionId: 'session-1',
      votes: [
        {
          id: 'vote-1',
          participantId: 'participant-2',
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
    });

    render(<VotingInterface />);
    
    // Should show vote count or results
    await waitFor(() => {
      // Results should be visible
      expect(screen.getByText(/results/i)).toBeInTheDocument();
    });
  });

  it('should prevent duplicate votes in same category', async () => {
    render(<VotingInterface />);
    
    // Vote once
    const star5 = screen.getByLabelText(/5 stars/i);
    fireEvent.click(star5);
    
    await waitFor(() => {
      const data = store.get(wrapPartyDataAtom);
      expect(data?.votes).toHaveLength(1);
    });

    // Try to vote again
    const star4 = screen.getByLabelText(/4 stars/i);
    fireEvent.click(star4);
    
    await waitFor(() => {
      const data = store.get(wrapPartyDataAtom);
      // Should update existing vote, not add new one
      expect(data?.votes).toHaveLength(1);
      expect(data?.votes[0].value).toBe(4);
    });
  });
});
