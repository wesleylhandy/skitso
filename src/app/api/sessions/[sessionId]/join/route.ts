/**
 * Session Join API Route
 * 
 * Handles participant joining a session and automatic character assignment.
 * Creates participant record and assigns available character if cast exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const JoinRequestSchema = z.object({
  name: z.string().min(1).max(50),
  deviceInfo: z.object({
    userAgent: z.string(),
    screenSize: z.string(),
    timezone: z.string(),
  }),
});

/**
 * Get PartyKit host URL
 */
function getPartyKitHost(): string {
  const partyKitHost = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';
  const protocol = partyKitHost.includes('localhost') || partyKitHost.includes('127.0.0.1') ? 'http' : 'https';
  return partyKitHost.startsWith('http') ? partyKitHost : `${protocol}://${partyKitHost}`;
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

    // Proxy to PartyKit - PartyKit handles session validation and character assignment
    const host = getPartyKitHost();

    try {
      const response = await fetch(`${host}/parties/main/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          name,
          deviceInfo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json(
          {
            error: errorData.error || 'Failed to join session',
            message: errorData.message,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 200 });
    } catch (error) {
      console.error('PartyKit session join error:', error);
      return NextResponse.json(
        {
          error: 'Failed to join session',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
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
