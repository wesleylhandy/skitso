/**
 * PartyKit Client Wrapper
 * 
 * Provides Socket.io-compatible interface for PartyKit client.
 * Migrated from Socket.io to PartyKit for Vercel compatibility.
 */

import PartySocket from 'partysocket';
import type { VibeType } from '@/src/state/types/vibe';
import type { Script, Vote, WrapPartyData } from '@/src/state/types/session';

// PartyKit client instance
let partySocket: PartySocket | null = null;

// Connection state
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

let connectionStatus: ConnectionStatus = 'disconnected';
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isReconnecting = false;

// Reconnection configuration
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000; // 1 second base delay
const RECONNECT_DELAY_MAX = 30000; // 30 seconds max delay

// Event listeners
type EventCallback = (data: unknown) => void;
const eventListeners = new Map<string, Set<EventCallback>>();

/**
 * Get PartyKit host URL
 */
function getPartyKitHost(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  // Use environment variable or default to localhost for dev
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';
  return host.startsWith('http') ? host : `http://${host}`;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = Math.min(
    RECONNECT_DELAY_BASE * Math.pow(2, attempt),
    RECONNECT_DELAY_MAX
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Initialize PartyKit client
 */
export function initializePartyKitClient(room: string): PartySocket {
  if (partySocket?.readyState === WebSocket.OPEN && partySocket.room === room) {
    return partySocket;
  }

  const host = getPartyKitHost();

  if (!host) {
    throw new Error('Cannot initialize PartyKit client: host not available');
  }

  // Close existing connection if different room
  if (partySocket && partySocket.room !== room) {
    partySocket.close();
  }

  partySocket = new PartySocket({
    host,
    room,
  });

  // Set up event listeners
  partySocket.addEventListener('open', () => {
    console.log('PartyKit connected:', partySocket?.id);
    connectionStatus = 'connected';
    reconnectAttempts = 0;
    isReconnecting = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    // Trigger connect event
    triggerEvent('connect', {});
  });

  partySocket.addEventListener('close', (event: CloseEvent) => {
    console.log('PartyKit disconnected:', event.code, event.reason);
    connectionStatus = 'disconnected';
    handleDisconnection(event.code);
  });

  partySocket.addEventListener('error', (error: Event) => {
    console.error('PartyKit connection error:', error);
    handleConnectionError();
  });

  partySocket.addEventListener('message', (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      
      // Handle connection status events
      if (type === 'connect' || type === 'open') {
        connectionStatus = 'connected';
        triggerEvent('connect', {});
      } else if (type === 'disconnect' || type === 'close') {
        connectionStatus = 'disconnected';
        triggerEvent('disconnect', {});
      } else if (type === 'error') {
        connectionStatus = 'disconnected';
        triggerEvent('error', data);
      } else {
        // Trigger event for all other message types
        triggerEvent(type, data);
      }
    } catch (error) {
      console.error('Error parsing PartyKit message:', error);
    }
  });

  return partySocket;
}

/**
 * Get the PartyKit client instance
 */
export function getPartyKitClient(): PartySocket | null {
  return partySocket;
}

/**
 * Check if client is connected
 */
export function isPartyKitConnected(): boolean {
  return partySocket?.readyState === WebSocket.OPEN;
}

/**
 * Get connection status
 */
export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

/**
 * Handle disconnection
 */
function handleDisconnection(code: number): void {
  // If disconnect was intentional (code 1000), don't attempt reconnection
  if (code === 1000) {
    return;
  }

  // Otherwise, attempt reconnection with exponential backoff
  if (reconnectAttempts < RECONNECT_ATTEMPTS && !isReconnecting) {
    isReconnecting = true;
    scheduleReconnection();
  }
}

/**
 * Handle connection error
 */
function handleConnectionError(): void {
  if (reconnectAttempts < RECONNECT_ATTEMPTS && !isReconnecting) {
    isReconnecting = true;
    scheduleReconnection();
  }
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnection(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  const delay = calculateBackoffDelay(reconnectAttempts);
  console.log(`Scheduling reconnection in ${delay}ms (attempt ${reconnectAttempts + 1})`);

  connectionStatus = 'reconnecting';
  reconnectAttempts++;

  reconnectTimeout = setTimeout(() => {
    if (partySocket && partySocket.readyState !== WebSocket.OPEN) {
      const currentRoom = partySocket.room;
      if (currentRoom) {
        initializePartyKitClient(currentRoom);
      }
    }
  }, delay);
}

/**
 * Trigger event to all listeners
 */
function triggerEvent(eventType: string, data: unknown): void {
  const listeners = eventListeners.get(eventType);
  if (listeners) {
    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }
}

/**
 * Join a session room
 */
export function joinSession(
  sessionId: string,
  participantId: string,
  options?: { role?: 'director' | 'actor'; vibeContext?: VibeType }
): void {
  // Initialize client with session room
  initializePartyKitClient(sessionId);

  if (!partySocket) {
    throw new Error('Failed to initialize PartyKit client');
  }

  const joinData = {
    sessionId,
    participantId,
    ...(options?.role && { role: options.role }),
    ...(options?.vibeContext && { vibeContext: options.vibeContext }),
  };

  if (partySocket.readyState === WebSocket.OPEN) {
    partySocket.send(JSON.stringify({
      type: 'session:join',
      data: joinData,
    }));
  } else {
    // Wait for connection
    partySocket.addEventListener('open', () => {
      partySocket?.send(JSON.stringify({
        type: 'session:join',
        data: joinData,
      }));
    }, { once: true });
  }
}

/**
 * Leave a session room
 */
export function leaveSession(sessionId: string): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'session:leave',
    data: { sessionId },
  }));
}

/**
 * Listen for VibeContext changes
 */
export function onVibeContextChange(
  callback: (data: { sessionId: string; vibeContext: VibeType; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('vibe:changed')) {
    eventListeners.set('vibe:changed', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; vibeContext: VibeType; timestamp: number });
  };
  eventListeners.get('vibe:changed')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('vibe:changed');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for script updates
 */
export function onScriptUpdate(
  callback: (data: { sessionId: string; script: Script; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('script:updated')) {
    eventListeners.set('script:updated', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; script: Script; timestamp: number });
  };
  eventListeners.get('script:updated')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('script:updated');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for performance progress updates
 */
export function onPerformanceProgress(
  callback: (data: {
    sessionId: string;
    progress: {
      currentLineIndex: number;
      currentScene: number;
      startedAt: number | null;
      pausedAt: number | null;
      completedLines: number[];
    };
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('performance:progress')) {
    eventListeners.set('performance:progress', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      progress: {
        currentLineIndex: number;
        currentScene: number;
        startedAt: number | null;
        pausedAt: number | null;
        completedLines: number[];
      };
      timestamp: number;
    });
  };
  eventListeners.get('performance:progress')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('performance:progress');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Emit performance advancement
 */
export function advancePerformance(
  sessionId: string,
  progress: {
    currentLineIndex: number;
    currentScene: number;
    startedAt: number | null;
    pausedAt: number | null;
    completedLines: number[];
  }
): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot advance performance');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'performance:advance',
    data: {
      sessionId,
      progress,
    },
  }));
}

/**
 * Listen for wrap party vote updates
 */
export function onWrapPartyVote(
  callback: (data: { sessionId: string; vote: Vote; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('wrap-party:vote')) {
    eventListeners.set('wrap-party:vote', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; vote: Vote; timestamp: number });
  };
  eventListeners.get('wrap-party:vote')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('wrap-party:vote');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for wrap party data updates
 */
export function onWrapPartyData(
  callback: (data: { sessionId: string; wrapPartyData: WrapPartyData; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('wrap-party:updated')) {
    eventListeners.set('wrap-party:updated', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; wrapPartyData: WrapPartyData; timestamp: number });
  };
  eventListeners.get('wrap-party:updated')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('wrap-party:updated');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for performance start event
 */
export function onPerformanceStart(
  callback: (data: { sessionId: string; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('performance:started')) {
    eventListeners.set('performance:started', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; timestamp: number });
  };
  eventListeners.get('performance:started')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('performance:started');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Emit wrap party vote
 */
export function submitVote(sessionId: string, vote: Vote): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot submit vote');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'wrap-party:vote',
    data: {
      sessionId,
      vote,
    },
  }));
}

/**
 * Emit wrap party data update
 */
export function updateWrapPartyData(sessionId: string, wrapPartyData: WrapPartyData): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot update wrap party data');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'wrap-party:update',
    data: {
      sessionId,
      wrapPartyData,
    },
  }));
}

/**
 * Start performance (Director only)
 */
export function startPerformance(sessionId: string): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot start performance');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'performance:start',
    data: { sessionId },
  }));
}

/**
 * Disconnect client
 */
export function disconnectPartyKit(): void {
  if (partySocket) {
    partySocket.close();
    partySocket = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  reconnectAttempts = 0;
  isReconnecting = false;
  connectionStatus = 'disconnected';
  eventListeners.clear();
}
