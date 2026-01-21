/**
 * Director Configuration Form
 * 
 * Form for configuring skit parameters with theme-specific styling
 * and integration with AI generation.
 */

'use client';

import { useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { SessionConfigurationSchema, type TonePreference, type DirectorDefinedCharacter } from '@/src/lib/validation/session-config-schema';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { chaosLevelAtom } from '@/src/state/atoms/chaos-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { generateSessionCode } from '@/src/lib/utils/session-code';
import { ErrorMessage } from '@/src/components/ui/error-message';
import type { Character } from '@/src/state/types/session';
import type { Script } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { clearSessionState } from '@/src/lib/utils/session-state-cleanup';

export function DirectorConfigForm() {
  const vibe = useAtomValue(vibeAtom);
  const { getSectionTitle, getPlaceholder, getButtonLabel, getErrorMessage, visualTokens } = useVibe();

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[DirectorConfigForm] Rendering with vibe:', vibe);
  }
  const [sessionCode, setSessionCode] = useAtom(sessionCodeAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const [cast, setCast] = useAtom(castAtom);
  const [script, setScript] = useAtom(currentScriptAtom);
  const [chaosLevel, setChaosLevel] = useAtom(chaosLevelAtom);
  const setParticipant = useSetAtom(participantAtom);

  const [theme, setTheme] = useState('');
  const [plot, setPlot] = useState('');
  const [jokes, setJokes] = useState('');
  const [directorDefinedCharacters, setDirectorDefinedCharacters] = useState<DirectorDefinedCharacter[]>([]);
  const [tone, setTone] = useState<TonePreference>('comedic');
  const [participantCount, setParticipantCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'idle' | 'characters' | 'generating'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState({
    characters: { completed: false, progress: 0 },
    script: { completed: false, progress: 0 },
    images: { completed: false, progress: 0, completedCount: 0, totalCount: 0 },
  });

  /**
   * Generate images for all characters in parallel
   * Updates characters with image URLs as they complete
   * Tracks progress for each image generation
   */
  const generateCharacterImages = async (
    characters: Character[],
    vibeContext: VibeType,
    onProgress?: (completed: number, total: number) => void
  ) => {
    const totalCount = characters.length;
    let completedCount = 0;

    // Generate images for all characters in parallel
    const imagePromises = characters.map(async (character, index) => {
      try {
        const response = await fetch('/api/openai/character-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': sessionCode || 'anonymous',
          },
          body: JSON.stringify({
            character: {
              id: character.id,
              name: character.name,
              archetypeLabel: character.archetypeLabel,
              personalityTraits: character.personalityTraits,
              attributes: character.attributes,
            },
            vibeContext,
            optionalImagePrompt: character.visualRepresentation.imagePrompt,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate image for ${character.name}`);
        }

        const imageData = await response.json();
        
        // Update the character with the image URL
        if (imageData.imageUrl) {
          setCast((currentCast) =>
            currentCast.map((c) =>
              c.id === character.id
                ? {
                    ...c,
                    visualRepresentation: {
                      ...c.visualRepresentation,
                      imageUrl: imageData.imageUrl,
                    },
                  }
                : c
            )
          );
        }

        // Update progress
        completedCount++;
        onProgress?.(completedCount, totalCount);
      } catch (error) {
        console.error(`Error generating image for ${character.name}:`, error);
        // Still count as completed (failed) to not block progress
        completedCount++;
        onProgress?.(completedCount, totalCount);
      }
    });

    // Wait for all images to complete
    await Promise.allSettled(imagePromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setLoadingStep('characters');
    // Reset progress state
    setGenerationProgress({
      characters: { completed: false, progress: 0 },
      script: { completed: false, progress: 0 },
      images: { completed: false, progress: 0, completedCount: 0, totalCount: 0 },
    });

    try {
      // Validate form data
      const formData = {
        theme,
        tone,
        participantCount,
        chaosLevel,
      };

      const validated = SessionConfigurationSchema.safeParse(formData);
      if (!validated.success) {
        setError(getErrorMessage('required'));
        setLoading(false);
        return;
      }

      // Generate session code if not exists
      // If starting a new session, clear any old session state first
      if (!sessionCode) {
        clearSessionState();
        const newCode = generateSessionCode();
        setSessionCode(newCode);
      }

      // Initialize director participant if not exists
      const directorId = `director-${sessionCode || 'temp'}-${Date.now()}`;
      setParticipant({
        id: directorId,
        sessionId: sessionCode || '',
        role: 'director',
        name: 'Director',
        characterAssignment: null,
        connectionStatus: 'disconnected',
        joinedAt: Date.now(),
        deviceInfo: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          screenSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      // Parse jokes (one per line, filter empty)
      const jokesArray = jokes
        .split('\n')
        .map(j => j.trim())
        .filter(j => j.length > 0);

      // Filter out empty character entries
      const validDirectorDefinedCharacters = directorDefinedCharacters
        .filter(char => char.name.trim().length > 0);

      // Generate characters
      const charactersResponse = await fetch('/api/openai/characters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': sessionCode || 'anonymous',
        },
        body: JSON.stringify({
          vibeContext: vibe,
          participantCount,
          theme,
          tone,
          directorDefinedCharacters: validDirectorDefinedCharacters.length > 0 ? validDirectorDefinedCharacters : undefined,
        }),
      });

      if (!charactersResponse.ok) {
        const errorData = await charactersResponse.json();
        throw new Error(errorData.error || 'Failed to generate characters');
      }

      const charactersData = await charactersResponse.json();
      const characters: Character[] = charactersData.characters.map((char: {
        name: string;
        archetypeLabel: string;
        personalityTraits: string[];
        hiddenMotivation: string;
        imagePrompt: string;
        attributes?: Array<{ name: string; rating: number }>;
      }, index: number) => ({
        id: `char-${index}`,
        sessionId: sessionCode || '',
        participantId: null,
        name: char.name,
        archetypeLabel: char.archetypeLabel,
        personalityTraits: char.personalityTraits,
        hiddenMotivation: char.hiddenMotivation,
        visualRepresentation: {
          imageUrl: '', // Will be generated separately
          imagePrompt: char.imagePrompt,
        },
        dialogueLines: [],
        attributes: char.attributes,
      }));

      setCast(characters);
      
      // Update progress: characters completed
      setGenerationProgress({
        characters: { completed: true, progress: 100 },
        script: { completed: false, progress: 0 },
        images: { completed: false, progress: 0, completedCount: 0, totalCount: characters.length },
      });
      setLoadingStep('generating');

      // Run script and image generation in parallel
      const [scriptResult, imageResult] = await Promise.allSettled([
        // Generate script
        (async () => {
          try {
            setGenerationProgress((prev) => ({
              ...prev,
              script: { ...prev.script, progress: 10 },
            }));

            const scriptResponse = await fetch('/api/openai/script', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': sessionCode || 'anonymous',
              },
              body: JSON.stringify({
                vibeContext: vibe,
                theme,
                tone,
                characters,
                sceneCount: Math.ceil(participantCount / 2),
                chaosLevel,
                plot: plot.trim() || undefined,
                jokes: jokesArray.length > 0 ? jokesArray : undefined,
              }),
            });

            if (!scriptResponse.ok) {
              const errorData = await scriptResponse.json();
              throw new Error(errorData.error || 'Failed to generate script');
            }

            const scriptData = await scriptResponse.json();
            const script: Script = {
              id: `script-${Date.now()}`,
              sessionId: sessionCode || '',
              vibeContext: vibe,
              title: scriptData.title,
              length: scriptData.length,
              description: scriptData.description,
              scenes: scriptData.scenes,
              generatedAt: Date.now(),
              version: 1,
            };

            setScript(script);
            setGenerationProgress((prev) => ({
              ...prev,
              script: { completed: true, progress: 100 },
            }));

            return script;
          } catch (error) {
            setGenerationProgress((prev) => ({
              ...prev,
              script: { completed: false, progress: 0 },
            }));
            throw error;
          }
        })(),
        
        // Generate character images
        generateCharacterImages(characters, vibe, (completed, total) => {
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          setGenerationProgress((prev) => ({
            ...prev,
            images: {
              completed: completed >= total,
              progress,
              completedCount: completed,
              totalCount: total,
            },
          }));
        }),
      ]);

      // Check if script generation failed
      if (scriptResult.status === 'rejected') {
        throw scriptResult.reason;
      }

      // Get the generated script
      const script = scriptResult.value;

      // Log image generation errors but don't block (images are optional)
      if (imageResult.status === 'rejected') {
        console.error('Failed to generate some character images:', imageResult.reason);
      }

      // Mark images as completed even if some failed
      setGenerationProgress((prev) => ({
        ...prev,
        images: { ...prev.images, completed: true, progress: 100 },
      }));
      
      // Create session in API route store
      const createSessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionCode,
          vibeContext: vibe,
          configuration: validated.data,
          cast: characters,
          script,
        }),
      });

      if (!createSessionResponse.ok) {
        const errorData = await createSessionResponse.json();
        // Log error but don't fail the form submission since session exists in socket store
        console.warn('Failed to create session in API store:', errorData.error);
      }

      // Brief delay to show 100% completion before hiding
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setSessionState('casting');
      setLoading(false);
      setLoadingStep('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
      setLoadingStep('idle');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="director-config-form"
      style={{
        padding: visualTokens.cardStyle.padding,
        gap: visualTokens.cardStyle.gap,
        border: visualTokens.cardStyle.borderStyle,
        boxShadow: visualTokens.cardStyle.shadowStyle,
        borderRadius: visualTokens.borderRadius,
      }}
    >
      <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: visualTokens.headerFont }}>
        {getSectionTitle('configuration')}
      </h2>

      {error && <ErrorMessage message={error} />}

      {loading && (
        <div className="loading-indicator p-6 border rounded-lg mb-4" style={{ borderColor: 'var(--color-primary)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {loadingStep === 'characters' 
                  ? 'Generating Characters...' 
                  : 'Generating Content...'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {loadingStep === 'characters' 
                  ? 'Creating unique characters with personalities and motivations...'
                  : loadingStep === 'generating'
                  ? (() => {
                      const { script, images } = generationProgress;
                      if (!script.completed && !images.completed) {
                        return 'Writing script and generating character images in parallel...';
                      } else if (!script.completed) {
                        return 'Writing the script with dialogue, scenes, and stage directions...';
                      } else if (!images.completed) {
                        return `Generating character images (${images.completedCount}/${images.totalCount})...`;
                      }
                      return 'Finalizing...';
                    })()
                  : 'This may take up to 2 minutes. Please wait...'}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5" style={{ backgroundColor: 'var(--color-bg-secondary, #e5e7eb)' }}>
            <div 
              className="h-2.5 rounded-full transition-all duration-500" 
              style={{ 
                backgroundColor: 'var(--color-primary)',
                width: (() => {
                  if (loadingStep === 'characters') {
                    // Characters: 0-30% (30% of total)
                    return `${Math.round(generationProgress.characters.progress * 0.3)}%`;
                  } else if (loadingStep === 'generating') {
                    // Progress breakdown for clarity:
                    // Characters: 0-30% (30% of total, must complete first)
                    // Script + Images (parallel): 30-100% (70% of total)
                    // Progress fills based on average of both parallel tasks for smoother UX
                    const { characters, script, images } = generationProgress;
                    const baseProgress = characters.completed ? 30 : 0;
                    
                    // Calculate average progress of parallel tasks
                    // This ensures smooth progress even if one completes before the other
                    const scriptProgressValue = script.completed ? 100 : script.progress;
                    const imagesProgressValue = images.completed ? 100 : images.progress;
                    const averageParallelProgress = (scriptProgressValue + imagesProgressValue) / 2;
                    
                    // Apply the 70% range (30% to 100%)
                    const parallelProgress = Math.round(averageParallelProgress * 0.7);
                    const totalProgress = baseProgress + parallelProgress;
                    
                    return `${Math.min(totalProgress, 100)}%`;
                  }
                  return '0%';
                })(),
                animation: loadingStep === 'characters' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
              }}
            ></div>
          </div>
          {loadingStep === 'generating' && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Characters</span>
                <span className={generationProgress.characters.completed ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                  {generationProgress.characters.completed ? '✓ Complete' : 'In progress...'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Script</span>
                <span className={generationProgress.script.completed ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                  {generationProgress.script.completed ? '✓ Complete' : 'In progress...'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">
                  Images ({generationProgress.images.completedCount}/{generationProgress.images.totalCount})
                </span>
                <span className={generationProgress.images.completed ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                  {generationProgress.images.completed 
                    ? '✓ Complete' 
                    : `In progress (${generationProgress.images.completedCount}/${generationProgress.images.totalCount})`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label htmlFor="theme" className="block mb-2" style={{ color: 'var(--color-text)' }}>
          Theme <span className="text-sm" style={{ color: 'var(--color-muted)' }}>(brief description)</span>
        </label>
        <textarea
          id="theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder={getPlaceholder('theme')}
          minLength={10}
          maxLength={200}
          required
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          rows={3}
          style={{
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-border)',
            fontFamily: visualTokens.bodyFont,
            '--tw-ring-color': 'var(--color-border-focus)',
          } as React.CSSProperties}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-border-focus)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--color-border)';
          }}
        />
        <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          {theme.length}/200 characters
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label htmlFor="plot" className="block mb-2" style={{ color: 'var(--color-text)' }}>
          Plot <span className="text-sm" style={{ color: 'var(--color-muted)' }}>(optional - detailed plot context)</span>
        </label>
        <textarea
          id="plot"
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          placeholder="Enter a detailed plot description, story beats, or specific narrative elements you want included..."
          maxLength={2000}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          rows={6}
          style={{
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-border)',
            fontFamily: visualTokens.bodyFont,
            '--tw-ring-color': 'var(--color-border-focus)',
          } as React.CSSProperties}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-border-focus)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--color-border)';
          }}
        />
        <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          {plot.length}/2000 characters
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label htmlFor="tone" className="block mb-2" style={{ color: 'var(--color-text)' }}>
          Tone
        </label>
        <select
          id="tone"
          value={tone}
          onChange={(e) => setTone(e.target.value as TonePreference)}
          required
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-border)',
            fontFamily: visualTokens.bodyFont,
            '--tw-ring-color': 'var(--color-border-focus)',
          } as React.CSSProperties}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-border-focus)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--color-border)';
          }}
        >
          <option value="comedic">Comedic</option>
          <option value="dramatic">Dramatic</option>
          <option value="satirical">Satirical</option>
          <option value="absurd">Absurd</option>
          <option value="serious">Serious</option>
          <option value="romantic">Romantic</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label htmlFor="participantCount" className="block mb-2">
          Participants: {participantCount}
        </label>
        <input
          type="range"
          id="participantCount"
          min={2}
          max={10}
          value={participantCount}
          onChange={(e) => setParticipantCount(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label htmlFor="chaosLevel" className="block mb-2" style={{ color: 'var(--color-text)' }}>
          Chaos Level: <span style={{ color: 'var(--color-accent)', fontWeight: '600' }}>{chaosLevel}</span>
        </label>
        <input
          type="range"
          id="chaosLevel"
          min={1}
          max={10}
          value={chaosLevel}
          onChange={(e) => setChaosLevel(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label htmlFor="jokes" className="block mb-2" style={{ color: 'var(--color-text)' }}>
          Jokes & Phrases <span className="text-sm" style={{ color: 'var(--color-muted)' }}>(optional - one per line)</span>
        </label>
        <textarea
          id="jokes"
          value={jokes}
          onChange={(e) => setJokes(e.target.value)}
          placeholder="Enter specific jokes, phrases, or dialogue you want incorporated into the script (one per line)..."
          maxLength={1000}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          rows={4}
          style={{
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-border)',
            fontFamily: visualTokens.bodyFont,
            '--tw-ring-color': 'var(--color-border-focus)',
          } as React.CSSProperties}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-border-focus)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--color-border)';
          }}
        />
        <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          {jokes.split('\n').filter(j => j.trim().length > 0).length} joke(s) entered
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: visualTokens.spacing.component }}>
        <label className="block mb-2" style={{ color: 'var(--color-text)' }}>
          Pre-Defined Characters <span className="text-sm" style={{ color: 'var(--color-muted)' }}>(optional)</span>
        </label>
        <div className="space-y-2">
          {directorDefinedCharacters.map((char, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={char.name}
                onChange={(e) => {
                  const updated = [...directorDefinedCharacters];
                  updated[index] = { ...updated[index], name: e.target.value };
                  setDirectorDefinedCharacters(updated);
                }}
                placeholder="Character name"
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                  fontFamily: visualTokens.bodyFont,
                  '--tw-ring-color': 'var(--color-border-focus)',
                } as React.CSSProperties}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-border-focus)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)';
                }}
              />
              <input
                type="text"
                value={char.role || ''}
                onChange={(e) => {
                  const updated = [...directorDefinedCharacters];
                  updated[index] = { ...updated[index], role: e.target.value || undefined };
                  setDirectorDefinedCharacters(updated);
                }}
                placeholder="Role (optional)"
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                  fontFamily: visualTokens.bodyFont,
                  '--tw-ring-color': 'var(--color-border-focus)',
                } as React.CSSProperties}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-border-focus)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)';
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setDirectorDefinedCharacters(directorDefinedCharacters.filter((_, i) => i !== index));
                }}
                className="px-3 py-1 rounded"
                style={{
                  backgroundColor: 'var(--color-error, #ef4444)',
                  color: 'var(--color-bg)',
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setDirectorDefinedCharacters([...directorDefinedCharacters, { name: '' }]);
            }}
            className="text-sm px-3 py-1 border rounded hover:bg-opacity-10 transition-colors"
            style={{
              borderColor: 'var(--color-accent)',
              color: 'var(--color-accent)',
            }}
          >
            + Add Character
          </button>
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          Pre-define characters you want included. The AI will incorporate these and generate additional characters to reach the participant count.
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 rounded font-semibold disabled:opacity-50"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-bg)',
          fontFamily: visualTokens.headerFont,
        }}
      >
        {loading ? 'Generating...' : getButtonLabel('submit')}
      </button>
    </form>
  );
}
