/**
 * Session Lookup API Route
 * 
 * Validates and retrieves session data by session ID.
 * Checks if session exists, is not expired, and returns session details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionCodeSecurity, generateShareableLink } from '@/src/lib/utils/session-code';
import type { SessionStatus } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';
import type { SessionConfiguration } from '@/src/lib/validation/session-config-schema';
import type { Character, Script } from '@/src/state/types/session';

/**
 * Get PartyKit host URL
 */
function getPartyKitHost(): string | null {
  // In production/serverless, use PartyKit's HTTP API URL
  if (process.env.PARTYKIT_HTTP_HOST) {
    return process.env.PARTYKIT_HTTP_HOST;
  }
  
  // In development, default to localhost
  const partyKitHost = process.env.PARTYKIT_HOST || process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';
  const protocol = partyKitHost.includes('localhost') || partyKitHost.includes('127.0.0.1') ? 'http' : 'https';
  return partyKitHost.startsWith('http') ? partyKitHost : `${protocol}://${partyKitHost}`;
}

/**
 * Query PartyKit server for session data
 * PartyKit is the single source of truth for all session data
 */
async function getSessionFromPartyKit(sessionId: string) {
  const host = getPartyKitHost();
  
  if (!host) {
    console.warn('PartyKit host not configured');
    return null;
  }

  try {
    // Query PartyKit session endpoint
    // URL format: /parties/:party/:roomId
    // Our party is "main" (default from partykit.json), roomId is sessionId
    // The onRequest handler in session.ts handles GET requests to return session data
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${host}/parties/main/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Session not found
      }
      // For other errors, log but don't throw
      console.warn('PartyKit session lookup failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.session || null;
  } catch (error) {
    // Handle connection errors gracefully
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('PartyKit request timeout - server may not be running');
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        console.warn('PartyKit server not available - is it running? Run: npm run dev:partykit');
      } else {
        console.error('Error querying PartyKit for session:', error.message);
      }
    } else {
      console.error('Error querying PartyKit for session:', error);
    }
    return null;
  }
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

    // Query PartyKit (single source of truth)
    const session = await getSessionFromPartyKit(sessionId);

    if (!session) {
      // Check if PartyKit is available - if host is null, it's a config issue
      const host = getPartyKitHost();
      if (!host) {
        return NextResponse.json(
          {
            error: 'Service unavailable',
            message: 'PartyKit host not configured. Set PARTYKIT_HOST or PARTYKIT_HTTP_HOST environment variable.',
          },
          { status: 503 }
        );
      }
      
      // If we got here, PartyKit returned null (session not found or connection failed)
      // Return 404 for session not found, but the error logs will show if it's a connection issue
      return NextResponse.json(
        {
          error: 'Session not found',
          message: 'The session may not exist, or PartyKit server may not be running. Check server logs for details.',
        },
        { status: 404 }
      );
    }

    // PartyKit already checks expiration, but double-check here
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

    // Return session data from PartyKit
    return NextResponse.json(
      {
        session: {
          id: session.id,
          shareableLink: generateShareableLink(session.id),
          vibeContext: session.vibeContext,
          status: session.status,
          configuration: session.configuration || null,
          cast: session.cast || [],
          script: session.script || null,
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

// No longer exporting sessionStore - PartyKit is the single source of truth
