import { describe, it, expect } from 'vitest';
import {
  SessionConfigurationSchema,
  TonePreferenceSchema,
  DirectorDefinedCharacterSchema,
} from './session-config-schema';

describe('SessionConfigurationSchema', () => {
  it('should validate a valid session configuration', () => {
    const valid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 5,
    };

    const result = SessionConfigurationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it('should reject theme shorter than 10 characters', () => {
    const invalid = {
      theme: 'Short',
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 5,
    };

    const result = SessionConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject theme longer than 200 characters', () => {
    const invalid = {
      theme: 'A'.repeat(201),
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 5,
    };

    const result = SessionConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject participant count less than 2', () => {
    const invalid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 1,
      chaosLevel: 5,
    };

    const result = SessionConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject participant count greater than 5', () => {
    const invalid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 6,
      chaosLevel: 5,
    };

    const result = SessionConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject chaos level less than 1', () => {
    const invalid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 0,
    };

    const result = SessionConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject chaos level greater than 10', () => {
    const invalid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 11,
    };

    const result = SessionConfigurationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept valid director-defined characters', () => {
    const valid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 5,
      directorDefinedCharacters: [
        { name: 'Zayden', role: 'protagonist' },
        { name: 'Riley' },
      ],
    };

    const result = SessionConfigurationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should accept configuration without director-defined characters', () => {
    const valid = {
      theme: 'A group of friends trying to go viral',
      tone: 'comedic' as const,
      participantCount: 3,
      chaosLevel: 5,
    };

    const result = SessionConfigurationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('TonePreferenceSchema', () => {
  it('should accept all valid tone preferences', () => {
    const tones: Array<'comedic' | 'dramatic' | 'satirical' | 'absurd' | 'serious' | 'romantic'> = [
      'comedic',
      'dramatic',
      'satirical',
      'absurd',
      'serious',
      'romantic',
    ];

    tones.forEach((tone) => {
      const result = TonePreferenceSchema.safeParse(tone);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid tone preference', () => {
    const result = TonePreferenceSchema.safeParse('invalid');
    expect(result.success).toBe(false);
  });
});

describe('DirectorDefinedCharacterSchema', () => {
  it('should validate a character with name and role', () => {
    const valid = { name: 'Zayden', role: 'protagonist' };
    const result = DirectorDefinedCharacterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate a character with only name', () => {
    const valid = { name: 'Riley' };
    const result = DirectorDefinedCharacterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject character without name', () => {
    const invalid = { role: 'protagonist' };
    const result = DirectorDefinedCharacterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const invalid = { name: '' };
    const result = DirectorDefinedCharacterSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
