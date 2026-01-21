/**
 * Session Join API Route
 * 
 * Handles participant joining a session and automatic character assignment.
 * Creates participant record and assigns available character if cast exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, sessionStore, type SessionData } from '../route';
import type { Participant, Character } from '@/src/state/types/session';

const JoinRequestSchema = z.object({
  name: z.string().min(1).max(50),
  deviceInfo: z.object({
    userAgent: z.string(),
    screenSize: z.string(),
    timezone: z.string(),
  }),
});

/**
 * Generates a unique participant ID
 */
function generateParticipantId(): string {
  return `participant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Assigns an available character to a participant
 * Returns the assigned character or null if none available
 */
function assignCharacter(session: SessionData, participantId: string): Character | null {
  // Find first unassigned character
  const unassignedChar = session.cast.find(
    (char) => char.participantId === null
  );

  if (!unassignedChar) {
    return null;
  }

  // Assign character to participant
  unassignedChar.participantId = participantId;

  // Update session in store
  sessionStore.set(session.id, session);

  return unassignedChar;
}

/**
 * POST /api/sessions/[sessionId]/join
 * 
 * Joins a participant to a session and assigns a character if available.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Validate session exists
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
        },
        { status: 410 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = JoinRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validated.error.issues,
        },
        { status: 400 }
      );
    }

    const { name, deviceInfo } = validated.data;

    // Generate participant ID
    const participantId = generateParticipantId();

    // Assign character if available
    const characterAssignment = assignCharacter(session, participantId);

    // Create participant record
    const participant: Participant = {
      id: participantId,
      sessionId: session.id,
      role: 'actor', // Director is set when session is created
      name,
      characterAssignment,
      connectionStatus: 'connected',
      joinedAt: now,
      deviceInfo,
    };

    // Return participant data
    return NextResponse.json(
      {
        participant,
        session: {
          id: session.id,
          vibeContext: session.vibeContext,
          status: session.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Session join error:', error);
    return NextResponse.json(
      {
        error: 'Failed to join session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
