'use client';

import { useEffect, useState } from 'react';
import { onConnectionStatusChange, getConnectionStatus } from '@/src/lib/partykit/client';
import type { ConnectionStatus } from '@/src/lib/partykit/client';

interface ConnectionStatusBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatusBadge({ className = '', showLabel = true }: ConnectionStatusBadgeProps) {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus());

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
          color: 'bg-green-500',
          label: 'Connected',
          pulse: false,
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          label: 'Connecting...',
          pulse: true,
        };
      case 'reconnecting':
        return {
          color: 'bg-orange-500',
          label: 'Reconnecting...',
          pulse: true,
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          label: 'Disconnected',
          pulse: false,
        };
      default:
        return {
          color: 'bg-gray-500',
          label: 'Unknown',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-2 ${className}`} title={`Connection: ${config.label}`}>
      <div className="relative">
        <div
          className={`w-3 h-3 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
          aria-label={config.label}
        />
        {config.pulse && (
          <div
            className={`absolute inset-0 rounded-full ${config.color} opacity-75 animate-ping`}
            aria-hidden="true"
          />
        )}
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {config.label}
        </span>
      )}
    </div>
  );
}
