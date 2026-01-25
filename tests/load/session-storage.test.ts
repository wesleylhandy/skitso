import { describe, it, expect } from 'vitest';
import {
  saveSessionData,
  loadSessionData,
  cleanupStaleSessionData,
} from '@/src/lib/utils/session-storage';

/**
 * T181c: Session storage scaling test scaffold.
 */

describe('T181c: Session storage helpers', () => {
  it('saves and loads session data correctly', () => {
    const sessionId = 'test-session-storage';
    saveSessionData(sessionId, { value: 42 });
    const loaded = loadSessionData<{ value: number }>(sessionId);
    expect(loaded).not.toBeNull();
    expect(loaded?.value.value).toBe(42);
  });

  it('cleans up stale session data', () => {
    const sessionId = 'stale-session';
    saveSessionData(sessionId, { value: 1 });

    // Simulate staleness by manually back-dating updatedAt
    const key = Object.keys(window.localStorage).find((k) =>
      k.includes('skitso_session_data_'),
    );
    if (key) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { updatedAt: number; value: unknown };
        parsed.updatedAt = Date.now() - 60 * 60 * 1000; // 1 hour ago
        window.localStorage.setItem(key, JSON.stringify(parsed));
      }
    }

    const removed = cleanupStaleSessionData(30 * 60 * 1000); // 30 minutes
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});

