/**
 * Session Join Page
 * 
 * Dynamic route for joining a session via shareable link.
 * Extracts session code from URL, validates session, and syncs VibeContext.
 */

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom, useAtomValue } from 'jotai';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { sessionCodeAtom } from '@/src/state/atoms/session-atom';
import { participantAtom } from '@/src/state/atoms/participant-atom';
import { sessionStateAtom } from '@/src/state/atoms/session-state-atom';
import { SessionJoinForm } from '@/src/components/actor/session-join-form';
import { CharacterCard } from '@/src/components/actor/character-card';
import { ActorPreview } from '@/src/components/actor/actor-preview';
import { ErrorMessage } from '@/src/components/ui/error-message';
import { BackButton } from '@/src/components/ui/back-button';
import { castAtom } from '@/src/state/atoms/cast-atom';
import { currentScriptAtom } from '@/src/state/atoms/script-atom';
import {
  initializePartyKitClient,
  onPerformanceStart,
  onCharacterAssigned,
  onAssignmentApproved,
  onAssignmentSuggested,
  onAssignmentConfirmed,
  onScriptUpdate,
  onCastUpdate,
  onSessionStateUpdate,
  onReconnect,
  getPartyKitClient,
} from '@/src/lib/partykit/client';
import { ConnectionStatusBadge } from '@/src/components/ui/connection-status-badge';
import { SessionExpirationWarning } from '@/src/components/ui/session-expiration-warning';
import type { VibeType } from '@/src/state/types/vibe';
import type { Character, Script } from '@/src/state/types/session';

interface SessionJoinPageProps {
  params: Promise<{ sessionCode: string }>;
}

export default function SessionJoinPage({ params }: SessionJoinPageProps) {
  const { sessionCode } = use(params);
  const router = useRouter();
  const [, setVibe] = useAtom(vibeAtom);
  const [, setSessionCode] = useAtom(sessionCodeAtom);
  const [participant, setParticipant] = useAtom(participantAtom);
  const [sessionState, setSessionState] = useAtom(sessionStateAtom);
  const [cast, setCast] = useAtom(castAtom);
  const [script, setScript] = useAtom(currentScriptAtom);

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

        // Now connect via PartyKit to get real-time state
        // Retry connection with exponential backoff if room doesn't exist yet (404)
        // This handles race condition where session exists but PartyKit room hasn't been initialized
        try {
          let retryCount = 0;
          const maxRetries = 5;
          const baseDelay = 500; // 500ms base delay
          let client: ReturnType<typeof initializePartyKitClient> | null = null;
          
          const connectWithRetry = async (): Promise<void> => {
          while (retryCount < maxRetries) {
            try {
              client = initializePartyKitClient(sessionCode);
              
              // Wait for PartyKit connection
              const waitForConnection = (): Promise<void> => {
                return new Promise((resolve, reject) => {
                  if (client && client.readyState === WebSocket.OPEN) {
                    resolve();
                    return;
                  }

                  const timeout = setTimeout(() => {
                    reject(new Error('PartyKit connection timeout'));
                  }, 5000);

                  let connectionClosed = false;
                  
                  const onClose = () => {
                    connectionClosed = true;
                    clearTimeout(timeout);
                    // Room might not exist yet (404), retry
                    reject(new Error('ROOM_NOT_READY'));
                  };
                  
                  const onError = () => {
                    if (!connectionClosed) {
                      clearTimeout(timeout);
                      reject(new Error('ROOM_NOT_READY'));
                    }
                  };
                  
                  const onOpen = () => {
                    clearTimeout(timeout);
                    if (client) {
                      client.removeEventListener('close', onClose);
                      client.removeEventListener('error', onError);
                      client.removeEventListener('open', onOpen);
                    }
                    resolve();
                  };

                  if (client) {
                    if (client.readyState === WebSocket.OPEN) {
                      clearTimeout(timeout);
                      resolve();
                      return;
                    }
                    
                    client.addEventListener('close', onClose, { once: true });
                    client.addEventListener('error', onError, { once: true });
                    client.addEventListener('open', onOpen, { once: true });
                  }

                  const checkConnection = () => {
                    if (client && client.readyState === WebSocket.OPEN) {
                      clearTimeout(timeout);
                      if (client) {
                        client.removeEventListener('close', onClose);
                        client.removeEventListener('error', onError);
                        client.removeEventListener('open', onOpen);
                      }
                      resolve();
                    } else if (client && client.readyState === WebSocket.CLOSED && !connectionClosed) {
                      clearTimeout(timeout);
                      reject(new Error('ROOM_NOT_READY'));
                    }
                  };

                  const interval = setInterval(checkConnection, 100);
                  
                  // Cleanup interval on timeout or success
                  setTimeout(() => {
                    clearInterval(interval);
                    if (client) {
                      client.removeEventListener('close', onClose);
                      client.removeEventListener('error', onError);
                      client.removeEventListener('open', onOpen);
                    }
                  }, 5000);
                });
              };

              await waitForConnection();
              return; // Success, exit retry loop
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              
              // If it's a room not ready error and we have retries left, retry
              if (errorMessage === 'ROOM_NOT_READY' && retryCount < maxRetries - 1) {
                retryCount++;
                const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
                console.log(`PartyKit room not ready, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry
              }
              
              // If it's the last retry or a different error, throw
              throw error;
            }
          }
        };

        await connectWithRetry();
        
        // Ensure we have the client
        if (!client) {
          client = initializePartyKitClient(sessionCode);
        }

        // Request state recovery from PartyKit server
        client.send(JSON.stringify({
          type: 'state:recover',
          data: {
            sessionId: sessionCode,
            timestamp: Date.now(),
          },
        }));

        // Listen for state recovery response
        const handleStateRecovered = (recoveredData: {
          sessionId: string;
          vibeContext: VibeType;
          status: string;
          participants: unknown[];
          cast?: Character[];
          script?: Script | null;
        }) => {
          if (recoveredData.sessionId === sessionCode && mounted) {
            // Update vibe from PartyKit (source of truth)
            setVibe(recoveredData.vibeContext);
            
            // Update session state
            if (recoveredData.status === 'performing' || recoveredData.status === 'casting' || recoveredData.status === 'configuring') {
              setSessionState(recoveredData.status as 'performing' | 'casting' | 'configuring');
            }
            
            // Update cast if provided
            if (recoveredData.cast) {
              setCast(recoveredData.cast);
              
              // Check if current participant has a character assignment in the recovered cast
              setParticipant((currentParticipant) => {
                if (!currentParticipant) return currentParticipant;
                
                const assignedCharacter = recoveredData.cast!.find((char) => char.participantId === currentParticipant.id);
                if (assignedCharacter) {
                  return {
                    ...currentParticipant,
                    characterAssignment: assignedCharacter,
                    assignmentStatus: assignedCharacter.isLocked ? 'locked' : 'pending',
                  };
                }
                return currentParticipant;
              });
            }
            
            // Update script if provided
            if (recoveredData.script !== undefined) {
              setScript(recoveredData.script);
            }
          }
        };

        // Set up event listener for state:recovered
        const onMessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'state:recovered') {
              handleStateRecovered(message.data);
            }
          } catch (error) {
            // Ignore parse errors
          }
        };

        client.addEventListener('message', onMessage);

        // Listen for performance start
        const unsubscribePerformance = onPerformanceStart((data) => {
          if (data.sessionId === sessionCode && mounted) {
            // Update session state
            setSessionState('performing');
            // Navigate to stage
            router.push(`/stage/${sessionCode}`);
          }
        });

        // Listen for character assignment events
        const unsubscribeCharacterAssigned = onCharacterAssigned((data) => {
          if (data.sessionId === sessionCode && mounted) {
            let updatedCharacter: Character | null = null;
            
            setCast((currentCast) => {
              const updatedCast = currentCast.map((char) => {
                if (char.id === data.characterId) {
                  updatedCharacter = { ...char, participantId: data.participantId, isLocked: data.isLocked };
                  return updatedCharacter;
                }
                // Unassign from participant if they got a different character
                if (data.participantId && char.participantId === data.participantId && char.id !== data.characterId) {
                  return { ...char, participantId: null, isLocked: false };
                }
                return char;
              });
              return updatedCast;
            });

            // Update participant if it's the current participant
            if (updatedCharacter) {
              setParticipant((currentParticipant) => {
                if (!currentParticipant || data.participantId !== currentParticipant.id) {
                  return currentParticipant;
                }
                
                return {
                  ...currentParticipant,
                  characterAssignment: updatedCharacter,
                  assignmentStatus: data.isLocked ? 'locked' : 'pending',
                };
              });
            }
          }
        });

        // Listen for assignment approval
        const unsubscribeAssignmentApproved = onAssignmentApproved((data) => {
          if (data.sessionId === sessionCode && mounted && participant && data.participantId === participant.id) {
            const approvedCharacter = cast.find((c) => c.id === data.characterId);
            if (approvedCharacter) {
              setParticipant({
                ...participant,
                characterAssignment: approvedCharacter,
                assignmentStatus: 'pending',
                requestedCharacterId: null,
              });
            }
          }
        });

        // Listen for assignment suggestion
        const unsubscribeAssignmentSuggested = onAssignmentSuggested((data) => {
          if (data.sessionId === sessionCode && mounted && participant && data.participantId === participant.id) {
            const suggestedCharacter = cast.find((c) => c.id === data.suggestedCharacterId);
            if (suggestedCharacter) {
              setParticipant({
                ...participant,
                characterAssignment: suggestedCharacter,
                assignmentStatus: 'pending',
                requestedCharacterId: null,
              });
            }
          }
        });

        // Listen for assignment confirmation
        const unsubscribeAssignmentConfirmed = onAssignmentConfirmed((data) => {
          if (data.sessionId === sessionCode && mounted) {
            setCast((currentCast) => {
              return currentCast.map((char) => {
                if (char.id === data.characterId) {
                  return { ...char, isLocked: true };
                }
                return char;
              });
            });

            if (participant && data.participantId === participant.id) {
              setParticipant({
                ...participant,
                assignmentStatus: 'locked',
              });
            }
          }
        });

        // Listen for script updates
        const unsubscribeScriptUpdate = onScriptUpdate((data) => {
          if (data.sessionId === sessionCode && mounted) {
            setScript(data.script);
          }
        });

        // Listen for cast updates
        const unsubscribeCastUpdate = onCastUpdate((data) => {
          if (data.sessionId === sessionCode && mounted) {
            setCast(data.cast);
            
            // Check if current participant has a character assignment in the updated cast
            setParticipant((currentParticipant) => {
              if (!currentParticipant) return currentParticipant;
              
              const assignedCharacter = data.cast.find((char) => char.participantId === currentParticipant.id);
              if (assignedCharacter && (!currentParticipant.characterAssignment || currentParticipant.characterAssignment.id !== assignedCharacter.id)) {
                return {
                  ...currentParticipant,
                  characterAssignment: assignedCharacter,
                  assignmentStatus: assignedCharacter.isLocked ? 'locked' : 'pending',
                };
              }
              return currentParticipant;
            });
          }
        });

        // Listen for session state updates
        const unsubscribeSessionStateUpdate = onSessionStateUpdate((data) => {
          if (data.sessionId === sessionCode && mounted) {
            setSessionState(data.status);
          }
        });

        // Request state recovery function
        const requestStateRecovery = () => {
          const currentClient = getPartyKitClient();
          if (currentClient && currentClient.readyState === WebSocket.OPEN) {
            currentClient.send(JSON.stringify({
              type: 'state:recover',
              data: {
                sessionId: sessionCode,
                timestamp: Date.now(),
              },
            }));
          }
        };

        // Listen for reconnection events - auto-recover state
        const unsubscribeReconnect = onReconnect((data) => {
          if (data.sessionId === sessionCode && mounted) {
            console.log('Reconnection detected, requesting state recovery');
            // Small delay to ensure connection is fully established
            setTimeout(() => {
              requestStateRecovery();
            }, 100);
          }
        });

        // Cleanup function
        socketCleanup = () => {
          if (client) {
            client.removeEventListener('message', onMessage);
          }
          unsubscribePerformance();
          unsubscribeCharacterAssigned();
          unsubscribeAssignmentApproved();
          unsubscribeAssignmentSuggested();
          unsubscribeAssignmentConfirmed();
          unsubscribeScriptUpdate();
          unsubscribeCastUpdate();
          unsubscribeSessionStateUpdate();
          unsubscribeReconnect();
        };

        // Set loading to false after PartyKit connection
        if (mounted) {
          setLoading(false);
        }
      } catch (partyKitError) {
        console.warn('Failed to connect via PartyKit, using REST API data:', partyKitError);
        // If PartyKit fails, we already have data from REST API
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

  // Redirect to stage if session is performing and script exists (allows bystanders to watch)
  useEffect(() => {
    if (participant && sessionState === 'performing' && script) {
      router.push(`/stage/${sessionCode}`);
    }
  }, [participant, sessionState, script, sessionCode, router]);

  // Sync character assignment from cast if it exists but participant doesn't have it
  // This must be outside conditional blocks to follow Rules of Hooks
  const assignedCharacterFromCast = participant ? cast.find((char) => char.participantId === participant.id) : null;
  const assignedCharacterFromParticipant = participant?.characterAssignment ?? null;
  
  useEffect(() => {
    if (participant && assignedCharacterFromCast && !assignedCharacterFromParticipant) {
      console.log('Syncing character assignment from cast:', assignedCharacterFromCast);
      setParticipant({
        ...participant,
        characterAssignment: assignedCharacterFromCast,
        assignmentStatus: assignedCharacterFromCast.isLocked ? 'locked' : 'pending',
      });
    }
  }, [participant?.id, assignedCharacterFromCast?.id, assignedCharacterFromParticipant?.id, setParticipant]);

  // If participant already joined, show preview interface or locked character
  if (participant) {
    // If session is performing and script exists, show loading while redirecting
    if (sessionState === 'performing' && script) {
      return (
        <div className="container mx-auto p-4">
          <p>Redirecting to stage...</p>
        </div>
      );
    }

    // If character is locked, show simple view
    if (participant.characterAssignment && participant.assignmentStatus === 'locked') {
      return (
        <div className="container mx-auto p-4">
          <div
            style={{
              marginBottom: '2rem',
            }}
          >
            <BackButton to="/" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Welcome, {participant.name}!</h1>
            <ConnectionStatusBadge />
          </div>
          <p className="mb-4">Your character assignment is locked:</p>
          <CharacterCard character={participant.characterAssignment} />
          <p className="mt-4 text-sm text-muted-foreground">
            Waiting for director to start the performance...
          </p>
        </div>
      );
    }

    // Check if participant has a character assignment (from participant object or from cast)
    const hasCharacterAssignment = assignedCharacterFromParticipant !== null || assignedCharacterFromCast !== undefined;
    
    // If participant has a character assignment OR script and cast are ready, show preview interface
    const hasScriptAndCast = script && cast.length > 0;
    const shouldShowPreview = hasScriptAndCast || (hasCharacterAssignment && cast.length > 0);
    
    console.log('Join page render check:', {
      hasScriptAndCast,
      hasCharacterAssignment,
      castLength: cast.length,
      assignedCharacterFromParticipant: assignedCharacterFromParticipant?.id,
      assignedCharacterFromCast: assignedCharacterFromCast?.id,
      shouldShowPreview,
    });
    
    if (shouldShowPreview) {
      return (
        <div className="container mx-auto p-4">
          <div
            style={{
              marginBottom: '2rem',
            }}
          >
            <BackButton to="/" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Welcome, {participant.name}!</h1>
            <ConnectionStatusBadge />
          </div>
          <ActorPreview />
        </div>
      );
    }

    // If joined but script/characters not ready yet
    return (
      <div className="container mx-auto p-4">
        <div
          style={{
            marginBottom: '2rem',
          }}
        >
          <BackButton to="/" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Welcome, {participant.name}!</h1>
          <ConnectionStatusBadge />
        </div>
        <p className="mb-4">Waiting for director to generate script and characters...</p>
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
      <SessionJoinForm initialSessionCode={sessionCode} />
    </div>
  );
}
