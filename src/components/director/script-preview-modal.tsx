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
import { ScriptExportButton } from '@/src/components/ui/script-export-button';
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

  // Handle dialog open/close and body scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      // Lock body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Prevent scroll propagation to background
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    const scrollableContent = dialog.querySelector('.script-preview-scroll') as HTMLElement;
    if (!scrollableContent) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollableContent;
      const isAtTop = scrollTop === 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      // Prevent scroll propagation if not at boundaries
      if (!isAtTop && !isAtBottom) {
        e.stopPropagation();
      } else if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        // At boundary and trying to scroll further - prevent background scroll
        e.preventDefault();
        e.stopPropagation();
      }
    };

    scrollableContent.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollableContent.removeEventListener('wheel', handleWheel);
    };
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

  // Group lines by scene for better readability
  const scenesWithLines = useMemo(() => {
    if (!script) return [];
    
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
  }, [scriptLines, script]);

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

  if (!script) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-[calc(100%-2rem)] sm:w-full max-w-4xl max-h-[90vh] rounded-lg p-0 m-auto overflow-hidden"
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
      }}
    >
      <div className="flex flex-col h-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 border-b"
          style={{ borderColor: visualTokens.primaryColor }}
        >
          <div className="flex-1 min-w-0">
            <h2
              className="text-xl sm:text-2xl font-bold mb-1"
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
            className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 cursor-pointer flex-shrink-0 w-full sm:w-auto"
            style={{
              backgroundColor: visualTokens.primaryColor,
              color: visualTokens.bgColor,
              minHeight: '44px',
              minWidth: '44px',
            }}
            aria-label="Close preview"
          >
            Close
          </button>
        </div>

        {/* Script Content - Scrollable */}
        <div 
          className="flex-1 overflow-y-auto p-6 script-preview-scroll overscroll-contain"
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
          className="p-4 border-t flex items-center justify-between flex-wrap gap-2"
          style={{ 
            borderColor: visualTokens.primaryColor, 
            color: visualTokens.textColor,
            opacity: 0.9,
          }}
        >
          <span className="text-sm">Script preview</span>
          <ScriptExportButton variant="secondary" />
        </div>
      </div>
    </dialog>
  );
}
