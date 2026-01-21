/**
 * Script Preview Modal Component
 * 
 * Displays the generated script in a modal dialog for Director preview.
 * Can be expanded in the future to support editing.
 */

'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { flattenScriptLines } from '@/src/components/teleprompter/script-lines';
import type { Script } from '@/src/state/types/session';

interface ScriptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ScriptPreviewModal Component
 * 
 * Modal dialog for previewing the script before performance starts.
 */
export function ScriptPreviewModal({ isOpen, onClose }: ScriptPreviewModalProps) {
  const script = useAtomValue(currentScriptAtom);
  const { visualTokens, getSectionTitle } = useVibe();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Flatten script into linear lines for display
  const scriptLines = useMemo(() => {
    if (!script) return [];
    return flattenScriptLines(script);
  }, [script]);

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Handle ESC key and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Close if clicking the backdrop (not the content)
    if (e.target === dialog) {
      onClose();
    }
  };

  if (!script) {
    return null;
  }

  // Group lines by scene for better readability
  const scenesWithLines = useMemo(() => {
    const grouped: Array<{ sceneIndex: number; title: string; lines: typeof scriptLines }> = [];
    let currentScene: typeof grouped[0] | null = null;

    scriptLines.forEach((line) => {
      if (!currentScene || currentScene.sceneIndex !== line.sceneIndex) {
        currentScene = {
          sceneIndex: line.sceneIndex,
          title: line.sceneTitle,
          lines: [],
        };
        grouped.push(currentScene);
      }
      currentScene.lines.push(line);
    });

    return grouped;
  }, [scriptLines]);

  // Add backdrop styling and scrollbar styling (only once)
  useEffect(() => {
    const existingStyle = document.getElementById('dialog-backdrop-style');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'dialog-backdrop-style';
    style.textContent = `
      dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      }
      /* Custom scrollbar for script preview */
      dialog .script-preview-scroll::-webkit-scrollbar {
        width: 8px;
      }
      dialog .script-preview-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      dialog .script-preview-scroll::-webkit-scrollbar-thumb {
        background-color: rgba(var(--color-primary-rgb, 255, 255, 255), 0.3);
        border-radius: 4px;
      }
      dialog .script-preview-scroll::-webkit-scrollbar-thumb:hover {
        background-color: rgba(var(--color-primary-rgb, 255, 255, 255), 0.5);
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-full max-w-4xl max-h-[90vh] rounded-lg p-0 m-auto"
      style={{
        backgroundColor: visualTokens.bgColor,
        color: visualTokens.textColor,
        borderColor: visualTokens.primaryColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
      }}
    >
      <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: visualTokens.primaryColor }}
        >
          <div>
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: visualTokens.primaryColor }}
            >
              {script.title}
            </h2>
            <p className="text-sm" style={{ color: visualTokens.textColor, opacity: 0.8 }}>
              {script.length} • {script.scenes.length} scene{script.scenes.length !== 1 ? 's' : ''}
            </p>
            {script.description && (
              <p className="text-sm mt-2" style={{ color: visualTokens.textColor, opacity: 0.9, lineHeight: '1.6' }}>
                {script.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: visualTokens.primaryColor,
              color: visualTokens.bgColor,
            }}
            aria-label="Close preview"
          >
            Close
          </button>
        </div>

        {/* Script Content - Scrollable */}
        <div 
          className="flex-1 overflow-y-auto p-6 script-preview-scroll"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: `${visualTokens.primaryColor}40 transparent`,
          }}
        >
          <div className="space-y-8">
            {scenesWithLines.map((sceneGroup) => (
              <div key={sceneGroup.sceneIndex} className="space-y-4">
                {/* Scene Header */}
                <div
                  className="pb-2 border-b"
                  style={{ borderColor: visualTokens.primaryColor }}
                >
                  <h3
                    className="text-xl font-semibold"
                    style={{ color: visualTokens.primaryColor }}
                  >
                    Scene {sceneGroup.sceneIndex + 1}: {sceneGroup.title}
                  </h3>
                  {script.scenes[sceneGroup.sceneIndex]?.description && (
                    <p
                      className="text-sm mt-1"
                      style={{ color: visualTokens.textColor, opacity: 0.8, lineHeight: '1.5' }}
                    >
                      {script.scenes[sceneGroup.sceneIndex].description}
                    </p>
                  )}
                </div>

                {/* Scene Lines */}
                <div className="space-y-3 pl-4">
                  {sceneGroup.lines.map((line) => (
                    <div
                      key={line.index}
                      className="py-2"
                    >
                      {line.type === 'dialogue' && (
                        <div>
                          <div
                            className="font-semibold mb-1"
                            style={{ 
                              color: visualTokens.accentColor || visualTokens.primaryColor,
                              opacity: 1,
                            }}
                          >
                            {line.characterName}
                          </div>
                          <div style={{ 
                            color: visualTokens.textColor,
                            lineHeight: '1.6',
                            opacity: 1,
                          }}>
                            {line.content}
                          </div>
                        </div>
                      )}
                      {line.type === 'stageDirection' && (
                        <div
                          className="italic text-sm"
                          style={{ 
                            color: visualTokens.accentColor || visualTokens.textColor,
                            opacity: 0.85,
                            lineHeight: '1.5',
                          }}
                        >
                          [Stage Direction] {line.content}
                        </div>
                      )}
                      {line.type === 'soundCue' && (
                        <div
                          className="text-sm font-mono"
                          style={{ 
                            color: visualTokens.accentColor || visualTokens.primaryColor,
                            opacity: 0.9,
                          }}
                        >
                          🔊 {line.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t text-sm text-center"
          style={{ 
            borderColor: visualTokens.primaryColor, 
            color: visualTokens.textColor,
            opacity: 0.7,
          }}
        >
          Script preview • Editing coming soon
        </div>
      </div>
    </dialog>
  );
}
