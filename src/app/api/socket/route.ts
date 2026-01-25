/**
 * PartyKit API Route Handler
 * 
 * Note: This endpoint is deprecated. Real-time synchronization is now handled
 * by PartyKit server (parties/session.ts). This route is kept for backwards
 * compatibility but should not be used in new code.
 * 
 * For real-time features, use the PartyKit client from src/lib/partykit/client.ts
 */

import { NextResponse } from 'next/server';

/**
 * GET /api/socket
 * 
 * Deprecated endpoint - PartyKit migration complete
 */
export async function GET() {
  return NextResponse.json(
    {
      message: 'This endpoint is deprecated',
      status: 'migrated',
      note: 'Real-time synchronization is now handled by PartyKit. Use src/lib/partykit/client.ts instead.',
    },
    { status: 200 }
  );
}

/**
 * POST /api/socket
 * 
 * Deprecated endpoint - PartyKit migration complete
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Deprecated endpoint',
      message: 'This endpoint is deprecated. Use PartyKit client for real-time features.',
    },
    { status: 410 } // 410 Gone
  );
}
