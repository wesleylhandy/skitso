/**
 * Script Export Utility
 *
 * Converts a Script to plain text for download (e.g. .txt).
 * Used by ScriptExportButton wherever script is available.
 */

import type { Script } from '@/src/state/types/session';
import { flattenScriptLines } from '@/src/components/teleprompter/script-lines';

/**
 * Convert script to plain-text format for export.
 * Mirrors ScriptPreviewModal structure: title, meta, scenes with dialogue/stage directions/sound cues.
 */
export function scriptToExportText(script: Script): string {
  const lines = flattenScriptLines(script);
  const sections: string[] = [];

  sections.push(script.title);
  sections.push(`${script.length} • ${script.scenes.length} scene${script.scenes.length !== 1 ? 's' : ''}`);
  if (script.description) {
    sections.push('');
    sections.push(script.description);
  }
  sections.push('');
  sections.push('---');
  sections.push('');

  let currentSceneIndex = -1;
  for (const line of lines) {
    if (line.sceneIndex !== currentSceneIndex) {
      currentSceneIndex = line.sceneIndex;
      sections.push(`Scene ${line.sceneIndex + 1}: ${line.sceneTitle}`);
      sections.push('');
    }
    if (line.type === 'dialogue') {
      sections.push(`${line.characterName ?? 'Unknown'}:`);
      sections.push(`  ${line.content}`);
      sections.push('');
    } else if (line.type === 'stageDirection') {
      sections.push(`[Stage Direction] ${line.content}`);
      sections.push('');
    } else if (line.type === 'soundCue') {
      sections.push(`[Sound: ${line.content}]`);
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Sanitize a string for use in a filename (alphanumeric, spaces, hyphens).
 */
function sanitizeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 80) || 'script';
}

/**
 * Trigger download of script as a .txt file.
 */
export function downloadScriptAsFile(script: Script): void {
  const text = scriptToExportText(script);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(script.title)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
