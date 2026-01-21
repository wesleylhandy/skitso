/**
 * Socket.io Client Initialization
 * 
 * Initializes Socket.io client for real-time synchronization.
 * Handles connection, reconnection, and optimistic updates.
 */

import { io, type Socket as SocketIOClient } from 'socket.io-client';
import type { VibeType } from '@/src/state/types/vibe';
import type { Script, Vote, WrapPartyData } from '@/src/state/types/session';

// Socket.io client instance
let socket: SocketIOClient | null = null;

// Reconnection configuration
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000; // 1 second base delay
const RECONNECT_DELAY_MAX = 30000; // 30 seconds max delay

// Connection state
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isReconnecting = false;

/**
 * Get server URL for Socket.io connection
 */
function getServerURL(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  // Use environment variable or default to current origin
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${baseURL}/api/socket`;
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
 * Initialize Socket.io client
 */
export function initializeSocketClient(): SocketIOClient {
  if (socket?.connected) {
    return socket;
  }

  const serverURL = getServerURL();

  if (!serverURL) {
    throw new Error('Cannot initialize Socket.io client: server URL not available');
  }

  socket = io(serverURL, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_BASE,
    reconnectionDelayMax: RECONNECT_DELAY_MAX,
    timeout: 20000,
  });

  // Handle connection events
  socket.on('connect', () => {
    console.log('Socket.io connected:', socket?.id);
    reconnectAttempts = 0;
    isReconnecting = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  });

  socket.on('disconnect', (reason: string) => {
    console.log('Socket.io disconnected:', reason);
    handleDisconnection(reason);
  });

  socket.on('connect_error', (error: Error) => {
    console.error('Socket.io connection error:', error);
    handleConnectionError();
  });

  socket.on('reconnect', (attemptNumber: number) => {
    console.log('Socket.io reconnected after', attemptNumber, 'attempts');
    handleReconnection();
  });

  socket.on('reconnect_attempt', (attemptNumber: number) => {
    console.log('Socket.io reconnection attempt:', attemptNumber);
    reconnectAttempts = attemptNumber;
    isReconnecting = true;
  });

  socket.on('reconnect_failed', () => {
    console.error('Socket.io reconnection failed after', RECONNECT_ATTEMPTS, 'attempts');
    isReconnecting = false;
  });

  return socket;
}

/**
 * Get the Socket.io client instance
 */
export function getSocketClient(): SocketIOClient | null {
  return socket;
}

/**
 * Check if socket is connected
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Handle disconnection
 */
function handleDisconnection(reason: string): void {
  // If disconnect was intentional, don't attempt reconnection
  if (reason === 'io client disconnect') {
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

  reconnectTimeout = setTimeout(() => {
    if (socket && !socket.connected) {
      socket.connect();
    }
  }, delay);
}

/**
 * Handle successful reconnection
 */
function handleReconnection(): void {
  reconnectAttempts = 0;
  isReconnecting = false;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Request state recovery from server
  if (socket) {
    socket.emit('state:recover', {
      timestamp: Date.now(),
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
  if (!socket) {
    initializeSocketClient();
  }

  const joinData = {
    sessionId,
    participantId,
    ...(options?.role && { role: options.role }),
    ...(options?.vibeContext && { vibeContext: options.vibeContext }),
  };

  if (!socket?.connected) {
    console.warn('Socket not connected, will join when connected');
    socket?.once('connect', () => {
      socket?.emit('session:join', joinData);
    });
    return;
  }

  socket.emit('session:join', joinData);
}

/**
 * Leave a session room
 */
export function leaveSession(sessionId: string): void {
  if (!socket?.connected) {
    return;
  }

  socket.emit('session:leave', { sessionId });
}

/**
 * Listen for VibeContext changes
 */
export function onVibeContextChange(
  callback: (data: { sessionId: string; vibeContext: VibeType; timestamp: number }) => void
): () => void {
  if (!socket) {
    initializeSocketClient();
  }

  socket?.on('vibe:changed', callback);

  // Return unsubscribe function
  return () => {
    socket?.off('vibe:changed', callback);
  };
}

/**
 * Listen for script updates
 */
export function onScriptUpdate(
  callback: (data: { sessionId: string; script: Script; timestamp: number }) => void
): () => void {
  if (!socket) {
    initializeSocketClient();
  }

  socket?.on('script:updated', callback);

  // Return unsubscribe function
  return () => {
    socket?.off('script:updated', callback);
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
  if (!socket) {
    initializeSocketClient();
  }

  socket?.on('performance:progress', callback);

  // Return unsubscribe function
  return () => {
    socket?.off('performance:progress', callback);
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
  if (!socket?.connected) {
    console.warn('Socket not connected, cannot advance performance');
    return;
  }

  socket.emit('performance:advance', {
    sessionId,
    progress,
  });
}

/**
 * Listen for wrap party vote updates
 */
export function onWrapPartyVote(
  callback: (data: { sessionId: string; vote: Vote; timestamp: number }) => void
): () => void {
  if (!socket) {
    initializeSocketClient();
  }

  socket?.on('wrap-party:vote', callback);

  // Return unsubscribe function
  return () => {
    socket?.off('wrap-party:vote', callback);
  };
}

/**
 * Listen for wrap party data updates
 */
export function onWrapPartyData(
  callback: (data: { sessionId: string; wrapPartyData: WrapPartyData; timestamp: number }) => void
): () => void {
  if (!socket) {
    initializeSocketClient();
  }

  socket?.on('wrap-party:updated', callback);

  // Return unsubscribe function
  return () => {
    socket?.off('wrap-party:updated', callback);
  };
}

/**
 * Listen for performance start event
 */
export function onPerformanceStart(
  callback: (data: { sessionId: string; timestamp: number }) => void
): () => void {
  if (!socket) {
    initializeSocketClient();
  }

  socket?.on('performance:started', callback);

  // Return unsubscribe function
  return () => {
    socket?.off('performance:started', callback);
  };
}

/**
 * Emit wrap party vote
 */
export function submitVote(sessionId: string, vote: Vote): void {
  if (!socket?.connected) {
    console.warn('Socket not connected, cannot submit vote');
    return;
  }

  socket.emit('wrap-party:vote', {
    sessionId,
    vote,
  });
}

/**
 * Emit wrap party data update
 */
export function updateWrapPartyData(sessionId: string, wrapPartyData: WrapPartyData): void {
  if (!socket?.connected) {
    console.warn('Socket not connected, cannot update wrap party data');
    return;
  }

  socket.emit('wrap-party:update', {
    sessionId,
    wrapPartyData,
  });
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  reconnectAttempts = 0;
  isReconnecting = false;
}
