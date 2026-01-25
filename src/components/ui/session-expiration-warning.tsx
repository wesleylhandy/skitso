'use client';

import { useEffect, useState } from 'react';

interface SessionExpirationWarningProps {
  expiresAt: number;
  className?: string;
}

/**
 * Session Expiration Warning Component
 * 
 * Shows warnings when session is approaching expiration:
 * - Warning at 1 hour remaining
 * - Critical warning at 15 minutes remaining
 * - Error state when expired
 */
export function SessionExpirationWarning({ expiresAt, className = '' }: SessionExpirationWarningProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [warningLevel, setWarningLevel] = useState<'none' | 'warning' | 'critical' | 'expired'>('none');

  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = Date.now();
      const remaining = expiresAt - now;
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        setWarningLevel('expired');
        return;
      }
      
      setTimeRemaining(remaining);
      
      // Set warning level based on time remaining
      const minutesRemaining = remaining / (60 * 1000);
      const hoursRemaining = minutesRemaining / 60;
      
      if (minutesRemaining <= 15) {
        setWarningLevel('critical');
      } else if (hoursRemaining <= 1) {
        setWarningLevel('warning');
      } else {
        setWarningLevel('none');
      }
    };

    // Update immediately
    updateTimeRemaining();

    // Update every 30 seconds
    const interval = setInterval(updateTimeRemaining, 30000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (warningLevel === 'none' || timeRemaining === null) {
    return null;
  }

  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return 'Expired';
    
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getWarningConfig = () => {
    switch (warningLevel) {
      case 'expired':
        return {
          bgColor: 'bg-red-100 dark:bg-red-900',
          borderColor: 'border-red-500',
          textColor: 'text-red-800 dark:text-red-200',
          icon: '⚠️',
          message: 'This session has expired. Please create a new session.',
        };
      case 'critical':
        return {
          bgColor: 'bg-red-100 dark:bg-red-900',
          borderColor: 'border-red-500',
          textColor: 'text-red-800 dark:text-red-200',
          icon: '🔴',
          message: `Session expires in ${formatTimeRemaining(timeRemaining)}. Please save your work.`,
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-100 dark:bg-yellow-900',
          borderColor: 'border-yellow-500',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          icon: '⚠️',
          message: `Session expires in ${formatTimeRemaining(timeRemaining)}.`,
        };
      default:
        return null;
    }
  };

  const config = getWarningConfig();
  if (!config) return null;

  return (
    <div
      className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${config.textColor} ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <span className="text-sm font-medium">{config.message}</span>
      </div>
    </div>
  );
}
