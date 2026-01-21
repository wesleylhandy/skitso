/**
 * Session Creation API Route
 * 
 * Creates a new session with the provided configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSessionCodeSecurity } from '@/src/lib/utils/session-code';
import { generateShareableLink } from '@/src/lib/utils/session-code';
import { sessionStore, type SessionData } from './[sessionId]/route';
import type { SessionStatus } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';
import type { SessionConfiguration } from '@/src/lib/validation/session-config-schema';
import type { Character, Script } from '@/src/state/types/session';

const CreateSessionSchema = z.object({
  sessionId: z.string().min(8).max(10),
  vibeContext: z.string(),
  configuration: z.object({
    theme: z.string(),
    tone: z.string(),
    participantCount: z.number(),
    chaosLevel: z.number().optional(),
  }),
  cast: z.array(z.any()).optional(),
  script: z.any().optional(),
});

/**
 * POST /api/sessions
 * 
 * Creates a new session with the provided configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateSessionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validated.error.issues,
        },
        { status: 400 }
      );
    }

    const { sessionId, vibeContext, configuration, cast, script } = validated.data;

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

    // Check if session already exists
    if (sessionStore.has(sessionId)) {
      return NextResponse.json(
        {
          error: 'Session already exists',
        },
        { status: 409 }
      );
    }

    // Create session data
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    const session: SessionData = {
      id: sessionId,
      shareableLink: generateShareableLink(sessionId),
      vibeContext: vibeContext as VibeType,
      directorId: 'director', // Will be set properly when director joins
      configuration: configuration as SessionConfiguration,
      status: 'casting' as SessionStatus,
      createdAt: now,
      expiresAt,
      cast: (cast || []) as Character[],
      script: (script || null) as Script | null,
      performanceProgress: {
        currentLineIndex: 0,
        currentScene: 0,
        startedAt: null,
        pausedAt: null,
        completedLines: [],
        advancementControl: {
          lastAdvancedBy: '',
          lastAdvancedAt: 0,
          directorOverride: false,
        },
      },
      wrapPartyData: null,
    };

    // Store session
    sessionStore.set(sessionId, session);

    return NextResponse.json(
      {
        session: {
          id: session.id,
          shareableLink: session.shareableLink,
          vibeContext: session.vibeContext,
          status: session.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
