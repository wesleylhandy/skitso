/**
 * Session Configuration Validation Schema
 * 
 * Zod schemas for validating session configuration data,
 * including theme, tone, participant count, chaos level, and optional
 * director-defined characters.
 */

import { z } from 'zod';

export const TonePreferenceSchema = z.enum([
  'comedic',
  'dramatic',
  'satirical',
  'absurd',
  'serious',
  'romantic',
]);

export type TonePreference = z.infer<typeof TonePreferenceSchema>;

export const DirectorDefinedCharacterSchema = z.object({
  name: z.string().min(1).max(50),
  role: z.string().optional(),
});

export type DirectorDefinedCharacter = z.infer<typeof DirectorDefinedCharacterSchema>;

export const SessionConfigurationSchema = z.object({
  theme: z.string().min(10).max(200),
  tone: TonePreferenceSchema,
  participantCount: z.number().int().min(2).max(10),
  chaosLevel: z.number().int().min(1).max(10),
  directorDefinedCharacters: z.array(DirectorDefinedCharacterSchema).optional(),
});

export type SessionConfiguration = z.infer<typeof SessionConfigurationSchema>;
