'use client';

import { useEffect, useState, useMemo } from 'react';
import { onConnectionStatusChange, getConnectionStatus } from '@/src/lib/partykit/client';
import type { ConnectionStatus } from '@/src/lib/partykit/client';
import { useVibe } from '@/src/lib/hooks/use-vibe';

interface ConnectionStatusBadgeProps {
  className?: string;
  variant?: 'compact' | 'expanded';
}

/**
 * Connection Status Badge
 * 
 * Displays real-time connection status with clear visual hierarchy:
 * - Connected: Subtle positive indicator
 * - Disconnected: Prominent alert with contextual messaging
 * - Connecting/Reconnecting: Informative state with animation
 * 
 * Follows WCAG 2.1 AA accessibility guidelines with proper ARIA attributes.
 */
export function ConnectionStatusBadge({ 
  className = '', 
  variant = 'expanded' 
}: ConnectionStatusBadgeProps) {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());
  const { visualTokens } = useVibe();

  useEffect(() => {
    const unsubscribe = onConnectionStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: '●',
          label: 'Connected',
          description: 'Real-time sync active',
          variant: 'success' as const,
          pulse: false,
        };
      case 'connecting':
        return {
          icon: '●',
          label: 'Connecting',
          description: 'Establishing connection...',
          variant: 'warning' as const,
          pulse: true,
        };
      case 'reconnecting':
        return {
          icon: '●',
          label: 'Reconnecting',
          description: 'Restoring connection...',
          variant: 'warning' as const,
          pulse: true,
        };
      case 'disconnected':
        return {
          icon: '●',
          label: 'Offline',
          description: 'Real-time sync unavailable',
          variant: 'error' as const,
          pulse: false,
        };
      default:
        return {
          icon: '●',
          label: 'Unknown',
          description: 'Connection status unknown',
          variant: 'neutral' as const,
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  // Generate theme-aware styles using semantic colors from vibe
  const variantStyles = useMemo(() => {
    const { successColor, warningColor, errorColor, bgColor, textColor } = visualTokens;
    
    // Helper to add opacity to hex color
    const withOpacity = (color: string, opacity: number) => {
      // Handle hex colors
      if (color.startsWith('#')) {
        const hex = color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
      // Handle rgb/rgba colors
      if (color.startsWith('rgb')) {
        return color.replace(/[\d.]+\)$/g, `${opacity})`);
      }
      return color;
    };

    // Determine if background is light or dark
    const isLightBg = bgColor === '#FFFFFF' || bgColor === '#F5F5F5';

    return {
      success: {
        container: {
          backgroundColor: withOpacity(successColor, isLightBg ? 0.1 : 0.2),
          borderColor: withOpacity(successColor, isLightBg ? 0.3 : 0.5),
        },
        text: { color: successColor },
        icon: { color: successColor },
      },
      warning: {
        container: {
          backgroundColor: withOpacity(warningColor, isLightBg ? 0.1 : 0.2),
          borderColor: withOpacity(warningColor, isLightBg ? 0.4 : 0.6),
        },
        text: { color: warningColor },
        icon: { color: warningColor },
      },
      error: {
        container: {
          backgroundColor: withOpacity(errorColor, isLightBg ? 0.1 : 0.2),
          borderColor: withOpacity(errorColor, isLightBg ? 0.3 : 0.5),
        },
        text: { color: errorColor },
        icon: { color: errorColor },
      },
      neutral: {
        container: {
          backgroundColor: withOpacity(textColor, isLightBg ? 0.05 : 0.1),
          borderColor: withOpacity(textColor, isLightBg ? 0.2 : 0.3),
        },
        text: { color: withOpacity(textColor, 0.7) },
        icon: { color: withOpacity(textColor, 0.6) },
      },
    };
  }, [visualTokens]);

  const styles = variantStyles[config.variant];

  // Compact variant: Minimal indicator for non-critical states
  if (variant === 'compact' && status === 'connected') {
    return (
      <div 
        className={`flex items-center gap-2 ${className}`}
        role="status"
        aria-live="polite"
        aria-label={`Connection status: ${config.label}`}
      >
        <div className="relative">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: visualTokens.successColor }}
            aria-hidden="true"
          />
        </div>
        <span className="text-xs sr-only" style={{ color: visualTokens.textColor, opacity: 0.7 }}>
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${className}`}
      style={{
        ...styles.container,
        borderRadius: visualTokens.borderRadius,
      }}
      role="status"
      aria-live={status === 'disconnected' ? 'assertive' : 'polite'}
      aria-label={`Connection status: ${config.label}. ${config.description}`}
    >
      <div className="relative shrink-0">
        <div
          className={`text-xs ${config.pulse ? 'animate-pulse' : ''}`}
          style={{
            ...styles.icon,
            fontSize: '0.5rem',
          }}
          aria-hidden="true"
        >
          {config.icon}
        </div>
        {config.pulse && (
          <div
            className="absolute inset-0 opacity-75 animate-ping"
            style={{
              ...styles.icon,
              fontSize: '0.5rem',
            }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold" style={styles.text}>
          {config.label}
        </span>
        {variant === 'expanded' && (
          <span className="text-xs" style={{ ...styles.text, opacity: 0.8 }}>
            {config.description}
          </span>
        )}
      </div>
    </div>
  );
}
