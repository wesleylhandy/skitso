/**
 * Join Page Reliability Tests
 *
 * Covers:
 * - PartyKit state:recovered with expired vs active sessions
 * - REST fallback with expired session and network failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import type { VibeType } from '@/src/state/types/vibe';

import SessionJoinPage from './page';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';

// Jotai store for asserting atom effects
const store = getDefaultStore();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock useVibe to provide stable text + error messages
vi.mock('@/src/lib/hooks/use-vibe', () => ({
  useVibe: () => ({
    visualTokens: {
      bgColor: '#000000',
      textColor: '#ffffff',
    },
    getSectionTitle: (key: string) => key,
    getErrorMessage: (key: string) => key,
  }),
}));

// Spy PartyKit client wiring for state:recovered tests
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
  fetchSessionState: vi.fn(() => Promise.resolve(null)),
  onPerformanceStart: vi.fn(() => vi.fn()),
  onCharacterAssigned: vi.fn(() => vi.fn()),
  onAssignmentApproved: vi.fn(() => vi.fn()),
  onAssignmentSuggested: vi.fn(() => vi.fn()),
  onAssignmentConfirmed: vi.fn(() => vi.fn()),
  onScriptUpdate: vi.fn(() => vi.fn()),
  onCastUpdate: vi.fn(() => vi.fn()),
  onSessionStateUpdate: vi.fn(() => vi.fn()),
  onReconnect: vi.fn(() => vi.fn()),
  joinSession: vi.fn(),
}));

// Mock clearSessionState to avoid touching real localStorage
const clearSessionStateMock = vi.fn();
vi.mock('@/src/lib/utils/session-state-cleanup', () => ({
  clearSessionState: () => clearSessionStateMock(),
}));

// Helper to render the page with a given session code
function renderJoinPage(sessionCode: string) {
  const paramsPromise = Promise.resolve({ sessionCode });
  return render(<SessionJoinPage params={paramsPromise} />);
}

describe('SessionJoinPage reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      window.fetch = vi.fn();
      window.localStorage.clear();
    }
    store.set(vibeAtom, 'VIRAL_NEON');
    store.set(sessionCodeAtom, null);
    store.set(sessionStateAtom, 'idle');
    addEventListenerSpy.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles PartyKit state:recovered with expired session by clearing state and showing sessionExpired message', async () => {
    renderJoinPage('EXPIRED123');

    // Capture message listener registered by component
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
    const onMessage = addEventListenerSpy.mock.calls.find(
      (call) => call[0] === 'message',
    )?.[1] as (event: MessageEvent) => void;

    // Simulate PartyKit sending an expired state:recovered payload
    const payload = {
      type: 'state:recovered',
      data: {
        sessionId: 'EXPIRED123',
        vibeContext: 'VIRAL_NEON' as VibeType,
        status: 'expired',
        participants: [],
        isExpired: true,
        expiresAt: Date.now() - 1000,
      },
    };

    onMessage({
      data: JSON.stringify(payload),
    } as MessageEvent);

    await waitFor(() => {
      // Error UI should render with sessionExpired key
      expect(screen.getByText('sessionExpired')).toBeInTheDocument();
    });

    // clearSessionState should have been called
    expect(clearSessionStateMock).toHaveBeenCalled();
    // Local session state should be reset
    expect(store.get(sessionStateAtom)).toBe('idle');
  });

  it('maps REST fallback session-expired error to sessionExpired message and clears state', async () => {
    const fetchMock = window.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Session expired' }),
    } as Response);

    renderJoinPage('RESTEXPIRED');

    await waitFor(() => {
      expect(screen.getByText('sessionExpired')).toBeInTheDocument();
    });

    expect(clearSessionStateMock).toHaveBeenCalled();
  });

  it('maps network failure in REST fallback to network error message', async () => {
    const fetchMock = window.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new TypeError('Network error'));

    renderJoinPage('NETFAIL123');

    await waitFor(() => {
      expect(screen.getByText('network')).toBeInTheDocument();
    });
  });
});

/**
 * Session Join Page Tests
 *
 * The main behavioral tests for the dynamic session join page route
 * live in a separate file:
 * `page.behavior.test.tsx`.
 *
 * This file is reserved for reliability tests focused on
 * execution patterns (PartyKit vs REST, expiration handling).
 */
