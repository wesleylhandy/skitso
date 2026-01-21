/**
 * Character Image Generation API Route
 * 
 * Generates character images directly using the configured image model.
 * Uses the system prompt from the character-image-generation-prompt.md template.
 * Includes rate limiting, validation, and retry logic.
 * 
 * Supports both GPT Image models (gpt-image-*) and DALL-E models (dall-e-*).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOpenAIClient } from '@/src/lib/openai/client';
import { checkRateLimit } from '@/src/lib/openai/rate-limiter';
import { generateImagePrompt } from '@/src/lib/openai/prompts/image-prompt';
import { getModel } from '@/src/lib/openai/models';
import type { Character } from '@/src/state/types/session';

interface ImageResponse {
  imageUrl: string;
  imagePrompt?: string; // Optional: the prompt used for generation
}

const RequestSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    archetypeLabel: z.string(),
    personalityTraits: z.array(z.string()),
    attributes: z.array(
      z.object({
        name: z.string(),
        rating: z.number(),
      })
    ).optional(),
  }),
  vibeContext: z.enum(['VIRAL_NEON', 'INDIE_A24', 'SITCOM_STUDIO', 'BRAINROT_THEATER', 'QUIET_STUDIO']),
  optionalImagePrompt: z.string().optional(),
});

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

    const { character, vibeContext, optionalImagePrompt } = validated.data;

    // Generate the system prompt from the template
    const systemPrompt = generateImagePrompt({
      character: character as Character,
      vibeContext,
      optionalImagePrompt,
    });

    // Build the image generation prompt
    const userMessage = `Generate a character image for ${character.name}. The image should match the ${vibeContext} aesthetic style and reflect the character's personality traits: ${character.personalityTraits.join(', ')}.`;

    const openai = createOpenAIClient();
    // Use the configured image model from environment variable, fallback to default
    const imageModel = process.env.OPENAI_MODEL_IMAGE_PROMPT ?? getModel('IMAGE_PROMPT_GENERATION');

    // Detect model type to use correct parameters
    const isGPTImageModel = imageModel.startsWith('gpt-image');

    let imageUrl: string;
    let attempts = 0;
    const maxAttempts = 2;

    // Generate image using the configured image model
    while (attempts < maxAttempts) {
      try {
        // Combine system prompt and user message for the image generation prompt
        const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

        // Generate image with model-specific parameters
        let imageResponse;
        if (isGPTImageModel) {
          // GPT Image models (gpt-image-1.5, gpt-image-1, etc.)
          // GPT-image models return base64 by default (b64_json)
          // They don't support response_format parameter like DALL-E models
          imageResponse = await openai.images.generate({
            model: imageModel,
            prompt: fullPrompt,
            n: 1,
            size: '1024x1024',
            output_format: 'png', // 'png', 'jpeg', or 'webp'
            quality: 'medium', // 'low', 'medium', or 'high'
            // Note: GPT-image models return base64 by default, no response_format param
          });
        } else {
          // DALL-E models (dall-e-3, dall-e-2)
          // Use response_format
          imageResponse = await openai.images.generate({
            model: imageModel,
            prompt: fullPrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard', // 'standard' or 'hd' for dall-e-3
            response_format: 'url', // 'url' or 'b64_json'
          });
        }

        // Handle response - both model types return data array
        const imageData = imageResponse.data?.[0];
        if (!imageData) {
          console.error('Image generation response structure:', JSON.stringify(imageResponse, null, 2));
          throw new Error('No image data in response');
        }

        // Extract URL or base64 - GPT-image models often return base64
        let generatedImageUrl: string | undefined;
        
        if ('url' in imageData && imageData.url) {
          generatedImageUrl = imageData.url;
        } else if ('b64_json' in imageData && imageData.b64_json) {
          // Convert base64 to data URL
          const mimeType = isGPTImageModel 
            ? (imageModel.includes('png') ? 'image/png' : 'image/jpeg')
            : 'image/png';
          generatedImageUrl = `data:${mimeType};base64,${imageData.b64_json}`;
        }
        
        if (!generatedImageUrl) {
          console.error('Image data structure:', JSON.stringify(imageData, null, 2));
          console.error('Available keys:', Object.keys(imageData));
          throw new Error('No image URL or base64 data in response');
        }

        imageUrl = generatedImageUrl;
        break;
      } catch {
        attempts++;
        if (attempts >= maxAttempts) {
          // Final retry with simplified prompt
          try {
            const simplifiedPrompt = `A character named ${character.name} with personality traits: ${character.personalityTraits.join(', ')}. Style: ${vibeContext}.`;

            // Retry with model-specific parameters
            let retryResponse;
            if (isGPTImageModel) {
              retryResponse = await openai.images.generate({
                model: imageModel,
                prompt: simplifiedPrompt,
                n: 1,
                size: '1024x1024',
                output_format: 'png',
                quality: 'medium',
                // Note: GPT-image models return base64 by default
              });
            } else {
              retryResponse = await openai.images.generate({
                model: imageModel,
                prompt: simplifiedPrompt,
                n: 1,
                size: '1024x1024',
                quality: 'standard',
                response_format: 'url',
              });
            }

            const imageData = retryResponse.data?.[0];
            if (!imageData) {
              console.error('Retry response structure:', JSON.stringify(retryResponse, null, 2));
              throw new Error('No image data in response after retries');
            }

            // Extract URL or base64
            let generatedImageUrl: string | undefined;
            
            if ('url' in imageData && imageData.url) {
              generatedImageUrl = imageData.url;
            } else if ('b64_json' in imageData && imageData.b64_json) {
              // Convert base64 to data URL
              const mimeType = isGPTImageModel ? 'image/png' : 'image/png';
              generatedImageUrl = `data:${mimeType};base64,${imageData.b64_json}`;
            }
            
            if (!generatedImageUrl) {
              console.error('Retry image data structure:', JSON.stringify(imageData, null, 2));
              console.error('Available keys:', Object.keys(imageData));
              throw new Error('No image URL or base64 data in response after retries');
            }

            imageUrl = generatedImageUrl;
            break;
          } catch (retryError) {
            throw new Error(
              `Failed to generate image after ${maxAttempts} attempts: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`
            );
          }
        }
        // Continue to next attempt
      }
    }

    if (!imageUrl!) {
      throw new Error('Failed to generate image');
    }

    const response: ImageResponse = {
      imageUrl: imageUrl!,
      imagePrompt: `${systemPrompt}\n\n${userMessage}`, // Include the prompt used for reference
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
