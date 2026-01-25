/**
 * Generation Sticky Header Component
 * 
 * Sticky header that appears during generation to show progress and share link.
 * Always visible at the top of the viewport during generation or when session exists.
 */

'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { generateShareableLink } from '@/src/lib/utils/session-code';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface GenerationProgress {
  phase: string;
  message: string;
}

interface GenerationStickyHeaderProps {
  generationProgress: GenerationProgress | null;
  isGenerating?: boolean;
}

export function GenerationStickyHeader({
  generationProgress,
  isGenerating = false,
}: GenerationStickyHeaderProps) {
  const sessionCode = useAtomValue(sessionCodeAtom);
  const { getButtonLabel, visualTokens } = useVibe();
  const [copied, setCopied] = useState(false);

  // Only show if we have a session code or are generating
  if (!sessionCode && !isGenerating) {
    return null;
  }

  const shareableLink = sessionCode ? generateShareableLink(sessionCode) : '';

  // Check if Web Share API is available (mobile devices)
  const canUseNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleNativeShare = async () => {
    if (!canUseNativeShare || !shareableLink) return;

    try {
      await navigator.share({
        title: 'Join my Skitso session',
        text: `Join my Skitso performance session: ${sessionCode}`,
        url: shareableLink,
      });
    } catch (error) {
      // User cancelled or share failed - ignore silently
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
        // Fall back to copy on error
        await handleCopy();
      }
    }
  };

  const handleCopy = async () => {
    if (!shareableLink) return;
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div
      className="sticky top-0 z-50 w-full border-b shadow-lg"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          {/* Progress Section */}
          {(isGenerating || generationProgress) && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                {isGenerating && (
                  <div
                    className="animate-spin rounded-full h-5 w-5 border-b-2 shrink-0"
                    style={{ borderColor: 'var(--color-primary)' }}
                    aria-hidden="true"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--color-text)' }}
                    role="status"
                    aria-live="polite"
                  >
                    {generationProgress?.message || 'Generating your skit...'}
                  </p>
                  {isGenerating && (
                    <div
                      className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5"
                      style={{ backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.1))' }}
                    >
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          width: '100%',
                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Session Share Section */}
          {sessionCode && (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Code:
                </span>
                <code
                  className="text-sm font-mono font-bold px-2 py-1 rounded"
                  style={{
                    color: 'var(--color-accent)',
                    backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.1))',
                  }}
                >
                  {sessionCode}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableLink}
                  className="hidden sm:block text-xs px-2 py-1.5 border rounded max-w-[200px] sm:max-w-[250px]"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-border)',
                    fontFamily: 'monospace',
                  }}
                  aria-label="Shareable link"
                />
                {canUseNativeShare ? (
                  <button
                    onClick={handleNativeShare}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded font-medium transition-opacity hover:opacity-90 text-sm"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-bg)',
                      cursor: 'pointer',
                      minHeight: '44px',
                      minWidth: '44px',
                    }}
                    aria-label="Share session"
                  >
                    {getButtonLabel('share')}
                  </button>
                ) : (
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded font-medium transition-opacity hover:opacity-90 text-sm"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-bg)',
                      cursor: 'pointer',
                      minHeight: '44px',
                      minWidth: '44px',
                    }}
                    aria-label="Copy shareable link"
                  >
                    {copied ? 'Copied!' : getButtonLabel('share')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Show session code below on small screens */}
        {sessionCode && (
          <div className="sm:hidden mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-muted)' }}
              >
                Code:
              </span>
              <code
                className="text-sm font-mono font-bold"
                style={{ color: 'var(--color-accent)' }}
              >
                {sessionCode}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
