/**
 * Character Card Component Tests
 * 
 * Tests for displaying character information.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterCard } from './character-card';
import type { Character } from '@/src/state/types/session';

const mockCharacter: Character = {
  id: 'char-1',
  sessionId: 'session-1',
  participantId: 'participant-1',
  isLocked: false,
  name: 'Test Character',
  archetypeLabel: 'The Main Character',
  personalityTraits: ['funny', 'bold', 'charismatic'],
  hiddenMotivation: 'To win the competition',
  visualRepresentation: {
    imageUrl: 'https://example.com/image.jpg',
    imagePrompt: 'A character description',
  },
  dialogueLines: [0, 2, 4],
};

describe('CharacterCard', () => {
  it('should display character name', () => {
    render(<CharacterCard character={mockCharacter} />);
    expect(screen.getByText('Test Character')).toBeInTheDocument();
  });

  it('should display archetype label', () => {
    render(<CharacterCard character={mockCharacter} />);
    expect(screen.getByText('The Main Character')).toBeInTheDocument();
  });

  it('should display personality traits', () => {
    render(<CharacterCard character={mockCharacter} />);
    expect(screen.getByText(/funny/i)).toBeInTheDocument();
    expect(screen.getByText(/bold/i)).toBeInTheDocument();
  });

  it('should display character image', () => {
    render(<CharacterCard character={mockCharacter} />);
    const image = screen.getByAltText(/test character/i);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should not display hidden motivation', () => {
    render(<CharacterCard character={mockCharacter} />);
    expect(screen.queryByText(/to win the competition/i)).not.toBeInTheDocument();
  });

  it('should display attributes when present', () => {
    const withAttrs: Character = {
      ...mockCharacter,
      attributes: [
        { name: 'Confidence', rating: 95 },
        { name: 'Chaos Level', rating: 88 },
      ],
    };
    render(<CharacterCard character={withAttrs} />);
    expect(screen.getByText('Attributes:')).toBeInTheDocument();
    expect(screen.getByText(/Confidence:/)).toBeInTheDocument();
    expect(screen.getByText(/95\/100/)).toBeInTheDocument();
    expect(screen.getByText(/Chaos Level:/)).toBeInTheDocument();
    expect(screen.getByText(/88\/100/)).toBeInTheDocument();
  });

  it('should not show Attributes section when attributes are missing', () => {
    render(<CharacterCard character={mockCharacter} />);
    expect(screen.queryByText('Attributes:')).not.toBeInTheDocument();
  });
});
