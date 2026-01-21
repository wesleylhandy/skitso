/**
 * Session Lookup API Route Tests
 * 
 * Tests for session validation and lookup functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock session storage (in-memory for MVP)
const sessionStore = new Map<string, SessionData>();

interface SessionData {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: string;
}

vi.mock('@/src/state/atoms/session-atom', () => ({
  sessionCodeAtom: {
    init: null,
  },
}));

describe('POST /api/sessions/[sessionId]', () => {
  beforeEach(() => {
    sessionStore.clear();
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/INVALID', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'INVALID' }) });
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data.error).toBe('Session not found');
  });

  it('should return 400 for invalid session code format', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/INVALID12345', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'INVALID12345' }) });
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Invalid session code');
  });

  it('should return 410 for expired session', async () => {
    const expiredSession = {
      id: 'EXPIRED01',
      createdAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      expiresAt: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      status: 'expired' as const,
    };
    sessionStore.set('EXPIRED01', expiredSession);

    const request = new NextRequest('http://localhost:3000/api/sessions/EXPIRED01', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'EXPIRED01' }) });
    expect(response.status).toBe(410);
    
    const data = await response.json();
    expect(data.error).toBe('Session expired');
  });

  it('should return session data for valid session', async () => {
    const validSession = {
      id: 'VALID1234',
      shareableLink: 'https://skitso.app/join/VALID1234',
      vibeContext: 'VIRAL_NEON' as const,
      directorId: 'director-1',
      configuration: {
        theme: 'Test theme',
        tone: 'comedic' as const,
        participantCount: 3,
        chaosLevel: 5,
      },
      status: 'casting' as const,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      cast: [],
      script: null,
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
    sessionStore.set('VALID1234', validSession);

    const request = new NextRequest('http://localhost:3000/api/sessions/VALID1234', {
      method: 'POST',
    });

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'VALID1234' }) });
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.session).toBeDefined();
    expect(data.session.id).toBe('VALID1234');
    expect(data.session.vibeContext).toBe('VIRAL_NEON');
    expect(data.session.status).toBe('casting');
  });
});
