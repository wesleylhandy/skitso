'use client';

import type { ReactNode } from 'react';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface VibePanelProps {
  children: ReactNode;
  className?: string;
}

export function VibePanel({ children, className = '' }: VibePanelProps) {
  const { visualTokens } = useVibe();

  return (
    <section
      className={className}
      style={{
        backgroundColor: visualTokens.bgColor,
        color: visualTokens.textColor,
        borderRadius: visualTokens.borderRadius,
        padding: visualTokens.cardStyle?.padding ?? '1.5rem',
        border: visualTokens.cardStyle?.borderStyle ?? `1px solid ${visualTokens.primaryColor}`,
        boxShadow: visualTokens.cardStyle?.shadowStyle,
      }}
    >
      {children}
    </section>
  );
}

