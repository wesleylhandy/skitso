/**
 * Tests for Character Image Generation API Route
 * 
 * Verifies that hiddenMotivation is required and properly validated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createOpenAIClient } from '@/src/lib/openai/client';
import { checkRateLimit, resetRateLimit } from '@/src/lib/openai/rate-limiter';

const mockGenerateImagePrompt = vi.hoisted(() =>
  vi.fn(() => 'Mock image generation prompt')
);
vi.mock('@/src/lib/openai/prompts/image-prompt', () => ({
  generateImagePrompt: mockGenerateImagePrompt,
}));

vi.mock('@/src/lib/cloudinary/client', () => ({
  isCloudinaryConfigured: vi.fn(() => false),
  uploadCharacterImage: vi.fn(),
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

// Mock models
vi.mock('@/src/lib/openai/models', () => ({
  getModel: vi.fn(() => 'dall-e-3'),
}));

describe('Character Image Generation API - Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateImagePrompt.mockClear();
    resetRateLimit('test-user');
  });

  it('should reject request without hiddenMotivation', async () => {
    const requestBody = {
      character: {
        id: 'char1',
        name: 'Test Character',
        archetypeLabel: 'The Main Character',
        personalityTraits: ['confident'],
        attributes: [{ name: 'Confidence', rating: 80 }],
        // hiddenMotivation is missing
      },
      vibeContext: 'VIRAL_NEON',
    };

    const request = new NextRequest('http://localhost:3000/api/openai/character-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
    // Should have validation error for missing hiddenMotivation
    const hiddenMotivationError = data.details.find(
      (issue: { path: string[] }) => issue.path.includes('hiddenMotivation')
    );
    expect(hiddenMotivationError).toBeDefined();
  });

  it('should accept valid request with hiddenMotivation', async () => {
    const mockOpenAI = {
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{
            url: 'https://example.com/image.png',
          }],
        }),
      },
    };

    vi.mocked(createOpenAIClient).mockReturnValue(mockOpenAI as unknown as ReturnType<typeof createOpenAIClient>);

    const requestBody = {
      character: {
        id: 'char1',
        name: 'Test Character',
        archetypeLabel: 'The Main Character',
        personalityTraits: ['confident', 'bold'],
        hiddenMotivation: 'Desperately wants to prove they are not a one-hit wonder',
        attributes: [
          { name: 'Confidence', rating: 95 },
          { name: 'Chaos Level', rating: 88 },
        ],
      },
      vibeContext: 'VIRAL_NEON',
      optionalImagePrompt: 'A confident character with neon styling',
    };

    const request = new NextRequest('http://localhost:3000/api/openai/character-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imageUrl).toBe('https://example.com/image.png');
    expect(createOpenAIClient).toHaveBeenCalled();
    expect(mockOpenAI.images.generate).toHaveBeenCalled();
  });

  it('should include hiddenMotivation in the generated prompt', async () => {
    const { generateImagePrompt } = await import('@/src/lib/openai/prompts/image-prompt');
    
    const mockOpenAI = {
      images: {
        generate: vi.fn().mockResolvedValue({
          data: [{
            url: 'https://example.com/image.png',
          }],
        }),
      },
    };

    vi.mocked(createOpenAIClient).mockReturnValue(mockOpenAI as unknown as ReturnType<typeof createOpenAIClient>);

    const requestBody = {
      character: {
        id: 'char1',
        name: 'Test Character',
        archetypeLabel: 'The Main Character',
        personalityTraits: ['confident'],
        hiddenMotivation: 'Secretly wants to be the main character',
        attributes: [{ name: 'Confidence', rating: 80 }],
      },
      vibeContext: 'INDIE_A24',
    };

    const request = new NextRequest('http://localhost:3000/api/openai/character-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user',
      },
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Verify generateImagePrompt was called with character containing hiddenMotivation
    expect(generateImagePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        character: expect.objectContaining({
          hiddenMotivation: 'Secretly wants to be the main character',
        }),
        vibeContext: 'INDIE_A24',
      })
    );
  });
});
