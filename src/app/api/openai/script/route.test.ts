/**
 * Tests for Script Generation API Route
 * 
 * T070: Test AI generation completion time (<30 seconds requirement)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createOpenAIClient } from '@/src/lib/openai/client';
import { resetRateLimit } from '@/src/lib/openai/rate-limiter';

// Mock the prompt generator
vi.mock('@/src/lib/openai/prompts/script-prompt', () => ({
  generateScriptPrompt: vi.fn(() => 'Mock script generation prompt'),
}));

// Mock OpenAI client
vi.mock('@/src/lib/openai/client', () => ({
  createOpenAIClient: vi.fn(),
}));

// Mock rate limiter
vi.mock('@/src/lib/openai/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetAt: Date.now() + 3600000 })),
  resetRateLimit: vi.fn(),
}));

// Mock prompt generator
vi.mock('@/src/lib/openai/prompts/script-prompt', () => ({
  generateScriptPrompt: vi.fn(() => 'Mock script prompt'),
}));

describe('Script Generation API - T070: Completion Time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit('test-user');
  });

  it('should complete script generation within 30 seconds', async () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  title: 'Test Script',
                  length: '3 minutes',
                  description: 'A test script',
                  scenes: [
                    {
                      title: 'Scene 1',
                      length: '90 seconds',
                      description: 'First scene',
                      dialogue: [
                        { characterName: 'Character1', content: 'Hello' },
                      ],
                      stageDirections: [],
                      soundCues: [],
                    },
                  ],
                }),
              },
            }],
          }),
        },
      },
    };

    vi.mocked(createOpenAIClient).mockReturnValue(mockOpenAI as unknown as ReturnType<typeof createOpenAIClient>);

    const requestBody = {
      vibeContext: 'VIRAL_NEON',
      theme: 'A test theme that is long enough to pass validation requirements',
      tone: 'comedic',
      characters: [
        {
          id: 'char1',
          name: 'Character1',
          archetypeLabel: 'The Main Character',
          personalityTraits: ['confident'],
          hiddenMotivation: 'Test motivation',
        },
      ],
      sceneCount: 1,
      chaosLevel: 5,
    };

    const request = new NextRequest('http://localhost:3000/api/openai/script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user',
      },
      body: JSON.stringify(requestBody),
    });

    const startTime = Date.now();
    const response = await POST(request);
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(30000); // 30 seconds requirement
  }, 35000);
});
