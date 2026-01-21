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

export function SessionShare() {
  const sessionCode = useAtomValue(sessionCodeAtom);
  const { getButtonLabel } = useVibe();
  const [copied, setCopied] = useState(false);

  if (!sessionCode) {
    return null;
  }

  const shareableLink = generateShareableLink(sessionCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="session-share p-4 border rounded" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Session Code</h3>
      <div className="flex items-center gap-2 mb-4">
        <code className="text-2xl font-mono font-bold" style={{ color: 'var(--color-accent)' }}>{sessionCode}</code>
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={shareableLink}
          className="flex-1 p-2 border rounded bg-[var(--color-bg)] text-[var(--color-text)]"
          style={{ borderColor: 'var(--color-border)' }}
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded font-medium transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-bg)',
          }}
        >
          {copied ? 'Copied!' : getButtonLabel('share')}
        </button>
      </div>
    </div>
  );
}
