/**
 * Socket.io API Route Handler
 * 
 * Note: Next.js App Router doesn't support WebSocket upgrades directly.
 * This route handler works with a custom server setup (see server.ts in project root).
 * 
 * For production on Vercel, consider:
 * - Using a separate Socket.io server
 * - Using Server-Sent Events (SSE) as an alternative
 * - Using polling-only mode
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/socket
 * 
 * Health check endpoint for Socket.io server
 */
export async function GET() {
  return NextResponse.json(
    {
      message: 'Socket.io server endpoint',
      status: 'active',
      note: 'This endpoint requires a custom server setup for WebSocket support',
    },
    { status: 200 }
  );
}

/**
 * POST /api/socket
 * 
 * Fallback endpoint for Socket.io (when WebSocket is not available)
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'WebSocket connection required',
      message: 'Socket.io requires WebSocket support. Please use the custom server setup.',
    },
    { status: 426 } // 426 Upgrade Required
  );
}
