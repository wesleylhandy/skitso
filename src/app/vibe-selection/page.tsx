'use client';

/**
 * Vibe Selection Page
 * 
 * Page where Director selects a production style (VibeContext).
 * Displays all five vibe options and allows selection.
 */

import { VibeSelector } from '@/src/components/vibes/vibe-selector';
import { BackButton } from '@/src/components/ui/back-button';
import { useVibe } from '@/src/lib/hooks/use-vibe';

export default function VibeSelectionPage() {
  const { getSectionTitle } = useVibe();
  const pageTitle = getSectionTitle('vibeSelection') || 'Select Your Vibe';

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/" />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-header)',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '3rem',
          }}
        >
          {pageTitle}
        </h1>
        <VibeSelector />
      </div>
    </main>
  );
}
