'use client';

import type { ReactNode } from 'react';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface VibeHeadingProps {
  level?: 1 | 2 | 3 | 4;
  sectionKey?: string;
  children?: ReactNode;
  className?: string;
}

export function VibeHeading({
  level = 1,
  sectionKey,
  children,
  className = '',
}: VibeHeadingProps) {
  const { visualTokens, getSectionTitle } = useVibe();

  const text =
    typeof children === 'string' || typeof children === 'number'
      ? children
      : sectionKey
        ? getSectionTitle(sectionKey)
        : children;

  const commonProps = {
    className,
    style: {
      fontFamily: visualTokens.headerFont,
      color: visualTokens.textColor,
    } as React.CSSProperties,
    children: text,
  };

  if (level === 1) {
    return <h1 {...commonProps} />;
  }
  if (level === 2) {
    return <h2 {...commonProps} />;
  }
  if (level === 3) {
    return <h3 {...commonProps} />;
  }
  return <h4 {...commonProps} />;
}

