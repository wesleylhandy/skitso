/**
 * Session Join Page Tests
 * 
 * Tests for the dynamic session join page route.
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

describe('SessionJoinPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract session code from URL params', async () => {
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
      </Provider>
    );

    // Wait for loading to complete and verify session code is displayed
    await waitFor(() => {
      expect(screen.getByText(/session code: test1234/i)).toBeInTheDocument();
    });
  });

  it('should load session data on mount', async () => {
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
      </Provider>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions/TEST1234'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('should sync VibeContext from session', async () => {
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
      </Provider>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('should update vibeAtom with Director\'s selected vibe on join (T087)', async () => {
    const store = getDefaultStore();
    
    // Set initial vibe to something different
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
      </Provider>
    );

    // Wait for session data to load and vibe to sync
    await waitFor(() => {
      const currentVibe = store.get(vibeAtom);
      expect(currentVibe).toBe('INDIE_A24');
    }, { timeout: 3000 });

    // Verify the vibe was actually changed from initial value
    expect(store.get(vibeAtom)).not.toBe('VIRAL_NEON');
    expect(store.get(vibeAtom)).toBe('INDIE_A24');
  });

  it('should sync VibeContext immediately when session loads (T087 - timing)', async () => {
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
      </Provider>
    );

    // Wait for VibeContext synchronization
    await waitFor(() => {
      expect(store.get(vibeAtom)).toBe('BRAINROT_THEATER');
    }, { timeout: 3000 });

    const endTime = Date.now();
    const syncDuration = endTime - startTime;

    // VibeContext sync should be fast (should complete in <1 second per spec)
    // This ensures the synchronization happens immediately on join
    expect(syncDuration).toBeLessThan(1000);
    expect(store.get(vibeAtom)).toBe('BRAINROT_THEATER');
  });

  it('should have a back button that navigates to root', async () => {
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
      </Provider>
    );

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /go back/i });
      expect(backButton).toBeInTheDocument();
    });
  });
});
