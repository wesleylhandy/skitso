/**
 * OpenAI Client Wrapper
 * 
 * Creates and configures the OpenAI client for API calls.
 * Uses OpenAI SDK v6.x with latest API syntax.
 * 
 * API Key: Loaded from process.env.OPENAI_API_KEY
 * 
 * @see https://platform.openai.com/docs/api-reference
 */

import OpenAI from 'openai';

let clientInstance: OpenAI | null = null;

/**
 * Creates or returns the singleton OpenAI client instance
 * 
 * Uses the latest OpenAI SDK v6.x syntax:
 * - chat.completions.create() for text generation
 * - Proper error handling and type safety
 * 
 * @returns Configured OpenAI client
 * @throws Error if OPENAI_API_KEY is not configured in environment variables
 */
export function createOpenAIClient(): OpenAI {
  if (clientInstance) {
    return clientInstance;
  }

  // Load API key from environment variables
  // In Next.js, this reads from .env.local or .env files automatically
  // No need for dotenv package - Next.js handles this natively
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Please set it in your .env.local file:\n' +
      '  OPENAI_API_KEY=your_key_here\n\n' +
      'Get your API key from https://platform.openai.com/api-keys\n' +
      'After adding the key, restart your dev server (npm run dev)'
    );
  }

  // Initialize OpenAI client with latest SDK syntax
  // OpenAI SDK v6.x automatically handles:
  // - Base URL configuration
  // - Request/response formatting
  // - Error handling
  clientInstance = new OpenAI({
    apiKey,
    // Optional: Add default timeout and other config if needed
    // timeout: 30000, // 30 seconds
    // maxRetries: 2,
  });

  return clientInstance;
}
