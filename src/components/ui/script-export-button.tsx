/**
 * Script Export Button
 *
 * Downloads the current script as a .txt file. Usable anywhere script is
 * available (wrap party, script preview, casting couch, etc.).
 */

'use client';

import { useAtomValue } from 'jotai';
import { useVibe } from '@/src/lib/hooks/use-vibe';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import { downloadScriptAsFile } from '@/src/lib/utils/script-export';

interface ScriptExportButtonProps {
  className?: string;
  /** Override label; default uses getButtonLabel('exportScript') */
  label?: string;
  variant?: 'primary' | 'secondary';
}

export function ScriptExportButton({ className = '', label, variant = 'secondary' }: ScriptExportButtonProps) {
  const script = useAtomValue(currentScriptAtom);
  const { visualTokens, getButtonLabel } = useVibe();
  const disabled = !script;

  const handleClick = () => {
    if (!script) return;
    downloadScriptAsFile(script);
  };

  const isPrimary = variant === 'primary';
  const style = isPrimary
    ? { backgroundColor: visualTokens.primaryColor, color: visualTokens.bgColor, border: 'none' }
    : {
        backgroundColor: 'transparent',
        color: visualTokens.primaryColor,
        border: `2px solid ${visualTokens.primaryColor}`,
      };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{
        ...style,
        fontFamily: visualTokens.bodyFont,
        padding: '0.5rem 1rem',
        borderRadius: visualTokens.borderRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        minWidth: '44px',
        minHeight: '44px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
      aria-label={label ?? getButtonLabel('exportScript')}
      title={label ?? getButtonLabel('exportScript')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="w-5 h-5 shrink-0"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      <span>{label ?? getButtonLabel('exportScript')}</span>
    </button>
  );
}
