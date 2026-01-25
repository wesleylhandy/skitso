/**
 * Character Dossier Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterDossier } from './character-dossier';
import type { Character } from '@/src/state/types/session';

const mockCharacter: Character = {
  id: 'char-1',
  sessionId: 'session-1',
  participantId: 'participant-1',
  isLocked: false,
  name: 'Test Character',
  archetypeLabel: 'The Hero',
  personalityTraits: ['brave', 'kind'],
  hiddenMotivation: 'To save the world',
  visualRepresentation: {
    imageUrl: 'https://example.com/image.jpg',
    imagePrompt: 'A hero character',
  },
  dialogueLines: [1, 2, 3],
};

describe('CharacterDossier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render character information', () => {
    render(<CharacterDossier character={mockCharacter} onBack={() => {}} />);
    expect(screen.getByText('Test Character')).toBeInTheDocument();
    expect(screen.getByText('The Hero')).toBeInTheDocument();
  });

  it('should display hidden motivation', () => {
    render(<CharacterDossier character={mockCharacter} onBack={() => {}} />);
    expect(screen.getByText(/hidden motivation/i)).toBeInTheDocument();
    expect(screen.getByText('To save the world')).toBeInTheDocument();
  });
});
