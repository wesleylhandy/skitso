/**
 * Session Share Component
 * 
 * Displays session code and shareable link with copy functionality.
 */

'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { generateShareableLink } from '@/src/lib/utils/session-code';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface SessionShareProps {
  /**
   * Disable share button during generation to prevent connection interruption
   */
  disabled?: boolean;
}

export function SessionShare({ disabled = false }: SessionShareProps) {
  const sessionCode = useAtomValue(sessionCodeAtom);
  const { getButtonLabel } = useVibe();
  const [copied, setCopied] = useState(false);

  if (!sessionCode) {
    return null;
  }

  const shareableLink = generateShareableLink(sessionCode);

  // Check if Web Share API is available (mobile devices)
  const canUseNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleNativeShare = async () => {
    if (!canUseNativeShare || disabled) return;

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
    if (disabled) return;
    
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
      className="session-share p-3 sm:p-4 border rounded"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
    >
      <h3 className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        Session Code
      </h3>
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <code
          className="text-xl sm:text-2xl font-mono font-bold break-all"
          style={{ color: 'var(--color-accent)' }}
        >
          {sessionCode}
        </code>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="text"
          readOnly
          value={shareableLink}
          className="w-full min-w-0 flex-1 p-2 sm:p-2.5 text-sm sm:text-base border rounded bg-[var(--color-bg)] text-[var(--color-text)]"
          style={{ borderColor: 'var(--color-border)' }}
        />
        {canUseNativeShare ? (
          <button
            onClick={handleNativeShare}
            disabled={disabled}
            className="w-full sm:w-auto shrink-0 min-h-[44px] min-w-[44px] px-4 py-2.5 sm:py-2 rounded font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            title={disabled ? 'Please wait for generation to complete before sharing' : undefined}
          >
            {getButtonLabel('share')}
          </button>
        ) : (
          <button
            onClick={handleCopy}
            disabled={disabled}
            className="w-full sm:w-auto shrink-0 min-h-[44px] min-w-[44px] px-4 py-2.5 sm:py-2 rounded font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            title={disabled ? 'Please wait for generation to complete before sharing' : undefined}
          >
            {copied ? 'Copied!' : getButtonLabel('share')}
          </button>
        )}
      </div>
    </div>
  );
}
