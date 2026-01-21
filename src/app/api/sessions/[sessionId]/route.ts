/**
 * Session Lookup API Route
 * 
 * Validates and retrieves session data by session ID.
 * Checks if session exists, is not expired, and returns session details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionCodeSecurity } from '@/src/lib/utils/session-code';
import type { SessionStatus } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';
import type { SessionConfiguration } from '@/src/lib/validation/session-config-schema';
import type { Character, Script } from '@/src/state/types/session';

// In-memory session store (MVP - will be replaced with database in post-MVP)
// This simulates server-side session storage
const sessionStore = new Map<string, SessionData>();

interface SessionData {
  id: string;
  shareableLink: string;
  vibeContext: VibeType;
  directorId: string;
  configuration: SessionConfiguration;
  status: SessionStatus;
  createdAt: number;
  expiresAt: number;
  cast: Character[];
  script: Script | null;
  performanceProgress: {
    currentLineIndex: number;
    currentScene: number;
    startedAt: number | null;
    pausedAt: number | null;
    completedLines: number[];
    advancementControl: {
      lastAdvancedBy: string;
      lastAdvancedAt: number;
      directorOverride: boolean;
    };
  };
  wrapPartyData: unknown | null;
}

/**
 * Get session from store (MVP implementation)
 * In post-MVP, this will query a database
 */
function getSession(sessionId: string): SessionData | null {
  return sessionStore.get(sessionId) || null;
}

/**
 * POST /api/sessions/[sessionId]
 * 
 * Validates session code and returns session data if valid.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Validate session code format
    if (!validateSessionCodeSecurity(sessionId)) {
      return NextResponse.json(
        {
          error: 'Invalid session code format',
          message: 'Session code must be 8-10 alphanumeric characters',
        },
        { status: 400 }
      );
    }

    // Look up session
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        {
          error: 'Session not found',
        },
        { status: 404 }
      );
    }

    // Check if session is expired
    const now = Date.now();
    if (now > session.expiresAt || session.status === 'expired') {
      return NextResponse.json(
        {
          error: 'Session expired',
          message: 'This session has expired. Sessions expire after 24 hours.',
        },
        { status: 410 }
      );
    }

    // Return session data (excluding sensitive information)
    return NextResponse.json(
      {
        session: {
          id: session.id,
          shareableLink: session.shareableLink,
          vibeContext: session.vibeContext,
          status: session.status,
          configuration: session.configuration,
          cast: session.cast,
          script: session.script,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Session lookup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to lookup session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export session store for use in other routes (join route, etc.)
export { sessionStore, getSession };
export type { SessionData };
