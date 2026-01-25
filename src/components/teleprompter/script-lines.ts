/**
 * Script Lines Utility
 * 
 * Utilities for flattening script scenes into linear line arrays
 * and managing line types (dialogue, stage direction, sound cue).
 */

import type { Script } from '@/src/state/types/session';

export type LineType = 'dialogue' | 'stageDirection' | 'soundCue';

export interface ScriptLine {
  index: number;
  type: LineType;
  characterName?: string;
  content: string;
  sceneIndex: number;
  sceneTitle: string;
  soundName?: string;
  startOffset?: number;
}

/**
 * Flatten script scenes into a linear array of lines
 */
export function flattenScriptLines(script: Script): ScriptLine[] {
  const lines: ScriptLine[] = [];
  let globalIndex = 0;

  script.scenes.forEach((scene, sceneIndex) => {
    // Create a map of line indices to stage directions and sound cues
    const stageDirectionMap = new Map<number, string>();
    const soundCueMap = new Map<number, { soundName: string; startOffset: number }>();

    scene.stageDirections.forEach((sd) => {
      stageDirectionMap.set(sd.lineIndex, sd.text);
    });

    scene.soundCues.forEach((sc) => {
      soundCueMap.set(sc.lineIndex, {
        soundName: sc.soundName,
        startOffset: sc.startOffset,
      });
    });

    // Process dialogue lines
    scene.dialogue.forEach((dialogue, dialogueIndex) => {
      const lineIndex = dialogueIndex;

      // Add stage direction before this line if it exists
      if (stageDirectionMap.has(lineIndex)) {
        lines.push({
          index: globalIndex++,
          type: 'stageDirection',
          content: stageDirectionMap.get(lineIndex)!,
          sceneIndex,
          sceneTitle: scene.title,
        });
      }

      // Add sound cue if it exists at this line
      if (soundCueMap.has(lineIndex)) {
        const sound = soundCueMap.get(lineIndex)!;
        lines.push({
          index: globalIndex++,
          type: 'soundCue',
          content: `[${sound.soundName}]`,
          sceneIndex,
          sceneTitle: scene.title,
          soundName: sound.soundName,
          startOffset: sound.startOffset,
        });
      }

      // Add dialogue line
      lines.push({
        index: globalIndex++,
        type: 'dialogue',
        characterName: dialogue.characterName,
        content: dialogue.content,
        sceneIndex,
        sceneTitle: scene.title,
      });
    });

    // Add any remaining stage directions or sound cues after the last dialogue
    const maxLineIndex = scene.dialogue.length;
    stageDirectionMap.forEach((text, lineIndex) => {
      if (lineIndex >= maxLineIndex) {
        lines.push({
          index: globalIndex++,
          type: 'stageDirection',
          content: text,
          sceneIndex,
          sceneTitle: scene.title,
        });
      }
    });

    soundCueMap.forEach((sound, lineIndex) => {
      if (lineIndex >= maxLineIndex) {
        lines.push({
          index: globalIndex++,
          type: 'soundCue',
          content: `[${sound.soundName}]`,
          sceneIndex,
          sceneTitle: scene.title,
          soundName: sound.soundName,
          startOffset: sound.startOffset,
        });
      }
    });
  });

  return lines;
}

/**
 * Get lines for a specific character
 */
export function getCharacterLines(lines: ScriptLine[], characterName: string): ScriptLine[] {
  return lines.filter((line) => line.type === 'dialogue' && line.characterName === characterName);
}

/**
 * Get upcoming lines (next N lines)
 */
export function getUpcomingLines(lines: ScriptLine[], currentIndex: number, count: number = 3): ScriptLine[] {
  return lines.slice(currentIndex + 1, currentIndex + 1 + count);
}
