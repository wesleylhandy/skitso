/**
 * Session Creation API Route
 * 
 * Creates a new session with the provided configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSessionCodeSecurity } from '@/src/lib/utils/session-code';
import { SessionConfigurationSchema } from '@/src/lib/validation/session-config-schema';

const CreateSessionSchema = z.object({
  sessionId: z.string().min(8).max(10),
  vibeContext: z.string(),
  configuration: SessionConfigurationSchema,
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

    // Proxy to PartyKit - PartyKit is the single source of truth
    const partyKitHost = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';
    const protocol = partyKitHost.includes('localhost') || partyKitHost.includes('127.0.0.1') ? 'http' : 'https';
    const host = partyKitHost.startsWith('http') ? partyKitHost : `${protocol}://${partyKitHost}`;

    try {
      const response = await fetch(`${host}/parties/main/${sessionId}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          vibeContext,
          configuration,
          cast,
          script,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json(
          {
            error: errorData.error || 'Failed to create session',
            message: errorData.message,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 201 });
    } catch (error) {
      console.error('PartyKit session creation error:', error);
      return NextResponse.json(
        {
          error: 'Failed to create session',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
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
