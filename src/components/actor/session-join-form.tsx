/**
 * Session Join Form Component
 * 
 * Allows actors to join a session by entering a session code.
 * Handles form submission, validation, and API calls.
 * Displays connection status after successful join.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { validateSessionCodeSecurity } from '@/src/lib/utils/session-code';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { ConnectionStatus } from '@/src/components/ui/connection-status';
import {
  initializePartyKitClient,
  getPartyKitClient,
  isPartyKitConnected,
  joinSession,
} from '@/src/lib/partykit/client';
import type { Participant } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';
import type { ConnectionStatus as ConnectionStatusType } from '@/src/state/types/session';

interface JoinResponse {
  participant: Participant;
  session: {
    id: string;
    vibeContext: VibeType;
    status: string;
  };
}

export function SessionJoinForm() {
  const router = useRouter();
  const [, setParticipant] = useAtom(participantAtom);
  const [, setVibe] = useAtom(vibeAtom);
  const [, setSessionCode] = useAtom(sessionCodeAtom);

  const [sessionCode, setSessionCodeInput] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');

  // Cleanup PartyKit connection on unmount
  useEffect(() => {
    return () => {
      // PartyKit cleanup handled by component unmount
    };
  }, [joined]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate session code format
    if (!validateSessionCodeSecurity(sessionCode)) {
      setError('Invalid session code format. Must be 8-10 alphanumeric characters.');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);

    try {
      // First, validate session exists
      const sessionResponse = await fetch(`/api/sessions/${sessionCode}`, {
        method: 'POST',
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to validate session');
      }

      // Join session
      const joinResponse = await fetch(`/api/sessions/${sessionCode}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json();
        throw new Error(errorData.error || 'Failed to join session');
      }

      const joinData: JoinResponse = await joinResponse.json();

      // Store participant data
      setParticipant(joinData.participant);

      // Sync VibeContext from session
      setVibe(joinData.session.vibeContext);

      // Store session code
      setSessionCode(sessionCode);

      // Mark as joined
      setJoined(true);

      // Initialize PartyKit connection after successful join
      try {
        const client = initializePartyKitClient(sessionCode);
        
        // Update connection status
        const updateConnectionStatus = () => {
          setConnectionStatus(isPartyKitConnected() ? 'connected' : 'disconnected');
        };

        // Join session room (actor role)
        joinSession(sessionCode, joinData.participant.id, {
          role: 'actor',
        });

        // Initial status check and periodic updates
        updateConnectionStatus();
        const statusInterval = setInterval(updateConnectionStatus, 1000);
        
        // Cleanup interval after 5 seconds
        setTimeout(() => clearInterval(statusInterval), 5000);
      } catch (partyKitError) {
        console.error('Failed to initialize PartyKit connection:', partyKitError);
        setConnectionStatus('disconnected');
      }

      // Navigate to casting couch or character display after a brief delay
      // to allow connection status to be visible
      setTimeout(() => {
        router.push(`/join/${sessionCode}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sessionCode" className="block text-sm font-medium mb-2">
          Session Code
        </label>
        <input
          id="sessionCode"
          type="text"
          value={sessionCode}
          onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
          placeholder="Enter session code"
          className="w-full px-4 py-2 border rounded-md"
          disabled={loading}
          aria-label="Session code"
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Your Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-2 border rounded-md"
          disabled={loading}
          aria-label="Your name"
          required
        />
      </div>

      {error && <ErrorMessage message={error} />}

      {joined && (
        <div className="mt-4 p-4 border rounded-md bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Connection Status</span>
            <ConnectionStatus status={connectionStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            {connectionStatus === 'connected' && 'Connected to session. Redirecting...'}
            {connectionStatus === 'reconnecting' && 'Reconnecting to session...'}
            {connectionStatus === 'disconnected' && 'Connecting to session...'}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || joined}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
      >
        {loading ? 'Joining...' : joined ? 'Joined' : 'Join Session'}
      </button>
    </form>
  );
}
