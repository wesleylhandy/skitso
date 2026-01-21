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
      <div className="mb-6">
        <button
          onClick={onBack}
          className="mb-4 text-sm underline cursor-pointer transition-opacity hover:opacity-75"
          style={{ color: visualTokens.primaryColor }}
        >
          ← {getButtonLabel('back')}
        </button>
        <h1 className="text-3xl font-bold mb-2" style={{ color: visualTokens.textColor }}>
          {getSectionTitle('characterDossier')}
        </h1>
      </div>

      <div className="character-details grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visual Representation */}
        <div className="character-image relative w-full aspect-square rounded-lg overflow-hidden group" style={{
          border: `2px solid ${visualTokens.primaryColor}`,
        }}>
          {character.visualRepresentation.imageUrl && character.visualRepresentation.imageUrl.length > 0 ? (
            <>
              <Image
                src={character.visualRepresentation.imageUrl}
                alt={character.name}
                fill
                className="object-cover"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <ImageDownloadButton
                imageUrl={character.visualRepresentation.imageUrl}
                filename={`${character.name}-character-image.png`}
              />
            </>
          ) : (
            <CharacterImagePlaceholder characterName={character.name} />
          )}
        </div>

        {/* Character Information */}
        <div className="character-info space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: visualTokens.primaryColor }}>
              {character.name}
            </h2>
            <p 
              className="text-lg" 
              style={{ 
                color: visualTokens.textColor, 
                opacity: 0.9,
                lineHeight: '1.5',
              }}
            >
              {character.archetypeLabel}
            </p>
          </div>

          {/* Personality Traits */}
          <div>
            <h3 
              className="text-lg font-semibold mb-2" 
              style={{ color: visualTokens.textColor, opacity: 1 }}
            >
              {getSectionTitle('personalityTraits')}
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {character.personalityTraits.map((trait, index) => (
                <li 
                  key={index} 
                  className="text-sm" 
                  style={{ 
                    color: visualTokens.textColor, 
                    opacity: 1,
                    lineHeight: '1.5',
                  }}
                >
                  {trait}
                </li>
              ))}
            </ul>
          </div>

          {/* Attributes (if available) */}
          {character.attributes && character.attributes.length > 0 && (
            <div>
              <h3 
                className="text-lg font-semibold mb-2" 
                style={{ color: visualTokens.textColor, opacity: 1 }}
              >
                {getSectionTitle('attributes')}
              </h3>
              <div className="space-y-2">
                {character.attributes.map((attr, index) => (
                  <div key={index} className="flex justify-between">
                    <span 
                      className="text-sm" 
                      style={{ color: visualTokens.textColor, opacity: 1 }}
                    >
                      {attr.name}:
                    </span>
                    <span 
                      className="text-sm font-medium" 
                      style={{ color: visualTokens.textColor, opacity: 1 }}
                    >
                      {attr.rating}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden Motivation - Visible to assigned Actor and Director */}
          {canSeeHiddenMotivation && (
            <div
              className="hidden-motivation p-4 rounded-lg"
              style={{
                backgroundColor: visualTokens.bgColor === '#0A0A0A' || visualTokens.bgColor === '#000000' || visualTokens.bgColor === '#141414' 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(0, 0, 0, 0.08)',
                border: `2px solid ${visualTokens.accentColor || visualTokens.primaryColor}`,
              }}
            >
              <h3 
                className="text-lg font-semibold mb-2" 
                style={{ 
                  color: visualTokens.accentColor || visualTokens.primaryColor,
                  opacity: 1,
                }}
              >
                {getSectionTitle('hiddenMotivation')}
                {isDirector && !isAssignedActor && (
                  <span 
                    className="ml-2 text-xs" 
                    style={{ opacity: 0.8 }}
                  >
                    (Director View)
                  </span>
                )}
              </h3>
              <p 
                className="text-sm" 
                style={{ 
                  color: visualTokens.textColor,
                  opacity: 1,
                  lineHeight: '1.6',
                }}
              >
                {character.hiddenMotivation}
              </p>
            </div>
          )}

          {/* Dialogue Lines Count */}
          <div 
            className="text-sm" 
            style={{ 
              color: visualTokens.textColor, 
              opacity: 0.85,
            }}
          >
            {dialogueLinesCount} dialogue line{dialogueLinesCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="mt-6">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-90"
          style={{
            backgroundColor: visualTokens.primaryColor,
            color: visualTokens.bgColor,
          }}
        >
          {getButtonLabel('back')}
        </button>
      </div>
    </div>
  );
}
