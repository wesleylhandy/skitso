import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {
        // Mock constructor
      }
      chat = {
        completions: {
          create: vi.fn(),
        },
      };
      images = {
        generate: vi.fn(),
      };
    },
  };
});

describe('createOpenAIClient', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    // Reset the module to clear cached client instance
    vi.resetModules();
  });

  it('should create OpenAI client with API key from environment', async () => {
    const { createOpenAIClient: createClient } = await import('./client');
    const client = createClient();
    expect(client).toBeDefined();
  });

  it('should throw error if API key is missing', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    // Reset modules to get fresh instance
    vi.resetModules();
    const { createOpenAIClient: createClient } = await import('./client');
    
    expect(() => {
      createClient();
    }).toThrow('OPENAI_API_KEY is not configured');
    
    // Restore for other tests
    process.env.OPENAI_API_KEY = originalKey;
  });
});
