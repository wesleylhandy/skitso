/**
 * Director Configuration Form
 *
 * Form for configuring skit parameters with theme-specific styling
 * and integration with AI generation.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useVibe } from "@/src/lib/hooks/use-vibe";
import {
  SessionConfigurationSchema,
  type TonePreference,
  type DirectorDefinedCharacter,
} from "@/src/lib/validation/session-config-schema";
import { sessionCodeAtom } from "@/src/state/atoms/session-atom";
import { sessionStateAtom } from "@/src/state/atoms/session-state-atom";
import { castAtom } from "@/src/state/atoms/cast-atom";
import { currentScriptAtom } from "@/src/state/atoms/script-atom";
import { chaosLevelAtom } from "@/src/state/atoms/chaos-atom";
import { participantAtom } from "@/src/state/atoms/participant-atom";
import { generateSessionCode } from "@/src/lib/utils/session-code";
import { ErrorMessage } from "@/src/components/ui/error-message";
import type { Character } from "@/src/state/types/session";
import type { Script } from "@/src/state/types/session";
import type { VibeType } from "@/src/state/types/vibe";
import { vibeAtom } from "@/src/state/atoms/vibe-atom";
import { clearSessionState } from "@/src/lib/utils/session-state-cleanup";
import {
  initializePartyKitClient,
  joinSessionAndWait,
  updateSessionState,
  updateCast,
  updateScript,
  emitGenerationProgress,
  onCastUpdate,
  onReconnect,
  fetchSessionState,
  onScriptUpdate,
  onGenerationProgress,
} from "@/src/lib/partykit/client";

export function DirectorConfigForm() {
  const vibe = useAtomValue(vibeAtom);
  const {
    getSectionTitle,
    getPlaceholder,
    getButtonLabel,
    getErrorMessage,
    visualTokens,
  } = useVibe();
  const errorColor = visualTokens.errorColor;

  const [sessionCode, setSessionCode] = useAtom(sessionCodeAtom);
  const setSessionState = useSetAtom(sessionStateAtom);
  const [cast, setCast] = useAtom(castAtom);
  const [script, setScript] = useAtom(currentScriptAtom);
  const [chaosLevel, setChaosLevel] = useAtom(chaosLevelAtom);
  const setParticipant = useSetAtom(participantAtom);
  const participant = useAtomValue(participantAtom);

  // Guarantee a valid 1–10 number for controlled inputs (atom can be undefined during hydration)
  const chaosValue = Math.min(
    10,
    Math.max(1, typeof chaosLevel === "number" && !Number.isNaN(chaosLevel) ? chaosLevel : 5),
  );

  // Ref to track latest cast value for async operations
  // This allows us to read the latest cast atom value in async functions
  const castRef = useRef<Character[]>(cast);

  // Keep ref in sync with atom
  castRef.current = cast;

  const [theme, setTheme] = useState("");
  const [plot, setPlot] = useState("");
  const [jokes, setJokes] = useState("");
  const [directorDefinedCharacters, setDirectorDefinedCharacters] = useState<
    DirectorDefinedCharacter[]
  >([]);
  const [tone, setTone] = useState<TonePreference>("comedic");
  const [participantCount, setParticipantCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<
    "idle" | "characters" | "generating"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState({
    characters: { completed: false, progress: 0 },
    script: { completed: false, progress: 0 },
    images: { completed: false, progress: 0, completedCount: 0, totalCount: 0 },
  });
  const [generationAbortController, setGenerationAbortController] =
    useState<AbortController | null>(null);

  // Listen for PartyKit cast updates to keep atom in sync
  // This handles cases where PartyKit sends updates (e.g., state recovery, other clients)
  useEffect(() => {
    if (!sessionCode) {
      return;
    }

    const unsubscribeCastUpdate = onCastUpdate((data) => {
      if (data.sessionId === sessionCode) {
        console.log(
          "[DirectorConfigForm] Received cast:updated from PartyKit, updating atom",
        );
        setCast(data.cast);
        castRef.current = data.cast; // Update ref to match
      }
    });

    return () => {
      unsubscribeCastUpdate();
    };
  }, [sessionCode, setCast]);

  // Handle reconnection during generation
  // If connection drops while generating, recover state and resume monitoring
  useEffect(() => {
    if (!sessionCode || !loading) {
      return;
    }

    let mounted = true;

    const handleReconnection = async (data: { sessionId: string }) => {
      if (data.sessionId !== sessionCode || !mounted) {
        return;
      }

      // Only handle reconnection if we're currently generating
      if (!loading || loadingStep === "idle") {
        return;
      }

      console.log(
        "[DirectorConfigForm] Reconnection detected during generation, recovering state",
        {
          sessionId: sessionCode,
          loadingStep,
          loading,
        },
      );

      try {
        // Fetch current state from PartyKit
        const recoveredState = await fetchSessionState(sessionCode);

        if (!recoveredState || !mounted) {
          return;
        }

        // Update local state to match server state
        if (recoveredState.cast && recoveredState.cast.length > 0) {
          setCast(recoveredState.cast);
          castRef.current = recoveredState.cast;

          // Check if characters are complete
          const allCharactersHaveImages = recoveredState.cast.every(
            (char) =>
              char.visualRepresentation?.imageUrl &&
              char.visualRepresentation.imageUrl.length > 0,
          );

          if (allCharactersHaveImages) {
            setGenerationProgress((prev) => ({
              ...prev,
              characters: { completed: true, progress: 100 },
              images: {
                completed: true,
                progress: 100,
                completedCount: recoveredState.cast.length,
                totalCount: recoveredState.cast.length,
              },
            }));
          } else {
            // Some images still generating, update progress
            const imagesCompleted = recoveredState.cast.filter(
              (char) =>
                char.visualRepresentation?.imageUrl &&
                char.visualRepresentation.imageUrl.length > 0,
            ).length;
            const totalImages = recoveredState.cast.length;

            setGenerationProgress((prev) => ({
              ...prev,
              characters: { completed: true, progress: 100 },
              images: {
                completed: imagesCompleted >= totalImages,
                progress: totalImages > 0 ? Math.round((imagesCompleted / totalImages) * 100) : 0,
                completedCount: imagesCompleted,
                totalCount: totalImages,
              },
            }));
          }
        }

        if (recoveredState.script) {
          setScript(recoveredState.script);
          setGenerationProgress((prev) => ({
            ...prev,
            script: { completed: true, progress: 100 },
          }));
        }

        // Check if generation is complete based on recovered state
        const hasCompleteScript = recoveredState.script !== null;
        const hasCompleteCast =
          recoveredState.cast && recoveredState.cast.length > 0;
        const allImagesGenerated =
          hasCompleteCast &&
          recoveredState.cast!.every(
            (char) =>
              char.visualRepresentation?.imageUrl &&
              char.visualRepresentation.imageUrl.length > 0,
          );

        // If generation is complete, transition to casting state
        if (hasCompleteScript && hasCompleteCast && allImagesGenerated) {
          console.log(
            "[DirectorConfigForm] Generation complete after reconnection, transitioning to casting",
          );
          setSessionState("casting");
          updateSessionState(sessionCode, "casting");
          setLoading(false);
          setLoadingStep("idle");
          setGenerationAbortController(null);
        } else if (recoveredState.status === "casting") {
          // Server says we're in casting state, but we're still loading
          // This means generation completed while we were disconnected
          console.log(
            "[DirectorConfigForm] Server state is casting, generation must have completed",
          );
          setSessionState("casting");
          setLoading(false);
          setLoadingStep("idle");
          setGenerationAbortController(null);
        } else {
          // Generation still in progress, continue monitoring
          console.log(
            "[DirectorConfigForm] Generation still in progress after reconnection",
            {
              hasCompleteScript,
              hasCompleteCast,
              allImagesGenerated,
              serverStatus: recoveredState.status,
            },
          );
        }
      } catch (error) {
        console.error(
          "[DirectorConfigForm] Failed to recover state after reconnection:",
          error,
        );
        // Continue with current generation state - don't fail completely
      }
    };

    // Listen for script updates during reconnection recovery
    const unsubscribeScript = onScriptUpdate((data) => {
      if (data.sessionId === sessionCode && mounted && loading) {
        setScript(data.script);
        setGenerationProgress((prev) => ({
          ...prev,
          script: { completed: true, progress: 100 },
        }));
      }
    });

    // Listen for generation progress updates during reconnection recovery
    const unsubscribeGenerationProgress = onGenerationProgress((data) => {
      if (data.sessionId === sessionCode && mounted && loading) {
        // Update progress based on phase
        if (data.phase === "characters") {
          setGenerationProgress((prev) => ({
            ...prev,
            characters: { completed: false, progress: 50 },
          }));
          setLoadingStep("characters");
        } else if (data.phase === "script" || data.phase === "images") {
          setGenerationProgress((prev) => ({
            ...prev,
            script: { completed: false, progress: 50 },
          }));
          setLoadingStep("generating");
        }
      }
    });

    const unsubscribeReconnect = onReconnect(handleReconnection);

    return () => {
      mounted = false;
      unsubscribeReconnect();
      unsubscribeScript();
      unsubscribeGenerationProgress();
    };
  }, [sessionCode, loading, loadingStep, setCast, setScript, setSessionState]);

  /**
   * Generate images for all characters in parallel
   * Updates characters with image URLs as they complete
   * Tracks progress for each image generation
   * Returns the final cast with all image URLs
   *
   * CRITICAL: Uses atomic updates to prevent race conditions.
   * Each image update is applied to the atom, and we only sync
   * to PartyKit once at the end to avoid multiple conflicting updates.
   */
  const generateCharacterImages = async (
    sessionId: string,
    characters: Character[],
    vibeContext: VibeType,
    onProgress?: (completed: number, total: number) => void,
    abortSignal?: AbortSignal,
  ): Promise<Character[]> => {
    const totalCount = characters.length;
    let completedCount = 0;

    // Track image URLs as they're generated (characterId -> imageUrl)
    const imageUrlMap = new Map<string, string>();

    // Generate images for all characters in parallel
    const imagePromises = characters.map(async (character) => {
      try {
        const response = await fetch("/api/openai/character-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": sessionId || "anonymous",
          },
          body: JSON.stringify({
            character: {
              id: character.id,
              name: character.name,
              archetypeLabel: character.archetypeLabel,
              personalityTraits: character.personalityTraits,
              hiddenMotivation: character.hiddenMotivation,
              attributes: character.attributes,
            },
            vibeContext,
            optionalImagePrompt: character.visualRepresentation.imagePrompt,
            sessionId,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(`Failed to generate image for ${character.name}`);
        }

        const imageData = await response.json();

        // Update the character with the image URL
        if (imageData.imageUrl) {
          // Store image URL in map
          imageUrlMap.set(character.id, imageData.imageUrl);

          // Update cast atom atomically - use functional update to ensure we have latest state
          // This prevents race conditions when multiple images complete simultaneously
          setCast((currentCast) => {
            // Find the character in current cast (may have been updated by PartyKit)
            const existingChar = currentCast.find((c) => c.id === character.id);
            let updatedCast: Character[];
            if (existingChar) {
              // Update existing character
              updatedCast = currentCast.map((c) =>
                c.id === character.id
                  ? {
                      ...c,
                      visualRepresentation: {
                        ...c.visualRepresentation,
                        imageUrl: imageData.imageUrl,
                      },
                    }
                  : c,
              );
            } else {
              // Character not found in current cast (shouldn't happen, but handle gracefully)
              // Add it with the image URL
              updatedCast = [
                ...currentCast,
                {
                  ...character,
                  visualRepresentation: {
                    ...character.visualRepresentation,
                    imageUrl: imageData.imageUrl,
                  },
                },
              ];
            }

            // CRITICAL: Sync cast to PartyKit immediately when each image completes
            // This ensures actors joining during generation see characters as images are generated
            // Debounce rapid updates to avoid overwhelming PartyKit
            const syncDelay = 200; // 200ms delay to batch rapid image completions
            setTimeout(() => {
              if (sessionId && updatedCast.length > 0) {
                try {
                  updateCast(sessionId, updatedCast);
                  console.log(
                    "[DirectorConfigForm] Cast updated in PartyKit after image generation:",
                    {
                      sessionId,
                      castLength: updatedCast.length,
                      characterWithImage: character.name,
                    },
                  );
                } catch (error) {
                  console.error(
                    "Failed to sync cast after image generation:",
                    error,
                  );
                  // Continue - will sync at end
                }
              }
            }, syncDelay);

            return updatedCast;
          });
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

    // CRITICAL: Read the latest cast from the atom to ensure we have all updates
    // This includes any PartyKit updates that may have happened during generation
    // We need to use a getter function since we can't directly read the atom here
    // Instead, we'll build from the map and then sync, letting the atom be the source of truth

    // Build final cast with all image URLs from the map
    // But we'll read from atom in the final sync to ensure consistency
    const finalCastWithAllImages: Character[] = characters.map((char) => {
      const imageUrl = imageUrlMap.get(char.id);
      if (imageUrl) {
        return {
          ...char,
          visualRepresentation: {
            ...char.visualRepresentation,
            imageUrl,
          },
        };
      }
      return char;
    });

    console.log("[DirectorConfigForm] Final cast after image generation:", {
      castLength: finalCastWithAllImages.length,
      charactersWithImages: finalCastWithAllImages.filter(
        (char) =>
          char.visualRepresentation?.imageUrl &&
          char.visualRepresentation.imageUrl.length > 0,
      ).length,
      imageUrls: finalCastWithAllImages.map((char) => ({
        name: char.name,
        hasImage: Boolean(
          char.visualRepresentation?.imageUrl &&
          char.visualRepresentation.imageUrl.length > 0,
        ),
        imageUrl: char.visualRepresentation?.imageUrl || null,
      })),
    });

    // Return the final cast with all image URLs
    return finalCastWithAllImages;
  };

  const handleCancelGeneration = () => {
    if (generationAbortController) {
      generationAbortController.abort();
      setGenerationAbortController(null);
    }
    setLoading(false);
    setLoadingStep("idle");
    setError("Generation cancelled");
    setGenerationProgress({
      characters: { completed: false, progress: 0 },
      script: { completed: false, progress: 0 },
      images: {
        completed: false,
        progress: 0,
        completedCount: 0,
        totalCount: 0,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setLoadingStep("characters");

    // Create abort controller for cancellation
    const abortController = new AbortController();
    setGenerationAbortController(abortController);

    // Reset progress state
    setGenerationProgress({
      characters: { completed: false, progress: 0 },
      script: { completed: false, progress: 0 },
      images: {
        completed: false,
        progress: 0,
        completedCount: 0,
        totalCount: 0,
      },
    });

    try {
      // Validate form data
      const formData = {
        theme,
        tone,
        participantCount,
        chaosLevel: chaosValue,
      };

      const validated = SessionConfigurationSchema.safeParse(formData);
      if (!validated.success) {
        setError(getErrorMessage("required"));
        setLoading(false);
        return;
      }

      // Generate session code if not exists
      // If starting a new session, clear any old session state first
      let code = sessionCode;
      if (!code) {
        clearSessionState();
        code = generateSessionCode();
        setSessionCode(code);
      }

      // Initialize director participant if not exists
      const directorId = `director-${code || "temp"}-${Date.now()}`;
      setParticipant({
        id: directorId,
        sessionId: code || "",
        role: "director",
        name: "Director",
        characterAssignment: null,
        assignmentStatus: "none",
        requestedCharacterId: null,
        connectionStatus: "disconnected",
        joinedAt: Date.now(),
        deviceInfo: {
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
          screenSize:
            typeof window !== "undefined"
              ? `${window.innerWidth}x${window.innerHeight}`
              : "unknown",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      // Join PartyKit session as director BEFORE any director-only messages.
      // requireDirector rejects script/cast/state updates from non-joined senders.
      if (code) {
        try {
          initializePartyKitClient(code);
          await joinSessionAndWait(code, directorId, {
            role: "director",
            name: "Director",
            vibeContext: vibe,
          });
        } catch (err) {
          console.error("Director joinSessionAndWait failed:", err);
          setError(
            getErrorMessage("network") ??
              "Could not join session. Check connection and try again."
          );
          setLoading(false);
          return;
        }
      }

      // Create session in PartyKit BEFORE generation starts
      // This ensures the session exists for participants trying to join during generation
      if (code) {
        try {
          const createSessionResponse = await fetch("/api/sessions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: code,
              vibeContext: vibe,
              configuration: validated.data,
              // Cast and script will be added later after generation
            }),
          });

          if (!createSessionResponse.ok) {
            const errorData = await createSessionResponse.json();
            // If session already exists (409), that's fine - continue
            if (createSessionResponse.status === 409) {
              console.log("Session already exists in PartyKit:", code);
            } else {
              console.warn(
                "Failed to create session before generation:",
                errorData.error,
              );
            }
            // Continue anyway - session might already exist or will be created later
          } else {
            console.log("Session created in PartyKit before generation:", code);
          }
        } catch (error) {
          console.error("Error creating session before generation:", error);
          // Continue anyway - session creation will be retried after generation
        }
      }

      // Set state to "configuring" during generation
      // This prevents join page from showing "casting" state before content is ready
      setSessionState("configuring");
      if (code) {
        updateSessionState(code, "configuring");
        emitGenerationProgress(
          code,
          "characters",
          getSectionTitle("loadingCharactersTitle"),
        );
      }

      // Parse jokes (one per line, filter empty)
      const jokesArray = jokes
        .split("\n")
        .map((j) => j.trim())
        .filter((j) => j.length > 0);

      // Filter out empty character entries
      const validDirectorDefinedCharacters = directorDefinedCharacters.filter(
        (char) => char.name.trim().length > 0,
      );

      // Generate characters
      const charactersResponse = await fetch("/api/openai/characters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": code || "anonymous",
        },
        body: JSON.stringify({
          vibeContext: vibe,
          participantCount,
          theme,
          tone,
          directorDefinedCharacters:
            validDirectorDefinedCharacters.length > 0
              ? validDirectorDefinedCharacters
              : undefined,
        }),
        signal: abortController.signal,
      });

      if (!charactersResponse.ok) {
        const errorData = await charactersResponse.json();
        throw new Error(errorData.error || "Failed to generate characters");
      }

      const charactersData = await charactersResponse.json();
      const characters: Character[] = charactersData.characters.map(
        (
          char: {
            name: string;
            archetypeLabel: string;
            personalityTraits: string[];
            hiddenMotivation: string;
            imagePrompt: string;
            attributes?: Array<{ name: string; rating: number }>;
          },
          index: number,
        ) => ({
          id: `char-${index}`,
          sessionId: code || "",
          participantId: null,
          isLocked: false,
          name: char.name,
          archetypeLabel: char.archetypeLabel,
          personalityTraits: char.personalityTraits,
          hiddenMotivation: char.hiddenMotivation,
          visualRepresentation: {
            imageUrl: "", // Will be generated separately
            imagePrompt: char.imagePrompt,
          },
          dialogueLines: [],
          attributes: char.attributes,
        }),
      );

      setCast(characters);
      castRef.current = characters; // Update ref

      // Check if cancelled before syncing
      if (abortController.signal.aborted) {
        return;
      }

      // CRITICAL: Sync cast immediately when generated so join page can see it
      // Don't wait until the end - actors joining during generation need to see cast
      if (code && characters.length > 0) {
        try {
          updateCast(code, characters);
          console.log(
            "[DirectorConfigForm] Cast sent to PartyKit immediately after generation:",
            {
              sessionCode: code,
              castLength: characters.length,
            },
          );
        } catch (error) {
          console.error("Failed to send cast to PartyKit immediately:", error);
          // Continue - will retry at end
        }
      }

      // Update progress: characters completed
      setGenerationProgress({
        characters: { completed: true, progress: 100 },
        script: { completed: false, progress: 0 },
        images: {
          completed: false,
          progress: 0,
          completedCount: 0,
          totalCount: characters.length,
        },
      });
      setLoadingStep("generating");

      // Emit progress for Join page (script + images phase)
      if (code) {
        emitGenerationProgress(
          code,
          "script",
          getPlaceholder("loadingGeneratingBody"),
        );
      }

      // Run script and image generation in parallel
      const [scriptResult, imageResult] = await Promise.allSettled([
        // Generate script
        (async () => {
          try {
            setGenerationProgress((prev) => ({
              ...prev,
              script: { ...prev.script, progress: 10 },
            }));

            const scriptResponse = await fetch("/api/openai/script", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": sessionCode || "anonymous",
              },
              body: JSON.stringify({
                vibeContext: vibe,
                theme,
                tone,
                characters,
                sceneCount: Math.ceil(participantCount / 2),
                chaosLevel: chaosValue,
                plot: plot.trim() || undefined,
                jokes: jokesArray.length > 0 ? jokesArray : undefined,
              }),
              signal: abortController.signal,
            });

            if (!scriptResponse.ok) {
              const errorData = await scriptResponse.json();
              throw new Error(errorData.error || "Failed to generate script");
            }

            const scriptData = await scriptResponse.json();
            const script: Script = {
              id: `script-${Date.now()}`,
              sessionId: code || "",
              vibeContext: vibe,
              title: scriptData.title,
              length: scriptData.length,
              description: scriptData.description,
              scenes: scriptData.scenes,
              generatedAt: Date.now(),
              version: 1,
            };

            setScript(script);

            // CRITICAL: Sync script immediately when generated so join page can see it
            // Don't wait until the end - actors joining during generation need to see script
            if (code && script) {
              try {
                updateScript(code, script);
                console.log(
                  "[DirectorConfigForm] Script sent to PartyKit immediately after generation:",
                  {
                    sessionCode: code,
                    scriptTitle: script.title,
                  },
                );
              } catch (error) {
                console.error(
                  "Failed to send script to PartyKit immediately:",
                  error,
                );
                // Continue - will retry at end
              }
            }

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

        // Generate character images (returns final cast with all image URLs)
        generateCharacterImages(
          code,
          characters,
          vibe,
          (completed, total) => {
            const progress =
              total > 0 ? Math.round((completed / total) * 100) : 0;
            setGenerationProgress((prev) => ({
              ...prev,
              images: {
                completed: completed >= total,
                progress,
                completedCount: completed,
                totalCount: total,
              },
            }));
          },
          abortController.signal,
        ),
      ]);

      // Check if cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Check if script generation failed
      if (scriptResult.status === "rejected") {
        // Don't throw if it was aborted
        if (
          scriptResult.reason instanceof Error &&
          scriptResult.reason.name === "AbortError"
        ) {
          return;
        }
        throw scriptResult.reason;
      }

      // Get the generated script
      const script = scriptResult.value;

      // Get the final cast with all image URLs
      // CRITICAL: The cast atom is the source of truth - it's been updated atomically
      // during image generation. We need to ensure it has all image URLs before syncing.
      let finalCastWithImages: Character[] = characters;
      if (imageResult.status === "fulfilled") {
        // Use the returned cast from generateCharacterImages as a base
        finalCastWithImages = imageResult.value;

        // CRITICAL: Update the atom with the final cast to ensure consistency
        // This merges any PartyKit updates that may have happened during generation
        setCast((currentCast) => {
          // Merge: use image URLs from finalCastWithImages, but preserve any other
          // updates from PartyKit (like participantId, isLocked, etc.)
          const mergedCast = currentCast.map((currentChar) => {
            const finalChar = finalCastWithImages.find(
              (f) => f.id === currentChar.id,
            );
            if (finalChar && finalChar.visualRepresentation?.imageUrl) {
              // Preserve current character state but update image URL
              return {
                ...currentChar,
                visualRepresentation: {
                  ...currentChar.visualRepresentation,
                  imageUrl: finalChar.visualRepresentation.imageUrl,
                },
              };
            }
            return currentChar;
          });

          // Add any new characters from finalCastWithImages that aren't in currentCast
          finalCastWithImages.forEach((finalChar) => {
            if (!mergedCast.find((c) => c.id === finalChar.id)) {
              mergedCast.push(finalChar);
            }
          });

          // Update ref with merged cast
          castRef.current = mergedCast;
          return mergedCast;
        });

        // Use ref value (which was just updated) for final sync
        finalCastWithImages = castRef.current;

        console.log(
          "[DirectorConfigForm] Final cast with images (merged with atom):",
          {
            castLength: finalCastWithImages.length,
            charactersWithImages: finalCastWithImages.filter(
              (char) =>
                char.visualRepresentation?.imageUrl &&
                char.visualRepresentation.imageUrl.length > 0,
            ).length,
            imageUrls: finalCastWithImages.map((char) => ({
              name: char.name,
              hasImage: Boolean(
                char.visualRepresentation?.imageUrl &&
                char.visualRepresentation.imageUrl.length > 0,
              ),
              imageUrl: char.visualRepresentation?.imageUrl || null,
            })),
          },
        );
      } else {
        console.error(
          "Failed to generate some character images:",
          imageResult.reason,
        );
        // If image generation failed, use current cast from atom (might have partial images)
        finalCastWithImages = castRef.current;
      }

      // Mark images as completed even if some failed
      setGenerationProgress((prev) => ({
        ...prev,
        images: { ...prev.images, completed: true, progress: 100 },
      }));

      // Update session in PartyKit with latest configuration only
      // Cast and script are synced via PartyKit messages (updateCast/updateScript)
      if (sessionCode) {
        try {
          const updateSessionResponse = await fetch("/api/sessions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: sessionCode,
              vibeContext: vibe,
              configuration: validated.data,
            }),
          });

          if (!updateSessionResponse.ok) {
            const errorData = await updateSessionResponse.json();
            // If session doesn't exist, try creating it (shouldn't happen, but handle gracefully)
            if (
              errorData.error === "Session not found" ||
              updateSessionResponse.status === 404
            ) {
              console.warn(
                "Session not found during update, this should not happen:",
                errorData.error,
              );
            } else {
              console.warn(
                "Failed to update session with cast and script:",
                errorData.error,
              );
            }
          } else {
            console.log("Session updated with cast and script:", sessionCode);
          }
        } catch (error) {
          console.error("Error updating session with cast and script:", error);
          // Don't fail the form submission
        }
      }

      // CRITICAL: Final sync to PartyKit - wait for all state updates, then sync everything at once
      // This ensures script, cast with all images are synced together in the final state
      // Use a longer delay to ensure React has flushed all state updates
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Re-read from ref (which tracks atom) to ensure we have the absolute latest with all images
      // The atom should have all images because we updated it incrementally during generation
      let finalCastForSync = castRef.current;
      const finalScriptForSync = script; // Script atom should be updated by now

      // If castRef doesn't have all images, try using finalCastWithImages as fallback
      // This can happen if state updates haven't flushed yet
      if (finalCastWithImages && finalCastWithImages.length > 0) {
        const castRefHasAllImages =
          finalCastForSync &&
          finalCastForSync.every(
            (char) =>
              char.visualRepresentation?.imageUrl &&
              char.visualRepresentation.imageUrl.length > 0,
          );
        const finalCastHasAllImages = finalCastWithImages.every(
          (char) =>
            char.visualRepresentation?.imageUrl &&
            char.visualRepresentation.imageUrl.length > 0,
        );

        // Use finalCastWithImages if it has all images and castRef doesn't
        if (
          finalCastHasAllImages &&
          (!castRefHasAllImages || !finalCastForSync)
        ) {
          console.log(
            "[DirectorConfigForm] Using finalCastWithImages for sync (castRef may not have all images yet)",
          );
          finalCastForSync = finalCastWithImages;
          // Also update the atom to ensure consistency
          setCast(finalCastWithImages);
          castRef.current = finalCastWithImages;
        }
      }

      // Verify we have everything before syncing
      if (!finalCastForSync || finalCastForSync.length === 0) {
        console.error("[DirectorConfigForm] Cannot sync: cast is empty");
        return;
      }

      if (!finalScriptForSync) {
        console.error("[DirectorConfigForm] Cannot sync: script is missing");
        return;
      }

      // Verify all images are present - this is critical
      const charactersWithImages = finalCastForSync.filter(
        (char) =>
          char.visualRepresentation?.imageUrl &&
          char.visualRepresentation.imageUrl.length > 0,
      );

      if (charactersWithImages.length !== finalCastForSync.length) {
        const missingImages = finalCastForSync
          .filter(
            (char) =>
              !char.visualRepresentation?.imageUrl ||
              char.visualRepresentation.imageUrl.length === 0,
          )
          .map((char) => ({ name: char.name, id: char.id }));
        console.error(
          "[DirectorConfigForm] Cannot sync: Not all characters have images:",
          {
            total: finalCastForSync.length,
            withImages: charactersWithImages.length,
            missingImages,
          },
        );
        // Don't sync if images are missing - this would cause the issue
        return;
      }

      // Sync script first
      if (sessionCode && finalScriptForSync) {
        try {
          updateScript(sessionCode, finalScriptForSync);
          console.log(
            "[DirectorConfigForm] Script sent to PartyKit (final sync):",
            {
              sessionCode,
              scriptTitle: finalScriptForSync.title,
            },
          );
        } catch (error) {
          console.error("Failed to send script to PartyKit:", error);
        }
      }

      // Then sync cast with all images
      if (sessionCode && finalCastForSync) {
        try {
          updateCast(sessionCode, finalCastForSync);
          console.log(
            "[DirectorConfigForm] Cast sent to PartyKit after generation (final sync):",
            {
              sessionCode,
              castLength: finalCastForSync.length,
              charactersWithImages: charactersWithImages.length,
              allImagesPresent:
                charactersWithImages.length === finalCastForSync.length,
              imageUrls: finalCastForSync.map((char) => ({
                name: char.name,
                hasImage: Boolean(
                  char.visualRepresentation?.imageUrl &&
                  char.visualRepresentation.imageUrl.length > 0,
                ),
                imageUrl: char.visualRepresentation?.imageUrl || null,
              })),
            },
          );
        } catch (error) {
          console.error("Failed to send cast to PartyKit:", error);
          // Don't fail the form submission, but log the error
        }
      }

      // Director desk already connects to session room when sessionCode is set (early in submit).
      // No need to re-initialize here; avoid extra connection churn.

      // Brief delay to show 100% completion before hiding
      await new Promise((resolve) => setTimeout(resolve, 300));

      // CRITICAL: Only change to 'casting' state when everything is complete and synced
      // Verify that we have both script and cast with images before transitioning
      // Read from atoms/refs to ensure we have the latest state
      const currentScript = script; // Script atom is updated when script is generated
      const currentCast = castRef.current || finalCastWithImages;
      const hasCompleteScript =
        currentScript !== null && currentScript !== undefined;
      const hasCompleteCast = currentCast && currentCast.length > 0;
      const allImagesGenerated =
        currentCast &&
        currentCast.every(
          (char) =>
            char.visualRepresentation?.imageUrl &&
            char.visualRepresentation.imageUrl.length > 0,
        );

      if (!hasCompleteScript || !hasCompleteCast || !allImagesGenerated) {
        console.warn(
          "[DirectorConfigForm] Not ready to transition to casting state:",
          {
            hasCompleteScript,
            hasCompleteCast,
            allImagesGenerated,
            castLength: currentCast?.length || 0,
          },
        );
        // Don't change state yet - wait for everything to be ready
        // This prevents race conditions where join page sees 'casting' state before content is ready
        setLoading(false);
        setLoadingStep("idle");
        setGenerationAbortController(null);
        return;
      }

      console.log(
        "[DirectorConfigForm] All generation complete, transitioning to casting state:",
        {
          scriptTitle: currentScript?.title,
          castLength: currentCast.length,
          allImagesGenerated,
        },
      );

      // Update session state locally and through PartyKit
      // Only do this when we're confident everything is ready
      setSessionState("casting");
      if (code) {
        updateSessionState(code, "casting");
      }
      setLoading(false);
      setLoadingStep("idle");
      setGenerationAbortController(null);
    } catch (err) {
      // Check if error is due to abort
      if (err instanceof Error && err.name === "AbortError") {
        setError(getErrorMessage("generationCancelled"));
      } else {
        const isNetworkError =
          err instanceof TypeError ||
          (err instanceof Error &&
            /network|fetch|Failed to fetch|ECONNREFUSED|ENOTFOUND/i.test(
              err.message,
            ));

        if (isNetworkError) {
          setError(getErrorMessage("network"));
        } else {
          setError(
            err instanceof Error ? err.message : getErrorMessage("unknown"),
          );
        }
      }
      setLoading(false);
      setLoadingStep("idle");
      setGenerationAbortController(null);
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
      <h2
        className="text-2xl font-bold mb-4"
        style={{ fontFamily: visualTokens.headerFont }}
      >
        {getSectionTitle("configuration")}
      </h2>

      {error && <ErrorMessage message={error} />}

      {loading && (
        <div
          className="loading-indicator p-6 border rounded-lg mb-4"
          style={{ borderColor: "var(--color-primary)" }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: "var(--color-primary)" }}
            ></div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {loadingStep === "characters"
                    ? getSectionTitle("loadingCharactersTitle")
                    : getSectionTitle("loadingContentTitle")}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelGeneration();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelGeneration();
                  }}
                  className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: "var(--color-error, #ef4444)",
                    color: "var(--color-bg)",
                    cursor: "pointer",
                    minHeight: "44px",
                    minWidth: "44px",
                    touchAction: "manipulation",
                  }}
                >
                  {getButtonLabel("cancel")}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {loadingStep === "characters"
                  ? getPlaceholder("loadingCharactersBody")
                  : getPlaceholder("loadingGeneratingBody")}
              </p>
            </div>
          </div>
          <div
            className="w-full bg-gray-200 rounded-full h-2.5"
            style={{ backgroundColor: "var(--color-bg-secondary, #e5e7eb)" }}
          >
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                backgroundColor: "var(--color-primary)",
                width: (() => {
                  if (loadingStep === "characters") {
                    // Characters: 0-30% (30% of total)
                    return `${Math.round(generationProgress.characters.progress * 0.3)}%`;
                  } else if (loadingStep === "generating") {
                    // Progress breakdown for clarity:
                    // Characters: 0-30% (30% of total, must complete first)
                    // Script + Images (parallel): 30-100% (70% of total)
                    // Progress fills based on average of both parallel tasks for smoother UX
                    const { characters, script, images } = generationProgress;
                    const baseProgress = characters.completed ? 30 : 0;

                    // Calculate average progress of parallel tasks
                    // This ensures smooth progress even if one completes before the other
                    const scriptProgressValue = script.completed
                      ? 100
                      : script.progress;
                    const imagesProgressValue = images.completed
                      ? 100
                      : images.progress;
                    const averageParallelProgress =
                      (scriptProgressValue + imagesProgressValue) / 2;

                    // Apply the 70% range (30% to 100%)
                    const parallelProgress = Math.round(
                      averageParallelProgress * 0.7,
                    );
                    const totalProgress = baseProgress + parallelProgress;

                    return `${Math.min(totalProgress, 100)}%`;
                  }
                  return "0%";
                })(),
                animation:
                  loadingStep === "characters"
                    ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    : "none",
              }}
            ></div>
          </div>
          {loadingStep === "generating" && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Characters</span>
                <span
                  className={
                    generationProgress.characters.completed
                      ? "text-green-600 font-semibold"
                      : "text-gray-400"
                  }
                >
                  {generationProgress.characters.completed
                    ? "✓ Complete"
                    : "In progress..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Script</span>
                <span
                  className={
                    generationProgress.script.completed
                      ? "text-green-600 font-semibold"
                      : "text-gray-400"
                  }
                >
                  {generationProgress.script.completed
                    ? "✓ Complete"
                    : "In progress..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">
                  Images ({generationProgress.images.completedCount}/
                  {generationProgress.images.totalCount})
                </span>
                <span
                  className={
                    generationProgress.images.completed
                      ? "text-green-600 font-semibold"
                      : "text-gray-400"
                  }
                >
                  {generationProgress.images.completed
                    ? "✓ Complete"
                    : `In progress (${generationProgress.images.completedCount}/${generationProgress.images.totalCount})`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label
          htmlFor="theme"
          className="block mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {getSectionTitle("themeLabel")}
        </label>
        <textarea
          id="theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder={getPlaceholder("theme")}
          minLength={10}
          maxLength={200}
          required
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          rows={3}
          style={
            {
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              fontFamily: visualTokens.bodyFont,
              "--tw-ring-color": "var(--color-border-focus)",
            } as React.CSSProperties
          }
          onFocus={(e) => {
            e.target.style.borderColor = "var(--color-border-focus)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--color-border)";
          }}
        />
        <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {theme.length}/200 characters
        </div>
      </div>

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label
          htmlFor="plot"
          className="block mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {getSectionTitle("plotLabel")}
        </label>
        <textarea
          id="plot"
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          placeholder={getPlaceholder("plot")}
          maxLength={2000}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          rows={6}
          style={
            {
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              fontFamily: visualTokens.bodyFont,
              "--tw-ring-color": "var(--color-border-focus)",
            } as React.CSSProperties
          }
          onFocus={(e) => {
            e.target.style.borderColor = "var(--color-border-focus)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--color-border)";
          }}
        />
        <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {plot.length}/2000 characters
        </div>
      </div>

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label
          htmlFor="tone"
          className="block mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {getSectionTitle("toneLabel")}
        </label>
        <select
          id="tone"
          value={tone}
          onChange={(e) => setTone(e.target.value as TonePreference)}
          required
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          style={
            {
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              fontFamily: visualTokens.bodyFont,
              "--tw-ring-color": "var(--color-border-focus)",
            } as React.CSSProperties
          }
          onFocus={(e) => {
            e.target.style.borderColor = "var(--color-border-focus)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--color-border)";
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

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label htmlFor="participantCount" className="block mb-2">
          {getSectionTitle("participantsLabel")}: {participantCount}
        </label>
        <input
          type="range"
          id="participantCount"
          min={2}
          max={5}
          value={participantCount}
          onChange={(e) => setParticipantCount(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label
          htmlFor="chaosLevel"
          className="block mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {getSectionTitle("chaosLevelLabel")}:{" "}
          <span style={{ color: "var(--color-accent)", fontWeight: "600" }}>
            {chaosValue}
          </span>
        </label>
        <input
          type="range"
          id="chaosLevel"
          min={1}
          max={10}
          value={chaosValue}
          onChange={(e) => setChaosLevel(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label
          htmlFor="jokes"
          className="block mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {getSectionTitle("jokesLabel")}
        </label>
        <textarea
          id="jokes"
          value={jokes}
          onChange={(e) => setJokes(e.target.value)}
          placeholder={getPlaceholder("jokes")}
          maxLength={1000}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2"
          rows={4}
          style={
            {
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              fontFamily: visualTokens.bodyFont,
              "--tw-ring-color": "var(--color-border-focus)",
            } as React.CSSProperties
          }
          onFocus={(e) => {
            e.target.style.borderColor = "var(--color-border-focus)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--color-border)";
          }}
        />
        <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {jokes.split("\n").filter((j) => j.trim().length > 0).length}{" "}
          {getPlaceholder("jokesCountLabel")}
        </div>
      </div>

      <div
        className="form-group"
        style={{ marginBottom: visualTokens.spacing.component }}
      >
        <label className="block mb-2" style={{ color: "var(--color-text)" }}>
          {getSectionTitle("predefinedCharactersLabel")}
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
                placeholder={getPlaceholder("predefinedCharacterName")}
                maxLength={50}
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2"
                style={
                  {
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text)",
                    borderColor: "var(--color-border)",
                    fontFamily: visualTokens.bodyFont,
                    "--tw-ring-color": "var(--color-border-focus)",
                  } as React.CSSProperties
                }
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-border-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                }}
              />
              <input
                type="text"
                value={char.role || ""}
                onChange={(e) => {
                  const updated = [...directorDefinedCharacters];
                  updated[index] = {
                    ...updated[index],
                    role: e.target.value || undefined,
                  };
                  setDirectorDefinedCharacters(updated);
                }}
                placeholder={getPlaceholder("predefinedCharacterRole")}
                maxLength={50}
                className="flex-1 p-2 border rounded focus:outline-none focus:ring-2"
                style={
                  {
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-text)",
                    borderColor: "var(--color-border)",
                    fontFamily: visualTokens.bodyFont,
                    "--tw-ring-color": "var(--color-border-focus)",
                  } as React.CSSProperties
                }
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-border-focus)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDirectorDefinedCharacters(
                    directorDefinedCharacters.filter((_, i) => i !== index),
                  );
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDirectorDefinedCharacters(
                    directorDefinedCharacters.filter((_, i) => i !== index),
                  );
                }}
                className="px-3 py-1 rounded"
                style={{
                  backgroundColor: errorColor,
                  color: visualTokens.bgColor,
                  minHeight: "44px",
                  minWidth: "44px",
                  touchAction: "manipulation",
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectorDefinedCharacters([
                ...directorDefinedCharacters,
                { name: "" },
              ]);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectorDefinedCharacters([
                ...directorDefinedCharacters,
                { name: "" },
              ]);
            }}
            className="text-sm px-3 py-1 border rounded hover:bg-opacity-10 transition-colors"
            style={{
              borderColor: "var(--color-accent)",
              color: "var(--color-accent)",
              cursor: "pointer",
              minHeight: "44px",
              minWidth: "44px",
              touchAction: "manipulation",
            }}
          >
            + Add Character
          </button>
        </div>
        <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
          {getPlaceholder("predefinedCharactersDescription")}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 rounded font-semibold disabled:opacity-50"
        style={{
          backgroundColor: "var(--color-primary)",
          color: "var(--color-bg)",
          fontFamily: visualTokens.headerFont,
          cursor: loading ? "not-allowed" : "pointer",
          minHeight: "44px",
          minWidth: "44px",
        }}
      >
        {loading ? getButtonLabel("submitLoading") : getButtonLabel("submit")}
      </button>
    </form>
  );
}
