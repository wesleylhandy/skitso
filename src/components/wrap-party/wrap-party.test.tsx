/**
 * WrapParty lifecycle tests
 *
 * Verifies that PartyKit state:recovered hydrates vibe + wrapPartyData.
 * Cleanup is deferred until user explicitly leaves (e.g. "Start new skit").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';

import { WrapParty } from './wrap-party';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { wrapPartyDataAtom } from '@/src/state/atoms/wrap-party-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import type { WrapPartyData } from '@/src/state/types/session';

const store = getDefaultStore();

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));

vi.mock('@/src/lib/hooks/use-vibe', () => ({
  useVibe: () => ({
    visualTokens: {
      bgColor: '#000000',
      primaryColor: '#ffffff',
      bodyFont: 'system-ui',
      errorColor: '#ef4444',
    },
    getSectionTitle: (key: string) => key,
    getButtonLabel: (key: string) => key,
  }),
}));

vi.mock('@/src/lib/utils/session-cleanup', () => ({
  cleanupOnWrapPartyCompletion: vi.fn(),
}));

const addEventListenerSpy = vi.fn();
const mockClient = {
  readyState: WebSocket.OPEN,
  send: vi.fn(),
  addEventListener: addEventListenerSpy,
  removeEventListener: vi.fn(),
} as unknown as WebSocket;

vi.mock('@/src/lib/partykit/client', () => ({
  initializePartyKitClient: vi.fn(() => mockClient),
  getPartyKitClient: vi.fn(() => mockClient),
  onSessionStateUpdate: vi.fn(() => vi.fn()),
  fetchSessionState: vi.fn(),
  updateSessionState: vi.fn(),
  endSession: vi.fn(),
  disconnectPartyKit: vi.fn(),
}));

describe('WrapParty lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    store.set(sessionCodeAtom, 'WRAP1234');
    store.set(sessionStateAtom, 'completed');
    store.set(wrapPartyDataAtom, null);
    store.set(vibeAtom, 'VIRAL_NEON');
    addEventListenerSpy.mockReset();
  });

  it('hydrates from PartyKit state:recovered (vibe + wrapPartyData)', async () => {
    render(<WrapParty sessionCode="WRAP1234" />);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
    const onMessage = addEventListenerSpy.mock.calls.find(
      (call) => call[0] === 'message',
    )?.[1] as (event: MessageEvent) => void;

    const wrapData: WrapPartyData = {
      sessionId: 'WRAP1234',
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: Date.now(),
    };

    onMessage({
      data: JSON.stringify({
        type: 'state:recovered',
        data: {
          sessionId: 'WRAP1234',
          vibeContext: 'INDIE_A24',
          wrapPartyData: wrapData,
        },
      }),
    } as MessageEvent);

    await waitFor(() => {
      expect(store.get(vibeAtom)).toBe('INDIE_A24');
      expect(store.get(wrapPartyDataAtom)?.sessionId).toBe('WRAP1234');
    });
  });
});

