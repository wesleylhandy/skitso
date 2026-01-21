/**
 * Script Generation API Route
 * 
 * Generates scripts using OpenAI based on VibeContext, characters, and configuration.
 * Includes rate limiting, validation, and retry logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { createOpenAIClient } from '@/src/lib/openai/client';
import { checkRateLimit } from '@/src/lib/openai/rate-limiter';
import { generateScriptPrompt } from '@/src/lib/openai/prompts/script-prompt';
import { getModel, getTemperatureForModel } from '@/src/lib/openai/models';
import type { VibeType } from '@/src/state/types/vibe';
import type { Character } from '@/src/state/types/session';

const ScriptResponseSchema = z.object({
  title: z.string(),
  length: z.string(),
  description: z.string(),
  scenes: z.array(
    z.object({
      title: z.string(),
      length: z.string(),
      description: z.string(),
      dialogue: z.array(
        z.object({
          characterName: z.string(),
          content: z.string(),
        })
      ),
      stageDirections: z.array(
        z.object({
          lineIndex: z.number(),
          text: z.string(),
        })
      ).optional(),
      soundCues: z.array(
        z.object({
          lineIndex: z.number(),
          soundName: z.string(),
          startOffset: z.number(),
        })
      ).optional(),
    })
  ),
});

const RequestSchema = z.object({
  vibeContext: z.enum(['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO']),
  theme: z.string().min(10).max(200),
  tone: z.string(),
  characters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      archetypeLabel: z.string(),
      personalityTraits: z.array(z.string()),
      hiddenMotivation: z.string(),
      attributes: z.array(
        z.object({
          name: z.string(),
          rating: z.number(),
        })
      ).optional(),
    })
  ),
  sceneCount: z.number().int().min(1).max(10),
  chaosLevel: z.number().int().min(1).max(10),
  plot: z.string().optional(),
  jokes: z.array(z.string()).optional(),
});

function generateSimplifiedScriptPrompt(vibeContext: VibeType, theme: string, characterNames: string[]): string {
  return `Generate a script for ${vibeContext} style about "${theme}" with characters: ${characterNames.join(', ')}. Include title, length, description, and scenes with dialogue, stageDirections, and soundCues. Output only valid JSON.`;
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const rateLimit = checkRateLimit(userId);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetAt: rateLimit.resetAt },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = RequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.issues },
        { status: 400 }
      );
    }

    const { vibeContext, theme, tone, characters, sceneCount, chaosLevel, plot, jokes } = validated.data;

    const prompt = generateScriptPrompt({
      vibeContext,
      theme,
      tone,
      characters: characters as Character[],
      sceneCount,
      chaosLevel,
      plot,
      jokes,
    });

    const openai = createOpenAIClient();
    const model = getModel('SCRIPT_GENERATION');
    const temperature = getTemperatureForModel(model, 0.8);
    let response;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        const completionParams: Parameters<typeof openai.chat.completions.create>[0] = {
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `Generate a ${sceneCount}-scene script about "${theme}"` },
          ],
          response_format: { type: 'json_object' },
        };
        
        // Only include temperature if the model supports it
        if (temperature !== undefined) {
          completionParams.temperature = temperature;
        }
        
        const completion = await openai.chat.completions.create(completionParams);

        // Handle both regular and stream responses
        if (!('choices' in completion) || !completion.choices || completion.choices.length === 0) {
          throw new Error('Invalid response format from OpenAI');
        }
        
        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error('No content in response');

        const parsed = JSON.parse(content);
        response = ScriptResponseSchema.parse(parsed);
        break;
      } catch {
        attempts++;
        if (attempts >= maxAttempts) {
          const simplifiedPrompt = generateSimplifiedScriptPrompt(
            vibeContext,
            theme,
            characters.map(c => c.name)
          );
          const retryParams: Parameters<typeof openai.chat.completions.create>[0] = {
            model,
            messages: [{ role: 'system', content: simplifiedPrompt }],
            response_format: { type: 'json_object' },
          };
          
          // Only include temperature if the model supports it
          if (temperature !== undefined) {
            retryParams.temperature = temperature;
          }
          
          const completion = await openai.chat.completions.create(retryParams) as ChatCompletion;

          const content = completion.choices[0]?.message?.content;
          if (!content) throw new Error('Failed to generate script after retries');

          const parsed = JSON.parse(content);
          response = ScriptResponseSchema.parse(parsed);
        }
      }
    }

    if (!response) {
      throw new Error('Failed to generate script');
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Script generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate script',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
