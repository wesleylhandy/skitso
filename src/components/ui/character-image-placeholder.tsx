/**
 * Character Image Placeholder Component
 * 
 * Theme-aware placeholder for when character images are not available.
 * Shows a subtle, vibe-appropriate placeholder instead of an empty space.
 */

'use client';

import { useVibe } from '@/src/lib/hooks/use-vibe';

interface CharacterImagePlaceholderProps {
  characterName?: string;
  className?: string;
}

/**
 * Character Image Placeholder
 * 
 * Displays a theme-matching placeholder when character images are not available.
 * Uses theme colors and styling to maintain visual consistency.
 */
export function CharacterImagePlaceholder({ 
  characterName, 
  className = '' 
}: CharacterImagePlaceholderProps) {
  const { visualTokens } = useVibe();
  
  // Determine if background is dark or light
  const isDarkBg = visualTokens.bgColor === '#0A0A0A' || 
                   visualTokens.bgColor === '#000000' || 
                   visualTokens.bgColor === '#141414';
  
  // Create a subtle gradient using theme colors
  const gradientColor1 = isDarkBg 
    ? `${visualTokens.primaryColor}15` // 15 = ~8% opacity
    : `${visualTokens.primaryColor}20`; // 20 = ~12% opacity
  const gradientColor2 = isDarkBg
    ? `${visualTokens.accentColor}10` // 10 = ~6% opacity
    : `${visualTokens.accentColor}15`; // 15 = ~8% opacity

  return (
    <div 
      className={`w-full h-full flex flex-col items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(135deg, ${gradientColor1} 0%, ${gradientColor2} 100%)`,
        border: `2px dashed ${isDarkBg ? `${visualTokens.primaryColor}40` : `${visualTokens.primaryColor}60`}`,
      }}
    >
      {/* Icon - simple silhouette */}
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          color: isDarkBg ? `${visualTokens.primaryColor}60` : `${visualTokens.primaryColor}80`,
          marginBottom: '0.5rem',
        }}
      >
        <path
          d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      
      {/* Text */}
      <p 
        className="text-xs text-center px-4"
        style={{
          color: isDarkBg ? `${visualTokens.primaryColor}80` : `${visualTokens.primaryColor}90`,
          fontFamily: visualTokens.bodyFont,
        }}
      >
        {characterName ? `${characterName}` : 'Character'}
        <br />
        <span style={{ opacity: 0.7 }}>No image</span>
      </p>
    </div>
  );
}
