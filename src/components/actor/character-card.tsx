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
import { normalizeImageUrl, isCloudinaryUrl } from '@/src/lib/partykit/client';

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const hasImage = character.visualRepresentation?.imageUrl && character.visualRepresentation.imageUrl.length > 0;
  const imageFilename = `${character.name.replace(/\s+/g, '-').toLowerCase()}-character.png`;
  
  // Normalize image URL: convert relative PartyKit URLs to full URLs
  // This ensures images work when Next.js and PartyKit are on different origins
  const rawImageUrl = character.visualRepresentation?.imageUrl || '';
  const imageUrl = normalizeImageUrl(rawImageUrl, character.sessionId, character.id);
  
  // Use plain <img> for PartyKit, data URLs, and Cloudinary (avoids /_next/image 400)
  // Cloudinary URLs are already optimized (512x512, q_auto); Next.js Image can 400 when proxying them.
  const isPartyKitUrl = imageUrl.includes('/parties/main/') || imageUrl.includes('localhost:1999/parties');
  const isDataUrl = imageUrl.startsWith('data:');
  const isCloudinary = isCloudinaryUrl(imageUrl);
  const useNextImage = !isPartyKitUrl && !isDataUrl && !isCloudinary;
  
  // Debug logging in development to help diagnose image display issues
  if (process.env.NODE_ENV === 'development' && !hasImage && character.visualRepresentation) {
    console.log('[CharacterCard] Character missing image URL:', {
      characterName: character.name,
      hasVisualRepresentation: Boolean(character.visualRepresentation),
      imageUrl: character.visualRepresentation?.imageUrl || null,
      imageUrlLength: character.visualRepresentation?.imageUrl?.length || 0,
    });
  }

  return (
    <div className="character-card p-4 border rounded-lg">
      <div className="character-image mb-4 relative w-full aspect-square rounded-md overflow-hidden group">
        {hasImage ? (
          <>
            {useNextImage ? (
              <Image
                src={imageUrl}
                alt={character.name}
                fill
                className="object-cover"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                onError={(e) => {
                  console.error('[CharacterCard] Image failed to load:', {
                    characterName: character.name,
                    imageUrl,
                    error: e,
                  });
                }}
              />
            ) : (
              // Use regular img for PartyKit, data URLs, and Cloudinary (avoids _next/image 400)
              <img
                src={imageUrl}
                alt={character.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  console.error('[CharacterCard] Image failed to load:', {
                    characterName: character.name,
                    imageUrl,
                    error: e,
                  });
                }}
              />
            )}
            <ImageDownloadButton
              imageUrl={imageUrl}
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
          {(character.personalityTraits ?? []).map((trait, index) => (
            <li key={index}>{trait}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
