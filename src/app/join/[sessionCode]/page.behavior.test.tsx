/**
 * Session Join Page Behavioral Tests
 *
 * Tests for the dynamic session join page route covering:
 * - Session code extraction
 * - REST fallback loading
 * - VibeContext synchronization (T087)
 * - Basic navigation affordances
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SessionJoinPage from './page';
import { Provider, getDefaultStore } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionCode: 'TEST1234' }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('SessionJoinPage behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts session code from URL params and displays it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'TEST1234',
          vibeContext: 'VIRAL_NEON',
          status: 'casting',
        },
      }),
    } as Response);

    render(
      <Provider>
        <SessionJoinPage params={Promise.resolve({ sessionCode: 'TEST1234' })} />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/session code: test1234/i)).toBeInTheDocument();
    });
  });

  it('loads session data on mount via REST fallback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'TEST1234',
          vibeContext: 'VIRAL_NEON',
          status: 'casting',
        },
      }),
    } as Response);

    render(
      <Provider>
        <SessionJoinPage params={Promise.resolve({ sessionCode: 'TEST1234' })} />
      </Provider>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/TEST1234'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('syncs VibeContext from session on load', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'TEST1234',
          vibeContext: 'INDIE_A24',
          status: 'casting',
        },
      }),
    } as Response);

    render(
      <Provider>
        <SessionJoinPage params={Promise.resolve({ sessionCode: 'TEST1234' })} />
      </Provider>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it("updates vibeAtom with Director's selected vibe on join (T087)", async () => {
    const store = getDefaultStore();

    store.set(vibeAtom, 'VIRAL_NEON');
    expect(store.get(vibeAtom)).toBe('VIRAL_NEON');

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'TEST1234',
          vibeContext: 'INDIE_A24',
          status: 'casting',
        },
      }),
    } as Response);

    render(
      <Provider store={store}>
        <SessionJoinPage params={Promise.resolve({ sessionCode: 'TEST1234' })} />
      </Provider>,
    );

    await waitFor(
      () => {
        const currentVibe = store.get(vibeAtom);
        expect(currentVibe).toBe('INDIE_A24');
      },
      { timeout: 3000 },
    );

    expect(store.get(vibeAtom)).not.toBe('VIRAL_NEON');
    expect(store.get(vibeAtom)).toBe('INDIE_A24');
  });

  it('syncs VibeContext quickly when session loads (T087 - timing)', async () => {
    const store = getDefaultStore();
    store.set(vibeAtom, 'SITCOM_STUDIO');

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'TEST1234',
          vibeContext: 'BRAINROT_THEATER',
          status: 'casting',
        },
      }),
    } as Response);

    const startTime = Date.now();

    render(
      <Provider store={store}>
        <SessionJoinPage params={Promise.resolve({ sessionCode: 'TEST1234' })} />
      </Provider>,
    );

    await waitFor(
      () => {
        expect(store.get(vibeAtom)).toBe('BRAINROT_THEATER');
      },
      { timeout: 3000 },
    );

    const endTime = Date.now();
    const syncDuration = endTime - startTime;

    expect(syncDuration).toBeLessThan(1000);
    expect(store.get(vibeAtom)).toBe('BRAINROT_THEATER');
  });

  it('renders a back button that navigates to root', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: {
          id: 'TEST1234',
          vibeContext: 'VIRAL_NEON',
          status: 'casting',
        },
      }),
    } as Response);

    render(
      <Provider>
        <SessionJoinPage params={Promise.resolve({ sessionCode: 'TEST1234' })} />
      </Provider>,
    );

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /go back/i });
      expect(backButton).toBeInTheDocument();
    });
  });
});

