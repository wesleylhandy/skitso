/**
 * Character Dossier Component
 * 
 * Detailed character view screen showing full character information
 * including hidden motivation (visible only to assigned Actor).
 * Applies theme-specific layout and styling from VibeContext.
 */

'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import Image from 'next/image';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { ImageDownloadButton } from '@/src/components/ui/image-download-button';
import { CharacterImagePlaceholder } from '@/src/components/ui/character-image-placeholder';
import { flattenScriptLines, getCharacterLines } from '@/src/components/teleprompter/script-lines';
import { normalizeImageUrl, isCloudinaryUrl } from '@/src/lib/partykit/client';
import type { Character } from '@/src/state/types/session';

interface CharacterDossierProps {
  character: Character;
  onBack: () => void;
}

/**
 * CharacterDossier Component
 * 
 * Displays comprehensive character information including:
 * - Name and archetype
 * - Personality traits
 * - Visual representation
 * - Hidden motivation (only visible to assigned Actor)
 */
export function CharacterDossier({ character, onBack }: CharacterDossierProps) {
  const vibe = useAtomValue(vibeAtom);
  const participant = useAtomValue(participantAtom);
  const script = useAtomValue(currentScriptAtom);
  const { getSectionTitle, getButtonLabel, visualTokens } = useVibe();

  // Check if current participant is assigned to this character
  const isAssignedActor = participant?.id === character.participantId;
  // Directors can always see hidden motivation for assignment decisions
  const isDirector = participant?.role === 'director';
  const canSeeHiddenMotivation = isAssignedActor || isDirector;

  // Calculate dialogue lines count from script
  const dialogueLinesCount = useMemo(() => {
    if (!script) {
      // Fallback to character's dialogueLines if script not available
      return character.dialogueLines?.length || 0;
    }
    
    const scriptLines = flattenScriptLines(script);
    const characterLines = getCharacterLines(scriptLines, character.name);
    return characterLines.length;
  }, [script, character.name, character.dialogueLines]);

  return (
    <div className="character-dossier p-6" data-theme={vibe}>
      <div className="character-details grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visual Representation */}
        <div className="character-image relative w-full aspect-square rounded-lg overflow-hidden group" style={{
          border: `2px solid ${visualTokens.primaryColor}`,
        }}>
          {character.visualRepresentation.imageUrl && character.visualRepresentation.imageUrl.length > 0 ? (
            (() => {
              const imageUrl = normalizeImageUrl(character.visualRepresentation.imageUrl, character.sessionId, character.id);
              const useImg = imageUrl.startsWith('data:') ||
                imageUrl.includes('/parties/main/') || imageUrl.includes('localhost:1999/parties') ||
                isCloudinaryUrl(imageUrl);
              return (
                <>
                  {useImg ? (
                    <img
                      src={imageUrl}
                      alt={character.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Image
                      src={imageUrl}
                      alt={character.name}
                      fill
                      className="object-cover"
                      loading="lazy"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  )}
                  <ImageDownloadButton
                    imageUrl={imageUrl}
                    filename={`${character.name}-character-image.png`}
                  />
                </>
              );
            })()
          ) : (
            <CharacterImagePlaceholder characterName={character.name} />
          )}
        </div>

        {/* Character Information */}
        <div className="character-info space-y-6">
          <div className="pb-2 border-b" style={{ borderColor: `${visualTokens.textColor}20` }}>
            <h2 className="text-2xl font-bold mb-2" style={{ color: visualTokens.primaryColor }}>
              {character.name}
            </h2>
            <p 
              className="text-lg font-medium" 
              style={{ 
                color: visualTokens.textColor, 
                opacity: 0.9,
                lineHeight: '1.6',
              }}
            >
              {character.archetypeLabel}
            </p>
          </div>

          {/* Personality Traits */}
          <div>
            <h3 
              className="text-lg font-semibold mb-3" 
              style={{ color: visualTokens.textColor, opacity: 1 }}
            >
              {getSectionTitle('personalityTraits')}
            </h3>
            <ul className="list-disc list-outside text-sm space-y-2 pl-6 pr-2">
              {character.personalityTraits.map((trait, index) => (
                <li 
                  key={index} 
                  className="leading-relaxed" 
                  style={{ 
                    color: visualTokens.textColor, 
                    opacity: 1,
                    lineHeight: '1.6',
                  }}
                >
                  {trait}
                </li>
              ))}
            </ul>
          </div>

          {/* Attributes (if available) */}
          {character.attributes && character.attributes.length > 0 && (
            <div className="pt-2">
              <h3 
                className="text-lg font-semibold mb-3" 
                style={{ color: visualTokens.textColor, opacity: 1 }}
              >
                {getSectionTitle('attributes')}
              </h3>
              <div className="space-y-2.5 pl-2">
                {character.attributes.map((attr, index) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span 
                      className="text-sm" 
                      style={{ color: visualTokens.textColor, opacity: 0.9 }}
                    >
                      {attr.name}:
                    </span>
                    <span 
                      className="text-sm font-semibold" 
                      style={{ color: visualTokens.textColor, opacity: 1 }}
                    >
                      {attr.rating}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden Motivation - Visible to assigned Actor and Director */}
          {canSeeHiddenMotivation && (
            <div
              className="hidden-motivation p-5 rounded-lg mt-2"
              style={{
                backgroundColor: visualTokens.bgColor === '#0A0A0A' || visualTokens.bgColor === '#000000' || visualTokens.bgColor === '#141414' 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.08)',
                border: `2px solid ${visualTokens.accentColor || visualTokens.primaryColor}`,
              }}
            >
              <h3 
                className="text-lg font-semibold mb-3" 
                style={{ 
                  color: visualTokens.accentColor || visualTokens.primaryColor,
                  opacity: 1,
                }}
              >
                {getSectionTitle('hiddenMotivation')}
                {isDirector && !isAssignedActor && (
                  <span 
                    className="ml-2 text-xs font-normal" 
                    style={{ opacity: 0.8 }}
                  >
                    (Director View)
                  </span>
                )}
              </h3>
              <p 
                className="text-sm leading-relaxed" 
                style={{ 
                  color: visualTokens.textColor,
                  opacity: 1,
                  lineHeight: '1.7',
                }}
              >
                {character.hiddenMotivation}
              </p>
            </div>
          )}

          {/* Dialogue Lines Count */}
          <div 
            className="text-sm pt-2 mt-2 border-t" 
            style={{ 
              color: visualTokens.textColor, 
              opacity: 0.85,
              borderColor: `${visualTokens.textColor}20`,
            }}
          >
            {dialogueLinesCount} dialogue line{dialogueLinesCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
