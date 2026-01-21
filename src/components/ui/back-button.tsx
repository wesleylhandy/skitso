'use client';

/**
 * BackButton Component
 * 
 * A reusable back button that:
 * - Matches the current vibe theme styling
 * - Uses vibe-appropriate button labels
 * - Provides clear navigation with good UX
 * - Supports keyboard navigation and accessibility
 */

import { useRouter } from 'next/navigation';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface BackButtonProps {
  /** The route to navigate to when clicked */
  to: string;
  /** Optional custom label (overrides vibe default) */
  label?: string;
  /** Optional className for additional styling */
  className?: string;
}

export function BackButton({ to, label, className }: BackButtonProps) {
  const router = useRouter();
  const { getButtonLabel, visualTokens, interactionPatterns } = useVibe();
  
  const buttonLabel = label || getButtonLabel('back');
  
  const handleClick = () => {
    router.push(to);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    border: `2px solid ${visualTokens.primaryColor}`,
    borderRadius: visualTokens.borderRadius,
    backgroundColor: 'transparent',
    color: visualTokens.primaryColor,
    fontFamily: visualTokens.bodyFont,
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: `all ${interactionPatterns.animationSpeed}ms ease`,
    outline: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    minHeight: '44px', // WCAG touch target requirement
    minWidth: '44px',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Go back: ${buttonLabel}`}
      className={className}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (interactionPatterns.hoverEffects !== 'none') {
          e.currentTarget.style.boxShadow = `0 0 15px ${visualTokens.primaryColor}60`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${visualTokens.primaryColor}`;
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      <span aria-hidden="true">←</span>
      {buttonLabel}
    </button>
  );
}
