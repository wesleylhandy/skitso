/**
 * Character Generation API Route
 * 
 * Generates characters using OpenAI based on VibeContext and configuration.
 * Includes rate limiting, validation, and retry logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { createOpenAIClient } from '@/src/lib/openai/client';
import { checkRateLimit } from '@/src/lib/openai/rate-limiter';
import { generateCharacterPrompt } from '@/src/lib/openai/prompts/character-prompt';
import { getModel, getTemperatureForModel } from '@/src/lib/openai/models';
import type { VibeType } from '@/src/state/types/vibe';

const CharacterResponseSchema = z.object({
  characters: z.array(
    z.object({
      name: z.string(),
      archetypeLabel: z.string(),
      personalityTraits: z.array(z.string()),
      hiddenMotivation: z.string(),
      attributes: z.array(
        z.object({
          name: z.string(),
          rating: z.number().int().min(1).max(100),
        })
      ),
      imagePrompt: z.string(),
    })
  ),
});

const RequestSchema = z.object({
  vibeContext: z.enum(['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO']),
  participantCount: z.number().int().min(2).max(10),
  directorDefinedCharacters: z.array(
    z.object({
      name: z.string(),
      role: z.string().optional(),
    })
  ).optional(),
  theme: z.string().optional(),
  tone: z.string().optional(),
});

/**
 * Simplified prompt for retry attempts
 */
function generateSimplifiedCharacterPrompt(vibeContext: VibeType, participantCount: number): string {
  return `Generate ${participantCount} unique characters for a ${vibeContext} style performance. Each character needs: name, archetypeLabel, personalityTraits (array), hiddenMotivation, attributes (array with name and rating 1-100), and imagePrompt. Output only valid JSON in format: {"characters": [...]}`;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const rateLimit = checkRateLimit(userId);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt,
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = RequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validated.error.issues,
        },
        { status: 400 }
      );
    }

    const { vibeContext, participantCount, directorDefinedCharacters, theme, tone } = validated.data;

    // Generate prompt
    const prompt = generateCharacterPrompt({
      vibeContext,
      participantCount,
      directorDefinedCharacters,
      theme,
      tone,
    });

    // Call OpenAI with retry logic
    const openai = createOpenAIClient();
    const model = getModel('CHARACTER_GENERATION');
    const temperature = getTemperatureForModel(model, 0.8);
    let response;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        const completionParams: Parameters<typeof openai.chat.completions.create>[0] = {
          model,
          messages: [
            {
              role: 'system',
              content: prompt,
            },
            {
              role: 'user',
              content: `Generate ${participantCount} characters for ${vibeContext} style.`,
            },
          ],
          response_format: { type: 'json_object' },
        };
        
        // Only include temperature if the model supports it
        if (temperature !== undefined) {
          completionParams.temperature = temperature;
        }
        
        const completion = await openai.chat.completions.create(completionParams) as ChatCompletion;

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in response');
        }

        const parsed = JSON.parse(content);
        response = CharacterResponseSchema.parse(parsed);
        break; // Success
      } catch {
        attempts++;
        if (attempts >= maxAttempts) {
          // Last attempt with simplified prompt
          const simplifiedPrompt = generateSimplifiedCharacterPrompt(vibeContext, participantCount);
          const retryParams: Parameters<typeof openai.chat.completions.create>[0] = {
            model,
            messages: [
              {
                role: 'system',
                content: simplifiedPrompt,
              },
            ],
            response_format: { type: 'json_object' },
          };
          
          // Only include temperature if the model supports it
          if (temperature !== undefined) {
            retryParams.temperature = temperature;
          }
          
          const completion = await openai.chat.completions.create(retryParams) as ChatCompletion;

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            throw new Error('Failed to generate characters after retries');
          }

          const parsed = JSON.parse(content);
          response = CharacterResponseSchema.parse(parsed);
        }
      }
    }

    if (!response) {
      throw new Error('Failed to generate characters');
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Character generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate characters',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
