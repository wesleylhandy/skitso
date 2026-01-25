/**
 * Delete Cloudinary images for a session (party room).
 *
 * Called by PartyKit when a session is closed (e.g. expiry). Secured by
 * x-internal-secret. Requires INTERNAL_API_SECRET and Cloudinary config.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isCloudinaryConfigured,
  deleteSessionImages,
} from '@/src/lib/cloudinary/client';

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  const headerSecret = request.headers.get('x-internal-secret');

  if (!secret || headerSecret !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as { sessionId?: string };
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : undefined;
  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    await deleteSessionImages(sessionId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('[cloudinary/delete-session] Failed to delete session images:', e);
    return NextResponse.json(
      { error: 'Failed to delete session images' },
      { status: 500 }
    );
  }
}
