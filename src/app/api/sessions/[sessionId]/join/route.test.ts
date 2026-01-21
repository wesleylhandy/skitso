/**
 * Session Join API Route Tests
 * 
 * Tests for participant joining and automatic character assignment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { sessionStore } from '../route';
import type { SessionData } from '../route';

describe('POST /api/sessions/[sessionId]/join', () => {
  beforeEach(() => {
    sessionStore.clear();
  });

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
    const session: SessionData = {
      id: 'TEST1234',
      shareableLink: 'https://skitso.app/join/TEST1234',
      vibeContext: 'VIRAL_NEON',
      directorId: 'director-1',
      configuration: {
        theme: 'Test',
        tone: 'comedic',
        participantCount: 3,
        chaosLevel: 5,
      },
      status: 'casting',
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
    sessionStore.set('TEST1234', session);

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

  it('should assign character automatically when cast has unassigned characters', async () => {
    const session: SessionData = {
      id: 'TEST1234',
      shareableLink: 'https://skitso.app/join/TEST1234',
      vibeContext: 'VIRAL_NEON',
      directorId: 'director-1',
      configuration: {
        theme: 'Test',
        tone: 'comedic',
        participantCount: 3,
        chaosLevel: 5,
      },
      status: 'casting',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      cast: [
        {
          id: 'char-1',
          sessionId: 'TEST1234',
          participantId: null,
          name: 'Character 1',
          archetypeLabel: 'The Main Character',
          personalityTraits: ['funny', 'bold'],
          hiddenMotivation: 'To win',
          visualRepresentation: {
            imageUrl: 'https://example.com/image1.jpg',
            imagePrompt: 'A character',
          },
          dialogueLines: [0, 2, 4],
        },
        {
          id: 'char-2',
          sessionId: 'TEST1234',
          participantId: null,
          name: 'Character 2',
          archetypeLabel: 'The Sidekick',
          personalityTraits: ['loyal', 'funny'],
          hiddenMotivation: 'To help',
          visualRepresentation: {
            imageUrl: 'https://example.com/image2.jpg',
            imagePrompt: 'Another character',
          },
          dialogueLines: [1, 3, 5],
        },
      ],
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
    sessionStore.set('TEST1234', session);

    const request = new NextRequest('http://localhost:3000/api/sessions/TEST1234/join', {
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

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'TEST1234' }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.participant).toBeDefined();
    expect(data.participant.role).toBe('actor');
    expect(data.participant.characterAssignment).toBeDefined();
    expect(data.participant.characterAssignment?.participantId).toBe(data.participant.id);

    // Verify character was assigned in session store
    const updatedSession = sessionStore.get('TEST1234');
    const assignedChar = updatedSession?.cast.find(c => c.participantId === data.participant.id);
    expect(assignedChar).toBeDefined();
  });

  it('should not assign character if all are already assigned', async () => {
    const session: SessionData = {
      id: 'TEST1234',
      shareableLink: 'https://skitso.app/join/TEST1234',
      vibeContext: 'VIRAL_NEON',
      directorId: 'director-1',
      configuration: {
        theme: 'Test',
        tone: 'comedic',
        participantCount: 2,
        chaosLevel: 5,
      },
      status: 'casting',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      cast: [
        {
          id: 'char-1',
          sessionId: 'TEST1234',
          participantId: 'existing-participant',
          name: 'Character 1',
          archetypeLabel: 'The Main Character',
          personalityTraits: ['funny'],
          hiddenMotivation: 'To win',
          visualRepresentation: {
            imageUrl: 'https://example.com/image1.jpg',
            imagePrompt: 'A character',
          },
          dialogueLines: [0],
        },
      ],
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
    sessionStore.set('TEST1234', session);

    const request = new NextRequest('http://localhost:3000/api/sessions/TEST1234/join', {
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

    const response = await POST(request, { params: Promise.resolve({ sessionId: 'TEST1234' }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.participant.characterAssignment).toBeNull();
  });

  it('should complete character assignment within 5 seconds (T086)', async () => {
    const session: SessionData = {
      id: 'TEST1234',
      shareableLink: 'https://skitso.app/join/TEST1234',
      vibeContext: 'VIRAL_NEON',
      directorId: 'director-1',
      configuration: {
        theme: 'Test',
        tone: 'comedic',
        participantCount: 3,
        chaosLevel: 5,
      },
      status: 'casting',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      cast: [
        {
          id: 'char-1',
          sessionId: 'TEST1234',
          participantId: null,
          name: 'Character 1',
          archetypeLabel: 'The Main Character',
          personalityTraits: ['funny', 'bold'],
          hiddenMotivation: 'To win',
          visualRepresentation: {
            imageUrl: 'https://example.com/image1.jpg',
            imagePrompt: 'A character',
          },
          dialogueLines: [0, 2, 4],
        },
        {
          id: 'char-2',
          sessionId: 'TEST1234',
          participantId: null,
          name: 'Character 2',
          archetypeLabel: 'The Sidekick',
          personalityTraits: ['loyal', 'funny'],
          hiddenMotivation: 'To help',
          visualRepresentation: {
            imageUrl: 'https://example.com/image2.jpg',
            imagePrompt: 'Another character',
          },
          dialogueLines: [1, 3, 5],
        },
      ],
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
    sessionStore.set('TEST1234', session);

    const request = new NextRequest('http://localhost:3000/api/sessions/TEST1234/join', {
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

    // Measure time for character assignment
    const startTime = Date.now();
    const response = await POST(request, { params: Promise.resolve({ sessionId: 'TEST1234' }) });
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.participant.characterAssignment).toBeDefined();
    
    // Verify assignment completes within 5 seconds (5000ms)
    expect(duration).toBeLessThan(5000);
  });
});
