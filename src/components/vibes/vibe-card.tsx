'use client';

/**
 * VibeCard Component
 * 
 * Displays a single vibe option as a selectable card.
 * Supports keyboard navigation and accessibility.
 */

import { useMemo, forwardRef } from 'react';
import Image from 'next/image';
import type { VibeType } from '@/src/state/types/vibe';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';

interface VibeCardProps {
  vibe: VibeType;
  onSelect: (vibe: VibeType) => void;
  isSelected?: boolean;
  previewImage?: string;
}

const VIBE_DISPLAY_NAMES: Record<VibeType, string> = {
  VIRAL_NEON: 'Viral Neon',
  INDIE_A24: 'Indie A24',
  SITCOM_STUDIO: 'Sitcom Studio',
  BRAINROT_THEATER: 'Brainrot Theater',
  QUIET_STUDIO: 'Quiet Studio',
};

export const VibeCard = forwardRef<HTMLButtonElement, VibeCardProps>(function VibeCard(
  {
    vibe,
    onSelect,
    isSelected = false,
    previewImage,
  },
  ref
) {
  const config = VIBE_CONFIGS[vibe];
  const displayName = VIBE_DISPLAY_NAMES[vibe];

  const handleClick = () => {
    onSelect(vibe);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(vibe);
    }
  };

  const ariaLabel = useMemo(
    () => `Select ${displayName} vibe`,
    [displayName]
  );

  const cardStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      padding: config.visualTokens.cardStyle.padding,
      gap: config.visualTokens.cardStyle.gap,
      border: config.visualTokens.cardStyle.borderStyle,
      boxShadow: config.visualTokens.cardStyle.shadowStyle,
      borderRadius: config.visualTokens.borderRadius,
      backgroundColor: config.visualTokens.bgColor,
      color: config.visualTokens.primaryColor,
      cursor: 'pointer',
      transition: 'all 0.5s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '200px',
      minHeight: '250px',
      position: 'relative',
      overflow: 'hidden',
      outline: 'none',
    };

    // Add selected state styling
    if (isSelected) {
      baseStyle.border = `3px solid ${config.visualTokens.primaryColor}`;
      baseStyle.boxShadow = `0 0 30px ${config.visualTokens.primaryColor}40`;
      baseStyle.transform = 'scale(1.05)';
    }

    // Add hover effects based on vibe
    const hoverStyle = config.interactionPatterns.hoverEffects;
    if (hoverStyle === 'glow') {
      baseStyle.transition = 'all 0.3s ease, box-shadow 0.3s ease';
    }

    return baseStyle;
  }, [config, isSelected]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      data-vibe={vibe}
      className="vibe-card"
      style={cardStyle}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = `0 0 20px ${config.visualTokens.primaryColor}60`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = config.visualTokens.cardStyle.shadowStyle;
        }
      }}
    >
      {previewImage && (
        <div
          style={{
            width: '150px',
            height: '150px',
            borderRadius: config.visualTokens.borderRadius,
            marginBottom: config.visualTokens.spacing.element,
            backgroundColor: config.visualTokens.bgColor,
            border: `2px solid ${config.visualTokens.primaryColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            src={previewImage}
            alt={`${displayName} vibe preview`}
            width={150}
            height={150}
            className="vibe-card-preview"
            style={{
              borderRadius: config.visualTokens.borderRadius,
              objectFit: 'cover',
            }}
            loading="lazy"
            onError={(e) => {
              // Hide image on error, show placeholder instead
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      <h3
        style={{
          fontFamily: config.visualTokens.headerFont,
          fontSize: '1.5rem',
          fontWeight: 'bold',
          margin: 0,
          textAlign: 'center',
        }}
      >
        {displayName}
      </h3>
    </button>
  );
});
