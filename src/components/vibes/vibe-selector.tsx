'use client';

/**
 * VibeSelector Component
 * 
 * Displays all five vibe options as selectable cards.
 * Handles vibe selection and updates vibeAtom.
 * Supports keyboard navigation and accessibility.
 * 
 * Performance requirement: Vibe selection must complete in <100ms
 * (including visual transformation, per constitution Principle 5)
 */

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { clearSessionState } from '@/src/lib/utils/session-state-cleanup';
import { VibeCard } from './vibe-card';
import type { VibeType } from '@/src/state/types/vibe';

const ALL_VIBES: VibeType[] = [
  'VIRAL_NEON',
  'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO',
];

export function VibeSelector() {
  const router = useRouter();
  const [currentVibe, setCurrentVibe] = useAtom(vibeAtom);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleVibeSelect = (vibe: VibeType) => {
    proceedWithVibeChange(vibe);
  };

  const proceedWithVibeChange = (vibe: VibeType) => {
    clearSessionState();

    const startTime = performance.now();
    setCurrentVibe(vibe);
    
    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      const endTime = performance.now();
      const duration = endTime - startTime;
      if (duration > 100) {
        console.warn(`Vibe selection took ${duration.toFixed(2)}ms (target: <100ms)`);
      }
    }

    // Navigate to Director's Desk after vibe selection
    // Small delay to allow visual transformation to start
    setTimeout(() => {
      router.push('/director-desk');
    }, 100);
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let newIndex = index;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        newIndex = (index + 1) % ALL_VIBES.length;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        newIndex = (index - 1 + ALL_VIBES.length) % ALL_VIBES.length;
        break;
      case 'Home':
        event.preventDefault();
        event.stopPropagation();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        event.stopPropagation();
        newIndex = ALL_VIBES.length - 1;
        break;
      default:
        return;
    }

    // Use setTimeout to ensure focus happens after state update
    setTimeout(() => {
      cardRefs.current[newIndex]?.focus();
    }, 0);
  };

  return (
    <div
        role="group"
        aria-label="Select a production vibe"
        aria-roledescription="Vibe selection grid"
        data-vibe-selector
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem',
          padding: '2rem',
          maxWidth: '1200px',
          margin: '0 auto',
          // Add cross-dissolve transition container
          opacity: 1,
          transition: 'opacity 0.5s ease',
        }}
      >
        {ALL_VIBES.map((vibe, index) => (
          <div
            key={vibe}
            role="none"
            tabIndex={-1}
            onKeyDown={(e) => {
              // Handle arrow keys at container level for better navigation
              if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
                handleKeyDown(e, index);
              }
            }}
            style={{
              // Cross-dissolve animation wrapper
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <VibeCard
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              vibe={vibe}
              onSelect={handleVibeSelect}
              isSelected={vibe === currentVibe}
              previewImage={`/vibes/${vibe.toLowerCase()}-preview.png`}
            />
          </div>
        ))}
      </div>
  );
}
