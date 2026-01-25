/**
 * Session Join API Route Tests
 * 
 * Tests for participant joining and automatic character assignment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/sessions/[sessionId]/join', () => {
  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/INVALID/join', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Actor',
        deviceInfo: {
          userAgent: 'test',
          screenSize: '1920x1080',
          timezone: 'UTC',
        },
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'INVALID' }) });
    expect(response.status).toBe(404);
  });

  it('should return 400 for missing name', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/TEST1234/join', {
      method: 'POST',
      body: JSON.stringify({
        deviceInfo: {
          userAgent: 'test',
          screenSize: '1920x1080',
          timezone: 'UTC',
        },
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'TEST1234' }) });
    expect(response.status).toBe(400);
  });

  // NOTE: Character assignment timing and store-based tests were removed
  // when migrating to PartyKit as the single source of truth.
  // PartyKit integration tests cover assignment behavior.
});
