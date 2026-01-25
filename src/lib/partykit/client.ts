/**
 * PartyKit Client Wrapper
 * 
 * Provides Socket.io-compatible interface for PartyKit client.
 * Migrated from Socket.io to PartyKit for Vercel compatibility.
 */

import PartySocket from 'partysocket';
import type { VibeType } from '@/src/state/types/vibe';
import type { Script, Vote, WrapPartyData, ConnectionStatus as ConnectionStatusType, Character, SessionStatus } from '@/src/state/types/session';

// PartyKit client instance
let partySocket: PartySocket | null = null;

// Connection state
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

let connectionStatus: ConnectionStatus = 'disconnected';
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isReconnecting = false;

// Message queue for offline messages
interface QueuedMessage {
  message: string;
  timestamp: number;
  retries: number;
}

const messageQueue: QueuedMessage[] = [];
const MAX_QUEUE_SIZE = 100;
const MAX_MESSAGE_RETRIES = 3;

// Heartbeat mechanism - ping every 30 seconds to detect stale connections
let heartbeatInterval: NodeJS.Timeout | null = null;
let lastPongTime: number = Date.now();
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - if no pong in this time, consider stale

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
 * Get image URL for a character from PartyKit HTTP endpoint
 * Images are served via HTTP to avoid WebSocket message size limits
 */
/** Relative PartyKit image path. Use when sending cast to server to avoid redirect loops. */
function getCharacterImageRelativeUrl(sessionId: string, characterId: string): string {
  return `/parties/main/${sessionId}/image/${characterId}`;
}

/** True if URL is a Cloudinary delivery URL. We keep these in cast and skip PartyKit storage. */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com');
}

export function getCharacterImageUrl(sessionId: string, characterId: string): string {
  const host = getPartyKitHost();
  if (!host) {
    return '';
  }
  return `${host}${getCharacterImageRelativeUrl(sessionId, characterId)}`;
}

/**
 * Convert a relative PartyKit image URL to a full URL
 * Handles URLs like /parties/main/{sessionId}/image/{characterId}
 * Returns the URL as-is if it's already a full URL (http/https) or data URL
 */
export function normalizeImageUrl(imageUrl: string | undefined, sessionId: string, characterId: string): string {
  if (!imageUrl || imageUrl.length === 0) {
    return getCharacterImageUrl(sessionId, characterId);
  }
  
  // If already a full URL (http/https) or data URL, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // If it's a relative PartyKit URL, convert to full URL
  if (imageUrl.startsWith('/parties/main/')) {
    const host = getPartyKitHost();
    if (host) {
      return `${host}${imageUrl}`;
    }
  }
  
  // Fallback: construct URL from sessionId and characterId
  return getCharacterImageUrl(sessionId, characterId);
}

/** Shape of GET /state response (used after minimal state:recovered) */
export interface SessionStateResponse {
  sessionId: string;
  vibeContext: VibeType;
  status: SessionStatus | 'expired';
  vibeLockedAt: number | null;
  participants: unknown[];
  cast: Character[];
  script: Script | null;
  wrapPartyData: WrapPartyData | null;
  expiresAt: number;
  isExpired: boolean;
  timeUntilExpiration: number;
}

/** Event log entry from server */
export interface EventLogEntry {
  id: string;
  timestamp: number;
  type: string;
  data: unknown;
  participantId?: string;
  characterId?: string;
}

/** Event log response from GET /events */
export interface EventLogResponse {
  events: EventLogEntry[];
}

/**
 * Fetch full session state via HTTP (GET /state).
 * Use after receiving minimal state:recovered over WebSocket to stay under message size limits.
 * Returns null on 404/410; throws on network error.
 */
export async function fetchSessionState(sessionId: string): Promise<SessionStateResponse | null> {
  const host = getPartyKitHost();
  if (!host) return null;
  const url = `${host}/parties/main/${sessionId}/state`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new TypeError('Network error');
  }
  if (!res.ok) return null;
  return (await res.json()) as SessionStateResponse;
}

/**
 * Fetch events since a timestamp via HTTP (GET /events?since={timestamp}).
 * Used for event replay on reconnection.
 * Returns empty array on error.
 */
export async function fetchEvents(sessionId: string, since: number): Promise<EventLogEntry[]> {
  const host = getPartyKitHost();
  if (!host) return [];
  const url = `${host}/parties/main/${sessionId}/events?since=${since}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[PartyKit] Failed to fetch events:', res.status, res.statusText);
      return [];
    }
    const data = (await res.json()) as EventLogResponse;
    return data.events || [];
  } catch (error) {
    console.error('[PartyKit] Error fetching events:', error);
    return [];
  }
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
    const error = new Error('Cannot initialize PartyKit client: host not available');
    console.error('[PartyKit] Initialization failed:', error.message);
    throw error;
  }

  // Close existing connection if different room (1000 = normal closure, skip reconnect)
  if (partySocket && partySocket.room !== room) {
    console.log('[PartyKit] Closing existing connection for different room', {
      oldRoom: partySocket.room,
      newRoom: room,
    });
    partySocket.close(1000, 'Switching room');
  }

  // Initialize connection
  connectionStatus = 'connecting';
  triggerEvent('connection:status', connectionStatus);
  
  // Log connection attempt for debugging
  console.log('[PartyKit] Initializing connection', {
    host,
    room,
    party: 'main',
    environment: process.env.NODE_ENV,
  });
  
  try {
    partySocket = new PartySocket({
      host,
      room,
      party: 'main', // Party name from partykit.json (main is the default)
    });
    console.log('[PartyKit] PartySocket created', {
      readyState: partySocket.readyState,
      room: partySocket.room,
    });
  } catch (error) {
    console.error('[PartyKit] Failed to create PartySocket:', error);
    connectionStatus = 'disconnected';
    triggerEvent('connection:status', connectionStatus);
    throw error;
  }

  // Set up event listeners
  partySocket.addEventListener('open', () => {
    console.log('[PartyKit] Connection opened successfully', {
      id: partySocket?.id,
      room: partySocket?.room,
      host: getPartyKitHost(),
      readyState: partySocket?.readyState,
    });
    const wasReconnecting = isReconnecting;
    connectionStatus = 'connected';
    reconnectAttempts = 0;
    isReconnecting = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Clean up old event listeners on reconnect to prevent duplicates
    if (wasReconnecting) {
      // Remove all message listeners to prevent duplicates
      // Note: We can't directly remove listeners, but we'll rely on component cleanup
      // and the fact that we're creating a new socket instance
      console.log('Reconnection detected, cleaning up old listeners');
    }
    
    // Trigger connect event
    triggerEvent('connect', {});
    
    // Trigger connection status change
    triggerEvent('connection:status', connectionStatus);
    
    // Start heartbeat
    lastPongTime = Date.now();
    startHeartbeat();
    
    // If this was a reconnection, replay queued messages and request state recovery
    if (wasReconnecting && partySocket) {
      console.log('[PartyKit] Reconnection detected, replaying queued messages', {
        queueSize: messageQueue.length,
        room: partySocket.room,
      });
      
      // Replay queued messages
      let replayedCount = 0;
      while (messageQueue.length > 0 && partySocket.readyState === WebSocket.OPEN) {
        const queued = messageQueue.shift();
        if (queued) {
          try {
            partySocket.send(queued.message);
            replayedCount++;
            // Log important message types
            try {
              const parsed = JSON.parse(queued.message);
              if (parsed.type === 'cast:update' || parsed.type === 'script:update') {
                console.log('[PartyKit] Replayed important message:', {
                  type: parsed.type,
                  sessionId: parsed.data?.sessionId,
                });
              }
            } catch {
              // Ignore parse errors
            }
          } catch (error) {
            console.error('[PartyKit] Failed to replay queued message:', error);
            // Re-queue if retries not exhausted
            if (queued.retries < MAX_MESSAGE_RETRIES) {
              queued.retries++;
              messageQueue.push(queued);
            }
          }
        }
      }
      
      console.log('[PartyKit] Replayed messages:', {
        count: replayedCount,
        remainingInQueue: messageQueue.length,
      });
      
      // Request state recovery after reconnection
      if (partySocket.room) {
        triggerEvent('reconnect', { sessionId: partySocket.room });
      }
    }
    
    // ALWAYS replay queued messages on open, not just on reconnection
    // This handles cases where connection was closed and messages were queued
    if (partySocket && partySocket.readyState === WebSocket.OPEN && messageQueue.length > 0) {
      console.log('[PartyKit] Connection opened with queued messages, replaying:', {
        queueSize: messageQueue.length,
        room: partySocket.room,
      });
      
      let replayedCount = 0;
      while (messageQueue.length > 0 && partySocket.readyState === WebSocket.OPEN) {
        const queued = messageQueue.shift();
        if (queued) {
          try {
            partySocket.send(queued.message);
            replayedCount++;
            // Log important message types
            try {
              const parsed = JSON.parse(queued.message);
              if (parsed.type === 'cast:update' || parsed.type === 'script:update') {
                console.log('[PartyKit] Replayed important message on open:', {
                  type: parsed.type,
                  sessionId: parsed.data?.sessionId,
                });
              }
            } catch {
              // Ignore parse errors
            }
          } catch (error) {
            console.error('[PartyKit] Failed to replay queued message on open:', error);
            // Re-queue if retries not exhausted
            if (queued.retries < MAX_MESSAGE_RETRIES) {
              queued.retries++;
              messageQueue.push(queued);
            }
          }
        }
      }
      
      console.log('[PartyKit] Replayed messages on open:', {
        count: replayedCount,
        remainingInQueue: messageQueue.length,
      });
    }
  });

  partySocket.addEventListener('close', (event: CloseEvent) => {
    console.log('[PartyKit] Connection closed', {
      code: event.code,
      reason: event.reason || 'No reason provided',
      wasClean: event.wasClean,
      host: getPartyKitHost(),
      room: partySocket?.room,
    });
    stopHeartbeat();
    if (event.code === 1000) {
      return;
    }
    connectionStatus = 'disconnected';
    triggerEvent('connection:status', connectionStatus);
    handleDisconnection(event.code);
  });

  partySocket.addEventListener('error', (error: Event) => {
    // Error events don't always have detailed information
    const host = getPartyKitHost();
    const room = partySocket?.room || 'unknown';
    const readyState = partySocket?.readyState ?? WebSocket.CLOSED;
    
    const errorInfo: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      host: host || 'not configured',
      room,
      readyState,
      readyStateText: readyState === WebSocket.CONNECTING ? 'CONNECTING' 
        : readyState === WebSocket.OPEN ? 'OPEN'
        : readyState === WebSocket.CLOSING ? 'CLOSING'
        : 'CLOSED',
    };
    
    if (error instanceof ErrorEvent) {
      errorInfo.message = error.message || 'Unknown error';
      errorInfo.filename = error.filename || 'unknown';
      errorInfo.lineno = error.lineno || 0;
      errorInfo.colno = error.colno || 0;
    } else {
      errorInfo.type = error.type || 'error';
      errorInfo.target = error.target ? String(error.target) : 'unknown';
      // Try to extract more info from the error object
      if (error instanceof Error) {
        errorInfo.message = error.message;
        errorInfo.name = error.name;
        errorInfo.stack = error.stack;
      }
    }
    
    // Log error with full context
    console.error('[PartyKit] Connection error:', {
      ...errorInfo,
      // Include error object itself for debugging
      errorObject: error,
    });
    
    // Provide helpful diagnostic message
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      console.warn(
        '[PartyKit] Connection failed. Make sure PartyKit dev server is running:\n' +
        '  Run: npm run dev:partykit\n' +
        '  Or: npm run dev:all (runs both Next.js and PartyKit)\n' +
        `  Expected host: ${host}\n` +
        `  Room: ${room}`
      );
    } else {
      console.warn(
        `[PartyKit] Connection failed to ${host}.\n` +
        '  Check that NEXT_PUBLIC_PARTYKIT_HOST is set correctly.\n' +
        '  Verify the PartyKit server is deployed and accessible.\n' +
        `  Room: ${room}`
      );
    }
    
    // Update connection status
    connectionStatus = 'disconnected';
    triggerEvent('connection:status', connectionStatus);
    
    handleConnectionError();
  });

  const startHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(() => {
      if (partySocket && partySocket.readyState === WebSocket.OPEN) {
        // Check if we've received a pong recently
        const timeSinceLastPong = Date.now() - lastPongTime;
        if (timeSinceLastPong > HEARTBEAT_TIMEOUT) {
          console.warn('No pong received in timeout period, connection may be stale');
          // Connection might be stale, but let PartyKit handle reconnection
          return;
        }
        
        // Send ping (PartyKit handles ping/pong automatically via WebSocket)
        // We just track that we're alive
        lastPongTime = Date.now();
      }
    }, HEARTBEAT_INTERVAL);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  partySocket.addEventListener('message', (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      
      // Update last pong time on any message (indicates connection is alive)
      lastPongTime = Date.now();
      
      // Log received messages for debugging
      if (type === 'character:assigned' || type === 'cast:updated') {
        console.log('PartyKit client received message:', { type, data });
      }
      
      // Handle connection status events
      if (type === 'connect' || type === 'open') {
        connectionStatus = 'connected';
        triggerEvent('connect', {});
        startHeartbeat();
      } else if (type === 'disconnect' || type === 'close') {
        connectionStatus = 'disconnected';
        triggerEvent('disconnect', {});
        stopHeartbeat();
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
 * Checks actual WebSocket state to ensure accuracy and consistency
 */
export function getConnectionStatus(): ConnectionStatus {
  // If we have a socket, check its actual state for accuracy
  if (partySocket) {
    if (partySocket.readyState === WebSocket.OPEN) {
      // WebSocket is open - we're definitely connected
      if (connectionStatus !== 'connected') {
        connectionStatus = 'connected';
      }
      return 'connected';
    } else if (partySocket.readyState === WebSocket.CONNECTING) {
      // WebSocket is connecting
      // Preserve 'reconnecting' status if that's what we were doing, otherwise use 'connecting'
      if (connectionStatus !== 'reconnecting' && connectionStatus !== 'connecting') {
        connectionStatus = 'connecting';
      }
      return connectionStatus === 'reconnecting' ? 'reconnecting' : 'connecting';
    } else {
      // CLOSED or CLOSING - we're disconnected
      // Only update cached status if we thought we were connected/connecting
      // Preserve 'reconnecting' state briefly (reconnection logic will handle transition)
      if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
        connectionStatus = 'disconnected';
      }
      return connectionStatus;
    }
  }
  // No socket means disconnected
  if (connectionStatus !== 'disconnected') {
    connectionStatus = 'disconnected';
  }
  return 'disconnected';
}

/**
 * Listen for connection status changes
 */
export function onConnectionStatus(
  callback: (status: ConnectionStatus) => void
): () => void {
  // Alias for onConnectionStatusChange for consistency
  return onConnectionStatusChange(callback);
}

export function onConnectionStatusChange(
  callback: (status: ConnectionStatus) => void
): () => void {
  if (!eventListeners.has('connection:status')) {
    eventListeners.set('connection:status', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as ConnectionStatus);
  };
  eventListeners.get('connection:status')!.add(wrappedCallback);

  // Return current status immediately
  callback(connectionStatus);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('connection:status');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
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
  triggerEvent('connection:status', connectionStatus);
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
 * Send message with queuing support
 * Queues message if disconnected, sends immediately if connected
 */
function sendMessageWithQueue(message: string): void {
  if (partySocket && partySocket.readyState === WebSocket.OPEN) {
    try {
      partySocket.send(message);
      // Log successful send for debugging
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'cast:update' || parsed.type === 'script:update') {
          console.log('[PartyKit] Message sent successfully:', {
            type: parsed.type,
            sessionId: parsed.data?.sessionId,
            readyState: partySocket.readyState,
          });
        }
      } catch {
        // Ignore parse errors for logging
      }
    } catch (error) {
      console.error('[PartyKit] Failed to send message, queuing:', error);
      queueMessage(message);
    }
  } else {
    console.warn('[PartyKit] Connection not open, queuing message:', {
      readyState: partySocket?.readyState,
      hasSocket: !!partySocket,
      messageType: (() => {
        try {
          const parsed = JSON.parse(message);
          return parsed.type;
        } catch {
          return 'unknown';
        }
      })(),
    });
    queueMessage(message);
  }
}

/**
 * Queue message for later sending
 */
function queueMessage(message: string): void {
  if (messageQueue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest message if queue is full
    messageQueue.shift();
  }
  
  messageQueue.push({
    message,
    timestamp: Date.now(),
    retries: 0,
  });
  
  console.log(`Message queued (queue size: ${messageQueue.length})`);
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
  options?: { role?: 'director' | 'actor'; vibeContext?: VibeType; name?: string }
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
    ...(options?.name && { name: options.name }),
  };

  if (partySocket.readyState === WebSocket.OPEN) {
    sendMessageWithQueue(JSON.stringify({
      type: 'session:join',
      data: joinData,
    }));
  } else {
    // Wait for connection
    partySocket.addEventListener('open', () => {
      sendMessageWithQueue(JSON.stringify({
        type: 'session:join',
        data: joinData,
      }));
    }, { once: true });
  }
}

const JOIN_WAIT_TIMEOUT_MS = 8000;

/**
 * Join a session room and wait for session:joined.
 * Used by directors so they are registered before sending director-only PartyKit messages.
 */
export function joinSessionAndWait(
  sessionId: string,
  participantId: string,
  options?: { role?: 'director' | 'actor'; vibeContext?: VibeType; name?: string }
): Promise<void> {
  initializePartyKitClient(sessionId);
  const socket = partySocket;

  if (!socket) {
    return Promise.reject(new Error('Failed to initialize PartyKit client'));
  }

  const joinData = {
    sessionId,
    participantId,
    ...(options?.role && { role: options.role }),
    ...(options?.vibeContext && { vibeContext: options.vibeContext }),
    ...(options?.name && { name: options.name }),
  };

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('joinSessionAndWait: timed out waiting for session:joined'));
    }, JOIN_WAIT_TIMEOUT_MS);

    const unsubscribe = onSessionJoined((data) => {
      if (data.sessionId !== sessionId) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      unsubscribe();
      resolve();
    });

    const sendJoin = () => {
      sendMessageWithQueue(JSON.stringify({
        type: 'session:join',
        data: joinData,
      }));
    };

    if (socket.readyState === WebSocket.OPEN) {
      sendJoin();
    } else {
      socket.addEventListener('open', () => sendJoin(), { once: true });
    }
  });
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
 * Emit script update
 */
export function updateScript(sessionId: string, script: Script): void {
  if (!partySocket) {
    console.warn('[PartyKit] Not initialized, cannot update script', {
      sessionId,
      scriptTitle: script.title,
    });
    return;
  }

  // Check connection state
  const isConnected = partySocket.readyState === WebSocket.OPEN;
  if (!isConnected) {
    console.warn('[PartyKit] Connection not open, queueing script update', {
      sessionId,
      scriptTitle: script.title,
      readyState: partySocket.readyState,
      room: partySocket.room,
    });
    // Will be queued by sendMessageWithQueue
  }

  console.log('[PartyKit] Sending script update:', {
    sessionId,
    scriptTitle: script.title,
    isConnected,
    readyState: partySocket.readyState,
    room: partySocket.room,
  });

  sendMessageWithQueue(JSON.stringify({
    type: 'script:update',
    data: {
      sessionId,
      script,
    },
  }));
}

/**
 * Listen for cast updates
 */
export function onCastUpdate(
  callback: (data: { sessionId: string; cast: Character[]; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('cast:updated')) {
    eventListeners.set('cast:updated', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; cast: Character[]; timestamp: number });
  };
  eventListeners.get('cast:updated')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('cast:updated');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/** PartyKit storage value limit (128 KiB). Larger data URLs cannot be stored. */
const PARTYKIT_IMAGE_STORAGE_LIMIT_BYTES = 128 * 1024;

/**
 * Store character image data URL via HTTP POST to PartyKit
 * This is the ONLY way to store images - WebSocket has 576-byte limit, images are 2MB+
 * Data URLs larger than 128 KiB exceed PartyKit storage limit and are skipped.
 */
async function storeCharacterImageViaHttp(
  sessionId: string,
  characterId: string,
  imageUrl: string
): Promise<void> {
  const host = getPartyKitHost();
  if (!host) {
    console.warn('[PartyKit] Cannot store image via HTTP - host not available');
    return;
  }

  if (imageUrl.length > PARTYKIT_IMAGE_STORAGE_LIMIT_BYTES) {
    console.warn('[PartyKit] Skipping image store (exceeds 128 KiB limit):', {
      sessionId,
      characterId,
      length: imageUrl.length,
      limit: PARTYKIT_IMAGE_STORAGE_LIMIT_BYTES,
    });
    return;
  }

  try {
    const response = await fetch(`${host}/parties/main/${sessionId}/image/${characterId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl, // Data URL or external HTTP URL
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PartyKit] Failed to store image via HTTP POST:', {
        sessionId,
        characterId,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Failed to store image: ${response.status} ${response.statusText}`);
    }

    console.log('[PartyKit] Image stored via HTTP POST:', {
      sessionId,
      characterId,
      imageUrlLength: imageUrl.length,
      imageUrlType: imageUrl.startsWith('data:') ? 'data-url' : imageUrl.startsWith('http') ? 'http-url' : 'unknown',
    });
  } catch (error) {
    console.error('[PartyKit] Error storing image via HTTP POST:', {
      sessionId,
      characterId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error; // Re-throw so caller knows it failed
  }
}

/**
 * Create a minimal character object for WebSocket transmission.
 * Includes name, archetypeLabel, personalityTraits, hiddenMotivation, and attributes so UI can display them.
 * Server merges with existing cast; we omit imagePrompt to save size.
 * CRITICAL: Include hiddenMotivation so actors can see it on join page.
 * CRITICAL: Include attributes so Character Dossier and cards show ratings (e.g. Confidence 95/100).
 */
function createMinimalCharacter(char: Character): Character {
  // CRITICAL: Ensure all character data fields are preserved
  // Use explicit checks to preserve empty strings (shouldn't happen but handle gracefully)
  return {
    id: char.id,
    sessionId: char.sessionId,
    participantId: char.participantId,
    isLocked: char.isLocked,
    name: char.name !== undefined ? char.name : '',
    archetypeLabel: char.archetypeLabel !== undefined ? char.archetypeLabel : '',
    personalityTraits: Array.isArray(char.personalityTraits) ? char.personalityTraits : [],
    hiddenMotivation: char.hiddenMotivation !== undefined ? char.hiddenMotivation : '', // Include so actors can see it on join page
    visualRepresentation: {
      imageUrl: char.visualRepresentation?.imageUrl || '',
      imagePrompt: '', // Omit to save size; server preserves from existing
    },
    dialogueLines: [],
    attributes: char.attributes,
  };
}

/**
 * Convert data URLs in cast to HTTP endpoint URLs to avoid WebSocket message size limits
 * This must happen on the client BEFORE sending to PartyKit
 * Also stores data URLs via HTTP POST (not WebSocket - images are 2MB+)
 * Creates minimal character objects to reduce message size
 */
function convertCastDataUrlsToHttp(sessionId: string, cast: Character[]): {
  castForWebSocket: Character[];
  imageStoragePromises: Promise<void>[];
} {
  const imageStoragePromises: Promise<void>[] = [];
  const castForWebSocket = cast.map((char) => {
    const imageUrl = char.visualRepresentation?.imageUrl;
    
    // Create minimal character (removes large fields)
    const minimalChar = createMinimalCharacter(char);
    
    // If it's a data URL or external HTTP URL, store via HTTP POST and convert to endpoint URL
    // Exception: Cloudinary URLs stay as-is; we use them directly (no PartyKit storage).
    if (imageUrl && (imageUrl.startsWith('data:') || (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')))) {
      // Never POST our own PartyKit image URL (causes redirect loop)
      const isOwn =
        imageUrl.startsWith('/parties/main/') ||
        (imageUrl.includes('/parties/main/') && imageUrl.includes('/image/'));
      if (isOwn) {
        return {
          ...minimalChar,
          visualRepresentation: {
            ...minimalChar.visualRepresentation,
            imageUrl: getCharacterImageRelativeUrl(sessionId, char.id),
          },
        };
      }
      // Keep Cloudinary URLs in cast; Director desk and Join page use them directly.
      if (isCloudinaryUrl(imageUrl)) {
        return {
          ...minimalChar,
          visualRepresentation: {
            ...minimalChar.visualRepresentation,
            imageUrl,
          },
        };
      }
      // Data URL or other HTTP URL: store via PartyKit, use endpoint URL in cast
      imageStoragePromises.push(
        storeCharacterImageViaHttp(sessionId, char.id, imageUrl).catch((error) => {
          console.error('[PartyKit] Failed to store image, will retry on cast update:', {
            sessionId,
            characterId: char.id,
            error: error instanceof Error ? error.message : String(error),
          });
        })
      );
      return {
        ...minimalChar,
        visualRepresentation: {
          ...minimalChar.visualRepresentation,
          imageUrl: getCharacterImageRelativeUrl(sessionId, char.id),
        },
      };
    }

    // Already endpoint URL or empty: always send relative URL so server never stores full URL
    return {
      ...minimalChar,
      visualRepresentation: {
        ...minimalChar.visualRepresentation,
        imageUrl:
          imageUrl && (imageUrl.startsWith('/parties/main/') || (imageUrl.includes('/parties/main/') && imageUrl.includes('/image/')))
            ? getCharacterImageRelativeUrl(sessionId, char.id)
            : minimalChar.visualRepresentation?.imageUrl || '',
      },
    };
  });

  return { castForWebSocket, imageStoragePromises };
}

/**
 * Emit cast update
 * CRITICAL: Converts data URLs to HTTP endpoint URLs before sending to avoid WebSocket size limits
 */
export function updateCast(sessionId: string, cast: Character[]): void {
  if (!partySocket) {
    console.warn('[PartyKit] Not initialized, cannot update cast', {
      sessionId,
      castLength: cast.length,
    });
    return;
  }

  // CRITICAL: Validate that characters have required data before sending
  // Log warnings for characters missing name, traits, or hiddenMotivation
  const charactersWithMissingData = cast.filter(
    (char) => !char.name || !char.archetypeLabel || !char.personalityTraits || !char.hiddenMotivation
  );
  if (charactersWithMissingData.length > 0) {
    console.warn('[PartyKit] Characters missing data before sending:', {
      sessionId,
      missingDataCount: charactersWithMissingData.length,
      charactersWithMissingData: charactersWithMissingData.map((char) => ({
        id: char.id,
        hasName: !!char.name,
        hasArchetype: !!char.archetypeLabel,
        hasTraits: Array.isArray(char.personalityTraits) && char.personalityTraits.length > 0,
        hasHiddenMotivation: !!char.hiddenMotivation,
        name: char.name,
        archetypeLabel: char.archetypeLabel,
      })),
    });
  }

  // CRITICAL: Convert data URLs to HTTP endpoint URLs BEFORE sending
  // This prevents WebSocket message size limit errors (576 bytes max)
  // Data URLs are 2MB+, but HTTP endpoint URLs are only ~50 bytes
  const { castForWebSocket, imageStoragePromises } = convertCastDataUrlsToHttp(sessionId, cast);

  // Store images via HTTP POST in the background (non-blocking)
  // This ensures images are stored even though we send endpoint URLs in the main cast update
  // Images are stored asynchronously - cast update can proceed even if some images fail
  Promise.allSettled(imageStoragePromises).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn('[PartyKit] Some images failed to store via HTTP POST:', {
        sessionId,
        failedCount: failed.length,
        totalCount: imageStoragePromises.length,
      });
    } else {
      console.log('[PartyKit] All images stored via HTTP POST:', {
        sessionId,
        totalCount: imageStoragePromises.length,
      });
    }
  });

  const charactersWithImages = cast.filter(
    (c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0
  );
  const charactersWithDataUrls = cast.filter(
    (c) => c.visualRepresentation?.imageUrl?.startsWith('data:')
  );
  const isConnected = partySocket.readyState === WebSocket.OPEN;

  // Calculate message size and split into chunks if too large
  const fullMessage = JSON.stringify({
    type: 'cast:update',
    data: {
      sessionId,
      cast: castForWebSocket,
    },
  });
  const messageSize = new Blob([fullMessage]).size;
  const maxMessageSize = 500; // Leave some buffer below 576 byte limit

  console.log('[PartyKit] updateCast:', {
    sessionId,
    castLength: cast.length,
    charactersWithImages: charactersWithImages.length,
    charactersWithDataUrls: charactersWithDataUrls.length,
    messageSizeBytes: messageSize,
    messageSizeKiB: (messageSize / 1024).toFixed(2),
    isConnected,
    readyState: partySocket.readyState,
    room: partySocket.room,
    imageUrlTypes: charactersWithImages.map((c) => ({
      characterId: c.id,
      characterName: c.name,
      imageUrlType: c.visualRepresentation?.imageUrl?.startsWith('data:')
        ? 'data-url'
        : c.visualRepresentation?.imageUrl?.startsWith('http')
          ? 'http-url'
          : 'none',
      imageUrlLength: c.visualRepresentation?.imageUrl?.length || 0,
      imageUrlPrefix: c.visualRepresentation?.imageUrl?.substring(0, 50) || 'N/A',
    })),
  });

  // If message is too large, split into smaller chunks
  if (messageSize > maxMessageSize) {
    console.warn('[PartyKit] Message too large, splitting into chunks:', {
      sessionId,
      messageSizeBytes: messageSize,
      maxMessageSize,
      castLength: castForWebSocket.length,
    });

    // Send cast in chunks of 1 character at a time
    for (let index = 0; index < castForWebSocket.length; index++) {
      const char = castForWebSocket[index];
      
      // CRITICAL: Log character data before chunking to debug missing fields
      if (!char.name || !char.archetypeLabel || !char.personalityTraits || !char.hiddenMotivation) {
        console.warn('[PartyKit] Character missing data before chunking:', {
          characterId: char.id,
          hasName: char.name !== undefined && char.name !== null && char.name.length > 0,
          hasArchetype: char.archetypeLabel !== undefined && char.archetypeLabel !== null && char.archetypeLabel.length > 0,
          hasTraits: Array.isArray(char.personalityTraits) && char.personalityTraits.length > 0,
          hasHiddenMotivation: char.hiddenMotivation !== undefined && char.hiddenMotivation !== null && char.hiddenMotivation.length > 0,
          nameValue: char.name,
          archetypeValue: char.archetypeLabel,
          traitsValue: char.personalityTraits,
          hiddenMotivationValue: char.hiddenMotivation,
        });
      }
      
      // Minimal message: id, p, l, i, n/a/t/h/attr so new characters have name, traits, hiddenMotivation, and attributes
      // CRITICAL: Include hiddenMotivation (h) so actors can see it on join page
      // CRITICAL: Include attributes (attr) so Character Dossier and cards show ratings (e.g. Confidence 95/100)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const minimalChar: any = {
        id: char.id,
        p: char.participantId,
        l: char.isLocked,
        i: char.visualRepresentation?.imageUrl || '',
        n: char.name !== undefined && char.name !== null ? char.name : undefined,
        a: char.archetypeLabel !== undefined && char.archetypeLabel !== null ? char.archetypeLabel : undefined,
        t: Array.isArray(char.personalityTraits) && char.personalityTraits.length > 0 ? char.personalityTraits : undefined,
        h: char.hiddenMotivation !== undefined && char.hiddenMotivation !== null && char.hiddenMotivation.length > 0 ? char.hiddenMotivation : undefined,
        attr: Array.isArray(char.attributes) && char.attributes.length > 0 ? char.attributes : undefined,
      };
      
      if (minimalChar.p === null || minimalChar.p === undefined) delete minimalChar.p;
      if (minimalChar.l === false) delete minimalChar.l;
      if (!minimalChar.i || minimalChar.i.length === 0) delete minimalChar.i;
      if (minimalChar.n === undefined || minimalChar.n === null) delete minimalChar.n;
      if (minimalChar.a === undefined || minimalChar.a === null) delete minimalChar.a;
      if (minimalChar.t === undefined || minimalChar.t === null || (Array.isArray(minimalChar.t) && minimalChar.t.length === 0)) delete minimalChar.t;
      if (minimalChar.h === undefined || minimalChar.h === null || minimalChar.h.length === 0) delete minimalChar.h;
      if (minimalChar.attr === undefined || minimalChar.attr === null || (Array.isArray(minimalChar.attr) && minimalChar.attr.length === 0)) delete minimalChar.attr;
      
      const chunkMessage = JSON.stringify({
        type: 'cast:update',
        data: {
          sessionId,
          cast: [minimalChar], // Send one character at a time with minimal fields
        },
      });
      const chunkSize = new Blob([chunkMessage]).size;
      
      let messageToSend = chunkMessage;
      
      if (chunkSize > maxMessageSize) {
        console.error('[PartyKit] Single character still too large even with minimal fields, creating ultra-minimal version:', {
          sessionId,
          characterId: char.id,
          chunkSizeBytes: chunkSize,
          characterFields: Object.keys(minimalChar),
        });
        
        // STRATEGY: Split large character data into multiple messages
        // Phase 1: Send essential data (id, name, archetype, traits, image URL) - image URL is already small relative URL
        // Phase 2: Send hiddenMotivation separately if it's too large
        
        // Image URL from char is already converted to small relative URL (~50 bytes) by convertCastDataUrlsToHttp
        // char comes from castForWebSocket which has already been processed
        // Cloudinary URLs are also kept (they're external, not stored in PartyKit)
        const imageUrlForMessage = char.visualRepresentation?.imageUrl || '';
        const isImageUrlSmall = !imageUrlForMessage || 
          imageUrlForMessage.startsWith('/parties/main/') || 
          imageUrlForMessage.includes('/image/') ||
          isCloudinaryUrl(imageUrlForMessage) ||
          imageUrlForMessage.length < 100;
        
        // Phase 1: Essential character data (without hiddenMotivation), include attributes (attr)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const essentialChar: any = {
          id: char.id,
          p: char.participantId || undefined,
          l: char.isLocked || undefined,
          n: char.name !== undefined && char.name !== null ? char.name : undefined,
          a: char.archetypeLabel !== undefined && char.archetypeLabel !== null ? char.archetypeLabel : undefined,
          t: Array.isArray(char.personalityTraits) && char.personalityTraits.length > 0 ? char.personalityTraits : undefined,
          i: isImageUrlSmall && imageUrlForMessage ? imageUrlForMessage : undefined,
          attr: Array.isArray(char.attributes) && char.attributes.length > 0 ? char.attributes : undefined,
        };
        
        if (essentialChar.p === null || essentialChar.p === undefined) delete essentialChar.p;
        if (essentialChar.l === false) delete essentialChar.l;
        if (essentialChar.n === undefined || essentialChar.n === null) delete essentialChar.n;
        if (essentialChar.a === undefined || essentialChar.a === null) delete essentialChar.a;
        if (essentialChar.t === undefined || essentialChar.t === null || (Array.isArray(essentialChar.t) && essentialChar.t.length === 0)) delete essentialChar.t;
        if (essentialChar.i === undefined || essentialChar.i === null || essentialChar.i.length === 0) delete essentialChar.i;
        if (essentialChar.attr === undefined || essentialChar.attr === null || (Array.isArray(essentialChar.attr) && essentialChar.attr.length === 0)) delete essentialChar.attr;
        
        const essentialMessage = JSON.stringify({
          type: 'cast:update',
          data: {
            sessionId,
            cast: [essentialChar],
          },
        });
        const essentialSize = new Blob([essentialMessage]).size;
        
        // If essential data fits, send it first, then send hiddenMotivation separately if needed
        if (essentialSize <= maxMessageSize) {
          // Send essential data first
          setTimeout(() => {
            sendMessageWithQueue(essentialMessage);
          }, index * 10);
          
          // Send hiddenMotivation separately if it exists and is large
          if (char.hiddenMotivation && char.hiddenMotivation.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hiddenMotivationChar: any = {
              id: char.id,
              h: char.hiddenMotivation,
            };
            
            const hiddenMotivationMessage = JSON.stringify({
              type: 'cast:update',
              data: {
                sessionId,
                cast: [hiddenMotivationChar],
              },
            });
            const hiddenMotivationSize = new Blob([hiddenMotivationMessage]).size;
            
            // If hiddenMotivation message is too large, truncate it
            if (hiddenMotivationSize > maxMessageSize) {
              const maxLength = Math.max(100, maxMessageSize - 200); // Leave room for message overhead
              hiddenMotivationChar.h = char.hiddenMotivation.substring(0, maxLength) + '...';
              console.warn('[PartyKit] Truncated hiddenMotivation to fit size limit:', {
                sessionId,
                characterId: char.id,
                originalLength: char.hiddenMotivation.length,
                truncatedLength: hiddenMotivationChar.h.length,
              });
            }
            
            // Send hiddenMotivation message with a small delay after essential data
            setTimeout(() => {
              sendMessageWithQueue(JSON.stringify({
                type: 'cast:update',
                data: {
                  sessionId,
                  cast: [hiddenMotivationChar],
                },
              }));
              if (process.env.NODE_ENV === 'development') {
                console.log('[PartyKit] Sent hiddenMotivation follow-up (split strategy):', {
                  sessionId,
                  characterId: char.id,
                  length: hiddenMotivationChar.h.length,
                });
              }
            }, index * 10 + 50); // 50ms after essential data
          }
          
          // Skip the original chunk send since we're sending split messages
          continue;
        }
        
        // If essential data alone is too large, fall back to truncation strategy
        // This should rarely happen, but handle it gracefully
        console.error('[PartyKit] Essential character data exceeds size limit, using truncation fallback:', {
          sessionId,
          characterId: char.id,
          essentialSizeBytes: essentialSize,
          maxMessageSize,
        });
        
        // Truncate name, archetype, and traits if needed
        if (essentialChar.n && essentialChar.n.length > 50) essentialChar.n = essentialChar.n.substring(0, 50) + '...';
        if (essentialChar.a && essentialChar.a.length > 50) essentialChar.a = essentialChar.a.substring(0, 50) + '...';
        if (Array.isArray(essentialChar.t) && essentialChar.t.length > 3) {
          essentialChar.t = essentialChar.t.slice(0, 3);
        }
        
        const fallbackMessage = JSON.stringify({
          type: 'cast:update',
          data: {
            sessionId,
            cast: [essentialChar],
          },
        });
        const fallbackSize = new Blob([fallbackMessage]).size;
        
        if (fallbackSize > maxMessageSize) {
          console.error('[PartyKit] CRITICAL: Even truncated essential data exceeds size limit:', {
            sessionId,
            characterId: char.id,
            fallbackSizeBytes: fallbackSize,
            maxMessageSize,
          });
          // Still send it - better to try than lose data completely
        }
        
        messageToSend = fallbackMessage;
        
        // CRITICAL: Truncation fallback omits h from essentialChar; send hiddenMotivation in follow-up
        if (char.hiddenMotivation && char.hiddenMotivation.length > 0) {
          const hiddenMotivationChar: { id: string; h: string } = {
            id: char.id,
            h: char.hiddenMotivation,
          };
          const hmMessage = JSON.stringify({
            type: 'cast:update',
            data: { sessionId, cast: [hiddenMotivationChar] },
          });
          if (new Blob([hmMessage]).size > maxMessageSize) {
            const maxLength = Math.max(100, maxMessageSize - 200);
            hiddenMotivationChar.h = char.hiddenMotivation.substring(0, maxLength) + '...';
          }
          setTimeout(() => {
            sendMessageWithQueue(JSON.stringify({
              type: 'cast:update',
              data: { sessionId, cast: [hiddenMotivationChar] },
            }));
            if (process.env.NODE_ENV === 'development') {
              console.log('[PartyKit] Sent hiddenMotivation follow-up (truncation fallback):', {
                sessionId,
                characterId: char.id,
                length: hiddenMotivationChar.h.length,
              });
            }
          }, index * 10 + 50);
        }
      }
      
      // Send with a small delay to avoid overwhelming the connection
      setTimeout(() => {
        sendMessageWithQueue(messageToSend);
      }, index * 10); // 10ms delay between chunks
    }
  } else {
    // Message is small enough, send normally
    if (!isConnected) {
      console.warn('[PartyKit] Connection not open, queueing cast update', {
        sessionId,
        castLength: cast.length,
        readyState: partySocket.readyState,
        room: partySocket.room,
      });
    }

    sendMessageWithQueue(fullMessage);
  }
}

/**
 * Listen for session state updates
 */
export function onSessionStateUpdate(
  callback: (data: {
    sessionId: string;
    status: SessionStatus;
    timestamp: number;
    vibeContext?: VibeType;
    vibeLockedAt?: number | null;
  }) => void
): () => void {
  if (!eventListeners.has('session:state:updated')) {
    eventListeners.set('session:state:updated', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(
      data as {
        sessionId: string;
        status: SessionStatus;
        timestamp: number;
        vibeContext?: VibeType;
        vibeLockedAt?: number | null;
      }
    );
  };
  eventListeners.get('session:state:updated')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('session:state:updated');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Emit session state update
 */
export function updateSessionState(sessionId: string, status: SessionStatus): void {
  if (!partySocket) {
    console.warn('PartyKit not initialized, cannot update session state');
    return;
  }

  sendMessageWithQueue(JSON.stringify({
    type: 'session:state:update',
    data: {
      sessionId,
      status,
    },
  }));
}

/**
 * Listen for generation progress (Director → Join page).
 * Optional: only present while skit is generating.
 */
export function onGenerationProgress(
  callback: (data: {
    sessionId: string;
    phase: string;
    message: string;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('generation:progress')) {
    eventListeners.set('generation:progress', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      phase: string;
      message: string;
      timestamp: number;
    });
  };
  eventListeners.get('generation:progress')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('generation:progress');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Emit generation progress (Director form → PartyKit → broadcast to room).
 */
export function emitGenerationProgress(
  sessionId: string,
  phase: 'characters' | 'script' | 'images',
  message: string
): void {
  if (!partySocket) {
    return;
  }

  sendMessageWithQueue(
    JSON.stringify({
      type: 'generation:progress',
      data: { sessionId, phase, message },
    })
  );
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
 * Listen for reconnection event
 */
export function onReconnect(
  callback: (data: { sessionId: string }) => void
): () => void {
  if (!eventListeners.has('reconnect')) {
    eventListeners.set('reconnect', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string });
  };
  eventListeners.get('reconnect')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('reconnect');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for session joined event
 */
export function onSessionJoined(
  callback: (data: {
    sessionId: string;
    participantId: string;
    role: 'director' | 'actor';
    name?: string;
    participants: Array<{
      participantId: string;
      connectionId: string;
      role: 'director' | 'actor';
      connectionStatus: ConnectionStatusType;
      joinedAt: number;
      lastSeen: number;
      name: string;
    }>;
    vibeContext: VibeType;
  }) => void
): () => void {
  if (!eventListeners.has('session:joined')) {
    eventListeners.set('session:joined', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      participantId: string;
      role: 'director' | 'actor';
      name?: string;
      participants: Array<{
        participantId: string;
        connectionId: string;
        role: 'director' | 'actor';
        connectionStatus: ConnectionStatusType;
        joinedAt: number;
        lastSeen: number;
        name: string;
      }>;
      vibeContext: VibeType;
    });
  };
  eventListeners.get('session:joined')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('session:joined');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for participant joined event
 */
export function onParticipantJoined(
  callback: (data: {
    participantId: string;
    connectionId: string;
    role: 'director' | 'actor';
    name?: string;
    participants: Array<{
      participantId: string;
      connectionId: string;
      role: 'director' | 'actor';
      connectionStatus: ConnectionStatusType;
      joinedAt: number;
      lastSeen: number;
      name: string;
    }>;
  }) => void
): () => void {
  if (!eventListeners.has('participant:joined')) {
    eventListeners.set('participant:joined', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      participantId: string;
      connectionId: string;
      role: 'director' | 'actor';
      name?: string;
      participants: Array<{
        participantId: string;
        connectionId: string;
        role: 'director' | 'actor';
        connectionStatus: ConnectionStatusType;
        joinedAt: number;
        lastSeen: number;
        name: string;
      }>;
    });
  };
  eventListeners.get('participant:joined')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('participant:joined');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for participant left event
 */
export function onParticipantLeft(
  callback: (data: {
    connectionId: string;
    participantId?: string;
    participants: Array<{
      participantId: string;
      connectionId: string;
      role: 'director' | 'actor';
      connectionStatus: ConnectionStatusType;
      joinedAt: number;
      lastSeen: number;
      name: string;
    }>;
  }) => void
): () => void {
  if (!eventListeners.has('participant:left')) {
    eventListeners.set('participant:left', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      connectionId: string;
      participantId?: string;
      participants: Array<{
        participantId: string;
        connectionId: string;
        role: 'director' | 'actor';
        connectionStatus: ConnectionStatusType;
        joinedAt: number;
        lastSeen: number;
        name: string;
      }>;
    });
  };
  eventListeners.get('participant:left')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('participant:left');
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
 * End performance (Director only)
 * Transitions session to 'completed' state and moves all participants to wrap party
 */
export function endPerformance(sessionId: string): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot end performance');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'performance:end',
    data: { sessionId },
  }));
}

/**
 * End session (Director only). Sets status to expired and broadcasts to all
 * participants so they cleanup and redirect (e.g. to vibe-selection).
 */
export function endSession(sessionId: string): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot end session');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'session:end',
    data: { sessionId },
  }));
}

/**
 * Reject assignment request or unassign character (Director only)
 */
export function rejectAssignment(sessionId: string, participantId: string, characterId: string): void {
  if (!partySocket || partySocket.readyState !== WebSocket.OPEN) {
    console.warn('PartyKit not connected, cannot reject assignment');
    return;
  }

  partySocket.send(JSON.stringify({
    type: 'assignment:reject',
    data: { sessionId, participantId, characterId },
  }));
}

/**
 * Listen for character override event
 */
export function onCharacterOverridden(
  callback: (data: {
    sessionId: string;
    characterId: string;
    participantId: string | null;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('character:overridden')) {
    eventListeners.set('character:overridden', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      characterId: string;
      participantId: string | null;
      timestamp: number;
    });
  };
  eventListeners.get('character:overridden')!.add(wrappedCallback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get('character:overridden');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for character assignment events
 */
export function onCharacterAssigned(
  callback: (data: {
    sessionId: string;
    characterId: string;
    participantId: string;
    isLocked: boolean;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('character:assigned')) {
    eventListeners.set('character:assigned', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      characterId: string;
      participantId: string;
      isLocked: boolean;
      timestamp: number;
    });
  };
  eventListeners.get('character:assigned')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('character:assigned');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for assignment request events
 */
export function onAssignmentRequested(
  callback: (data: {
    sessionId: string;
    participantId: string;
    characterId: string;
    requestedAt: number;
  }) => void
): () => void {
  if (!eventListeners.has('assignment:requested')) {
    eventListeners.set('assignment:requested', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      participantId: string;
      characterId: string;
      requestedAt: number;
    });
  };
  eventListeners.get('assignment:requested')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('assignment:requested');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for assignment approval events
 */
export function onAssignmentApproved(
  callback: (data: {
    sessionId: string;
    participantId: string;
    characterId: string;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('assignment:approved')) {
    eventListeners.set('assignment:approved', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      participantId: string;
      characterId: string;
      timestamp: number;
    });
  };
  eventListeners.get('assignment:approved')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('assignment:approved');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for assignment rejection events
 */
export function onAssignmentRejected(
  callback: (data: {
    sessionId: string;
    participantId: string;
    characterId: string;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('assignment:rejected')) {
    eventListeners.set('assignment:rejected', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      participantId: string;
      characterId: string;
      timestamp: number;
    });
  };
  eventListeners.get('assignment:rejected')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('assignment:rejected');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for assignment suggestion events
 */
export function onAssignmentSuggested(
  callback: (data: {
    sessionId: string;
    participantId: string;
    suggestedCharacterId: string;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('assignment:suggested')) {
    eventListeners.set('assignment:suggested', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      participantId: string;
      suggestedCharacterId: string;
      timestamp: number;
    });
  };
  eventListeners.get('assignment:suggested')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('assignment:suggested');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
}

/**
 * Listen for assignment confirmation events
 */
export function onAssignmentConfirmed(
  callback: (data: {
    sessionId: string;
    participantId: string;
    characterId: string;
    timestamp: number;
  }) => void
): () => void {
  if (!eventListeners.has('assignment:confirmed')) {
    eventListeners.set('assignment:confirmed', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as {
      sessionId: string;
      participantId: string;
      characterId: string;
      timestamp: number;
    });
  };
  eventListeners.get('assignment:confirmed')!.add(wrappedCallback);

  return () => {
    const listeners = eventListeners.get('assignment:confirmed');
    if (listeners) {
      listeners.delete(wrappedCallback);
    }
  };
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
}

/**
 * Event replay utilities for idempotent event processing
 */

const PROCESSED_EVENTS_KEY = 'skitso:processedEvents';
const MAX_PROCESSED_EVENTS = 1000;

/**
 * Get processed event IDs from localStorage
 */
function getProcessedEvents(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(PROCESSED_EVENTS_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      return new Set(ids);
    }
  } catch (error) {
    console.warn('[PartyKit] Failed to read processed events:', error);
  }
  return new Set();
}

/**
 * Save processed event IDs to localStorage
 */
function saveProcessedEvents(processed: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = Array.from(processed);
    localStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.warn('[PartyKit] Failed to save processed events:', error);
  }
}

/**
 * Mark an event as processed
 */
export function markEventProcessed(eventId: string): void {
  const processed = getProcessedEvents();
  processed.add(eventId);

  // Clean up old events (keep last MAX_PROCESSED_EVENTS)
  if (processed.size > MAX_PROCESSED_EVENTS) {
    const sorted = Array.from(processed).sort();
    const toKeep = sorted.slice(-MAX_PROCESSED_EVENTS);
    processed.clear();
    toKeep.forEach((id) => processed.add(id));
  }

  saveProcessedEvents(processed);
}

/**
 * Check if an event was already processed
 */
export function isEventProcessed(eventId: string): boolean {
  return getProcessedEvents().has(eventId);
}

/**
 * Check if event type is a full-state event (naturally idempotent)
 */
function isFullStateEvent(eventType: string): boolean {
  return (
    eventType === 'participant:joined' ||
    eventType === 'participant:left' ||
    eventType === 'cast:updated'
  );
}

/**
 * Check if incremental event should be applied based on current state
 */
function shouldApplyIncrementalEvent(
  event: EventLogEntry,
  currentState: {
    participants: unknown[];
    cast: Character[];
    assignmentRequests?: Map<string, unknown>;
  }
): boolean {
  switch (event.type) {
    case 'assignment:requested': {
      // Check if request already exists
      if (currentState.assignmentRequests) {
        const request = currentState.assignmentRequests.get(event.participantId || '');
        if (request) {
          // Request exists, check if it's for the same character
          const requestData = request as { characterId?: string };
          return requestData.characterId !== event.characterId;
        }
      }
      return true; // No existing request, apply
    }

    case 'assignment:approved':
    case 'character:assigned': {
      // Check if cast already shows this assignment
      const character = currentState.cast.find((c) => c.id === event.characterId);
      return character?.participantId !== event.participantId;
    }

    case 'assignment:confirmed': {
      // Check if character is already locked
      const char = currentState.cast.find((c) => c.id === event.characterId);
      return !char?.isLocked || char.participantId !== event.participantId;
    }

    case 'assignment:rejected': {
      // Check if character is still assigned to this participant
      const char = currentState.cast.find((c) => c.id === event.characterId);
      return char?.participantId === event.participantId;
    }

    default:
      return true; // Unknown events, apply to be safe
  }
}

/**
 * Replay events with idempotency checks
 * Returns the number of events actually applied
 */
export async function replayEvents(
  events: EventLogEntry[],
  currentState: {
    participants: unknown[];
    cast: Character[];
    assignmentRequests?: Map<string, unknown>;
  },
  onEvent: (event: EventLogEntry) => void
): Promise<number> {
  // Sort events by timestamp to ensure correct order
  const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);

  let appliedCount = 0;

  for (const event of sortedEvents) {
    // Skip if already processed
    if (isEventProcessed(event.id)) {
      continue;
    }

    // For full-state events, always apply (idempotent)
    if (isFullStateEvent(event.type)) {
      onEvent(event);
      markEventProcessed(event.id);
      appliedCount++;
      continue;
    }

    // For incremental events, check state first
    if (shouldApplyIncrementalEvent(event, currentState)) {
      onEvent(event);
      markEventProcessed(event.id);
      appliedCount++;
    } else {
      // Event already reflected in state, mark as processed
      markEventProcessed(event.id);
    }
  }

  return appliedCount;
}

/**
 * Get last event timestamp from localStorage
 */
export function getLastEventTimestamp(sessionId: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const key = `skitso:lastEventTimestamp:${sessionId}`;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Save last event timestamp to localStorage
 */
export function setLastEventTimestamp(sessionId: string, timestamp: number): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `skitso:lastEventTimestamp:${sessionId}`;
    localStorage.setItem(key, timestamp.toString());
  } catch (error) {
    console.warn('[PartyKit] Failed to save last event timestamp:', error);
  }
}
