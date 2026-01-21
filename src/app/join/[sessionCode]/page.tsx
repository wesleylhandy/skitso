/**
 * Session Join Page
 * 
 * Dynamic route for joining a session via shareable link.
 * Extracts session code from URL, validates session, and syncs VibeContext.
 */

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { SessionJoinForm } from '@/src/components/actor/session-join-form';
import { CharacterCard } from '@/src/components/actor/character-card';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { BackButton } from '@/src/components/ui/back-button';
import {
  initializeSocketClient,
  onPerformanceStart,
} from '@/src/lib/socket/client';
import type { VibeType } from '@/src/state/types/vibe';

interface SessionJoinPageProps {
  params: Promise<{ sessionCode: string }>;
}

export default function SessionJoinPage({ params }: SessionJoinPageProps) {
  const { sessionCode } = use(params);
  const router = useRouter();
  const [, setVibe] = useAtom(vibeAtom);
  const [, setSessionCode] = useAtom(sessionCodeAtom);
  const [participant] = useAtom(participantAtom);
  const [, setSessionState] = useAtom(sessionStateAtom);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session data via socket (with REST API fallback)
  useEffect(() => {
    let mounted = true;
    let socketCleanup: (() => void) | null = null;

    async function loadSession() {
      try {
        // First, try to validate session exists via REST API
        const response = await fetch(`/api/sessions/${sessionCode}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (mounted) {
            setError(errorData.error || 'Failed to load session');
            setLoading(false);
          }
          return;
        }

        const data = await response.json();
        const initialVibe = data.session.vibeContext as VibeType;
        
        // Set initial state from REST API
        if (mounted) {
          setVibe(initialVibe);
          setSessionCode(sessionCode);
        }

        // Now connect via socket to get real-time state
        try {
          const socket = initializeSocketClient();
          
          // Wait for socket connection
          const waitForConnection = (): Promise<void> => {
            return new Promise((resolve, reject) => {
              if (socket.connected) {
                resolve();
                return;
              }

              const timeout = setTimeout(() => {
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                reject(new Error('Socket connection timeout'));
              }, 5000);

              const onConnect = () => {
                clearTimeout(timeout);
                socket.off('connect_error', onError);
                resolve();
              };

              const onError = (err: Error) => {
                clearTimeout(timeout);
                socket.off('connect', onConnect);
                reject(err);
              };

              socket.once('connect', onConnect);
              socket.once('connect_error', onError);
            });
          };

          await waitForConnection();

          // Request state recovery from socket server
          socket.emit('state:recover', {
            sessionId: sessionCode,
            timestamp: Date.now(),
          });

          // Listen for state recovery response
          const onStateRecovered = (recoveredData: {
            sessionId: string;
            vibeContext: VibeType;
            status: string;
            participants: unknown[];
          }) => {
            if (recoveredData.sessionId === sessionCode && mounted) {
              // Update vibe from socket (source of truth)
              setVibe(recoveredData.vibeContext);
            }
          };

          socket.on('state:recovered', onStateRecovered);

          // Listen for performance start
          const unsubscribePerformance = onPerformanceStart((data) => {
            if (data.sessionId === sessionCode && mounted) {
              // Update session state
              setSessionState('performing');
              // Navigate to stage
              router.push(`/stage/${sessionCode}`);
            }
          });

          // Cleanup function
          socketCleanup = () => {
            socket.off('state:recovered', onStateRecovered);
            unsubscribePerformance();
          };

          // Set loading to false after socket connection
          if (mounted) {
            setLoading(false);
          }
        } catch (socketError) {
          console.warn('Failed to connect via socket, using REST API data:', socketError);
          // If socket fails, we already have data from REST API
          if (mounted) {
            setLoading(false);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load session');
          setLoading(false);
        }
      }
    }

    if (sessionCode) {
      loadSession();
    }

    return () => {
      mounted = false;
      if (socketCleanup) {
        socketCleanup();
      }
    };
  }, [sessionCode, setVibe, setSessionCode]);

  // If participant already joined, show character
  if (participant && participant.characterAssignment) {
    return (
      <div className="container mx-auto p-4">
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Welcome, {participant.name}!</h1>
        <p className="mb-4">You&apos;ve been assigned a character:</p>
        <CharacterCard character={participant.characterAssignment} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/" />
        </div>
        <p>Loading session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/" />
        </div>
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div
        style={{
          marginBottom: '2rem',
        }}
      >
        <BackButton to="/" />
      </div>
      <h1 className="text-2xl font-bold mb-4">Join Session</h1>
      <p className="mb-4">Session Code: {sessionCode}</p>
      <SessionJoinForm />
    </div>
  );
}
