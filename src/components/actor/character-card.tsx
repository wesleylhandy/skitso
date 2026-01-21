/**
 * Character Card Component
 * 
 * Displays character information including name, archetype, traits, and visual representation.
 * Does not display hidden motivation (only visible in Character Dossier).
 */

import Image from 'next/image';
import type { Character } from '@/src/state/types/session';
import { ImageDownloadButton } from '@/src/components/ui/image-download-button';
import { CharacterImagePlaceholder } from '@/src/components/ui/character-image-placeholder';

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const hasImage = character.visualRepresentation.imageUrl && character.visualRepresentation.imageUrl.length > 0;
  const imageFilename = `${character.name.replace(/\s+/g, '-').toLowerCase()}-character.png`;

  return (
    <div className="character-card p-4 border rounded-lg">
      <div className="character-image mb-4 relative w-full aspect-square rounded-md overflow-hidden group">
        {hasImage ? (
          <>
            <Image
              src={character.visualRepresentation.imageUrl}
              alt={character.name}
              fill
              className="object-cover"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <ImageDownloadButton
              imageUrl={character.visualRepresentation.imageUrl}
              filename={imageFilename}
            />
          </>
        ) : (
          <CharacterImagePlaceholder characterName={character.name} />
        )}
      </div>

      <h3 className="text-xl font-bold mb-2">{character.name}</h3>
      
      <p className="text-sm text-muted-foreground mb-2">
        {character.archetypeLabel}
      </p>

      <div className="personality-traits mb-2">
        <p className="text-sm font-medium mb-1">Personality Traits:</p>
        <ul className="list-disc list-inside text-sm">
          {character.personalityTraits.map((trait, index) => (
            <li key={index}>{trait}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
