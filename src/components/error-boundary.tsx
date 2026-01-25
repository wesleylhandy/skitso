'use client';

/**
 * App-wide Error Boundary
 *
 * Catches unexpected runtime errors in client components and
 * renders a vibe-aware fallback using the text registry.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { VibePanel } from '@/src/components/ui/vibe-panel';
import { VibeHeading } from '@/src/components/ui/vibe-heading';
import { BackButton } from '@/src/components/ui/back-button';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console for now; production can hook into monitoring
     
    console.error('Unexpected application error:', error, info);
  }

  private handleReset = () => {
    // Simple full reload is the safest reset for now
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Vibe-aware fallback shell; inner components handle tone via text registry
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
        }}
      >
        <div className="w-full max-w-lg space-y-6">
          <BackButton to="/" />
          <VibePanel>
            <VibeHeading
              level={1}
              sectionKey="unexpectedErrorTitle"
              className="mb-4 text-2xl font-bold"
            >
              Something went sideways.
            </VibeHeading>
            <ErrorMessage
              // Let text registry provide a friendly, vibe-aware message
              errorType="network"
              className="mb-4"
            />
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 font-semibold rounded"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-bg)',
              }}
            >
              Reload Skitso
            </button>
          </VibePanel>
        </div>
      </div>
    );
  }
}

