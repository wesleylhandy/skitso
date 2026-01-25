/**
 * Session metrics (T181).
 *
 * Tracks approximate session counts and activity locally. For a
 * production deployment this would typically be backed by a
 * centralized metrics store; here we keep the implementation
 * intentionally simple and client-safe.
 */

const SESSION_METRICS_KEY = 'skitso_session_metrics';

export interface SessionMetricsSnapshot {
  activeSessions: number;
  totalSessionsCreated: number;
  updatedAt: number;
}

function readSnapshot(): SessionMetricsSnapshot {
  if (typeof window === 'undefined') {
    return {
      activeSessions: 0,
      totalSessionsCreated: 0,
      updatedAt: Date.now(),
    };
  }

  try {
    const stored = window.localStorage.getItem(SESSION_METRICS_KEY);
    if (!stored) {
      return {
        activeSessions: 0,
        totalSessionsCreated: 0,
        updatedAt: Date.now(),
      };
    }
    return JSON.parse(stored) as SessionMetricsSnapshot;
  } catch {
    return {
      activeSessions: 0,
      totalSessionsCreated: 0,
      updatedAt: Date.now(),
    };
  }
}

function writeSnapshot(snapshot: SessionMetricsSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_METRICS_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort only; ignore storage failures
  }
}

export function incrementSessionCount(): SessionMetricsSnapshot {
  const current = readSnapshot();
  const next: SessionMetricsSnapshot = {
    activeSessions: current.activeSessions + 1,
    totalSessionsCreated: current.totalSessionsCreated + 1,
    updatedAt: Date.now(),
  };
  writeSnapshot(next);
  return next;
}

export function decrementSessionCount(): SessionMetricsSnapshot {
  const current = readSnapshot();
  const next: SessionMetricsSnapshot = {
    activeSessions: Math.max(0, current.activeSessions - 1),
    totalSessionsCreated: current.totalSessionsCreated,
    updatedAt: Date.now(),
  };
  writeSnapshot(next);
  return next;
}

export function getSessionMetrics(): SessionMetricsSnapshot {
  return readSnapshot();
}

