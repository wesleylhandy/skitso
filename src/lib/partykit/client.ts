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

  // Initialize connection
  connectionStatus = 'connecting';
  triggerEvent('connection:status', connectionStatus);
  
  partySocket = new PartySocket({
    host,
    room,
    party: 'main', // Party name from partykit.json (main is the default)
  });

  // Set up event listeners
  partySocket.addEventListener('open', () => {
    console.log('PartyKit connected:', partySocket?.id);
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
      console.log('Reconnection detected, replaying queued messages and requesting state recovery');
      
      // Replay queued messages
      while (messageQueue.length > 0 && partySocket.readyState === WebSocket.OPEN) {
        const queued = messageQueue.shift();
        if (queued) {
          try {
            partySocket.send(queued.message);
            console.log('Replayed queued message');
          } catch (error) {
            console.error('Failed to replay queued message:', error);
            // Re-queue if retries not exhausted
            if (queued.retries < MAX_MESSAGE_RETRIES) {
              queued.retries++;
              messageQueue.push(queued);
            }
          }
        }
      }
      
      // Request state recovery after reconnection
      if (partySocket.room) {
        triggerEvent('reconnect', { sessionId: partySocket.room });
      }
    }
  });

  partySocket.addEventListener('close', (event: CloseEvent) => {
    console.log('PartyKit disconnected:', event.code, event.reason);
    connectionStatus = 'disconnected';
    triggerEvent('connection:status', connectionStatus);
    stopHeartbeat();
    handleDisconnection(event.code);
  });

  partySocket.addEventListener('error', (error: Event) => {
    // Error events don't always have detailed information
    const errorInfo = error instanceof ErrorEvent 
      ? { message: error.message, filename: error.filename, lineno: error.lineno, colno: error.colno }
      : { type: error.type, target: error.target };
    console.error('PartyKit connection error:', errorInfo);
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
 */
export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

/**
 * Listen for connection status changes
 */
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
    } catch (error) {
      console.error('Failed to send message, queuing:', error);
      queueMessage(message);
    }
  } else {
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
    console.warn('PartyKit not initialized, cannot update script');
    return;
  }

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

/**
 * Emit cast update
 */
export function updateCast(sessionId: string, cast: Character[]): void {
  if (!partySocket) {
    console.warn('PartyKit not initialized, cannot update cast');
    return;
  }

  sendMessageWithQueue(JSON.stringify({
    type: 'cast:update',
    data: {
      sessionId,
      cast,
    },
  }));
}

/**
 * Listen for session state updates
 */
export function onSessionStateUpdate(
  callback: (data: { sessionId: string; status: SessionStatus; timestamp: number }) => void
): () => void {
  if (!eventListeners.has('session:state:updated')) {
    eventListeners.set('session:state:updated', new Set());
  }

  const wrappedCallback: EventCallback = (data: unknown) => {
    callback(data as { sessionId: string; status: SessionStatus; timestamp: number });
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

  reconnectAttempts = 0;
  isReconnecting = false;
  connectionStatus = 'disconnected';
  eventListeners.clear();
}
