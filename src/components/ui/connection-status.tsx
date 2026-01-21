/**
 * Connection Status Indicator Component
 * 
 * Displays the current Socket.io connection status with visual indicators.
 */

'use client';

import type { ConnectionStatus as ConnectionStatusType } from '@/src/state/types/session';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  className?: string;
}

/**
 * Connection Status Component
 * 
 * Displays connection status with appropriate styling and accessibility.
 */
export function ConnectionStatus({ status, className = '' }: ConnectionStatusProps) {
  const statusConfig = {
    connected: {
      label: 'Connected',
      ariaLabel: 'Connection status: Connected',
      indicatorClass: 'bg-green-500',
      textClass: 'text-green-500',
    },
    disconnected: {
      label: 'Disconnected',
      ariaLabel: 'Connection status: Disconnected',
      indicatorClass: 'bg-red-500',
      textClass: 'text-red-500',
    },
    reconnecting: {
      label: 'Reconnecting...',
      ariaLabel: 'Connection status: Reconnecting',
      indicatorClass: 'bg-yellow-500 animate-pulse',
      textClass: 'text-yellow-500',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <span
        className={`w-2 h-2 rounded-full ${config.indicatorClass}`}
        aria-hidden="true"
      />
      <span className={`text-sm font-medium ${config.textClass}`} aria-label={config.ariaLabel}>
        {config.label}
      </span>
    </div>
  );
}
