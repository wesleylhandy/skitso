/**
 * Error Message Component
 * 
 * Displays vibe-appropriate error messages using the text registry.
 */

'use client';

import { useVibe } from '@/src/lib/hooks/use-vibe';

interface ErrorMessageProps {
  errorType?: 'required' | 'invalid' | 'network' | 'generation';
  message?: string;
  className?: string;
}

export function ErrorMessage({ errorType = 'network', message, className = '' }: ErrorMessageProps) {
  const { getErrorMessage } = useVibe();
  
  const displayMessage = message || getErrorMessage(errorType);

  return (
    <div
      className={`error-message ${className}`}
      role="alert"
      aria-live="polite"
    >
      <p className="text-[var(--color-error,red)]">{displayMessage}</p>
    </div>
  );
}
