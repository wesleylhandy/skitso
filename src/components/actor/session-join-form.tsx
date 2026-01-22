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

interface SessionJoinFormProps {
  initialSessionCode?: string;
}

export function SessionJoinForm({ initialSessionCode }: SessionJoinFormProps) {
  const router = useRouter();
  const [, setParticipant] = useAtom(participantAtom);
  const [, setVibe] = useAtom(vibeAtom);
  const [sessionCodeFromAtom, setSessionCode] = useAtom(sessionCodeAtom);

  // Prefill session code from prop or atom
  const [sessionCode, setSessionCodeInput] = useState(initialSessionCode || sessionCodeFromAtom || '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');

  // Update session code input when atom changes (e.g., from URL)
  useEffect(() => {
    if (sessionCodeFromAtom && !sessionCode) {
      setSessionCodeInput(sessionCodeFromAtom);
    }
  }, [sessionCodeFromAtom, sessionCode]);

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
          name: joinData.participant.name,
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

      // Don't redirect if already on the join page - just refresh to show character
      // The join/[sessionCode]/page.tsx will handle showing the character card
      // if participant.characterAssignment exists
      if (joinData.participant.characterAssignment) {
        // Character was assigned, page will automatically show it
        // No redirect needed - we're already on the join page
      } else {
        // No character assigned yet, stay on page
        // The page will update when character is assigned
      }
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
          onChange={(e) => setSessionCodeInput(e.target.value)}
          onBlur={(e) => setSessionCodeInput(e.target.value.toUpperCase().trim())}
          placeholder="Enter session code"
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={loading}
          aria-label="Session code"
          autoComplete="off"
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
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={loading}
          aria-label="Your name"
          required
        />
      </div>

      {error && (
        <div className="mt-2">
          <ErrorMessage message={error} />
        </div>
      )}

      {joined && (
        <div className="mt-4 p-4 border rounded-md bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Connection Status</span>
            <ConnectionStatus status={connectionStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            {connectionStatus === 'connected' && 'Successfully joined session!'}
            {connectionStatus === 'reconnecting' && 'Reconnecting to session...'}
            {connectionStatus === 'disconnected' && 'Connecting to session...'}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || joined}
        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 active:bg-primary/80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {loading ? 'Joining...' : joined ? 'Joined' : 'Join Session'}
      </button>
    </form>
  );
}
