/**
 * Socket.io Server Initialization
 * 
 * Initializes Socket.io server for real-time synchronization.
 * Handles session room management and event broadcasting.
 */

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Socket } from 'socket.io';
import type { VibeType } from '@/src/state/types/vibe';
import type { Script, Vote, WrapPartyData } from '@/src/state/types/session';
import {
  getOrCreateSocketSession,
  addParticipantToSession,
  removeParticipantFromSession,
  updateSessionVibeContext,
  getSessionParticipants,
  getSocketSession,
  updateSessionStatus,
} from './session-store';

// Socket.io server instance (initialized by API route)
let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io server with HTTP server
 */
export function initializeSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Handle connection events
  io.on('connection', (socket: Socket) => {
    handleConnection(socket);
  });

  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Handle new socket connection
 */
function handleConnection(socket: Socket): void {
  console.log(`Socket connected: ${socket.id}`);

  // Handle session join
  socket.on('session:join', (data: { sessionId: string; participantId: string }) => {
    handleSessionJoin(socket, data);
  });

  // Handle session leave
  socket.on('session:leave', (data: { sessionId: string }) => {
    handleSessionLeave(socket, data);
  });

  // Handle disconnect
  socket.on('disconnect', (reason: string) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    // Update connection status for all sessions this socket was in
    // This is handled by the session store cleanup
  });

  // Handle state recovery request
  socket.on('state:recover', (data: { sessionId?: string; timestamp: number }) => {
    if (data.sessionId) {
      const socketSession = getSocketSession(data.sessionId);
      if (socketSession) {
        const participants = getSessionParticipants(data.sessionId);
        socket.emit('state:recovered', {
          sessionId: data.sessionId,
          vibeContext: socketSession.vibeContext,
          status: socketSession.status,
          participants,
        });
      }
    }
  });

  // Handle VibeContext change from client
  socket.on('vibe:change', (data: { sessionId: string; vibeContext: VibeType }) => {
    const { sessionId, vibeContext } = data;
    updateSessionVibeContext(sessionId, vibeContext);
    broadcastVibeContextChange(sessionId, vibeContext);
  });

  // Handle script update from client
  socket.on('script:update', (data: { sessionId: string; script: Script }) => {
    const { sessionId, script } = data;
    broadcastScriptUpdate(sessionId, script);
  });

  // Handle performance progress update from client
  socket.on('performance:advance', (data: {
    sessionId: string;
    progress: {
      currentLineIndex: number;
      currentScene: number;
      startedAt: number | null;
      pausedAt: number | null;
      completedLines: number[];
    };
  }) => {
    const { sessionId, progress } = data;
    broadcastPerformanceProgress(sessionId, progress);
  });

  // Handle wrap party vote from client
  socket.on('wrap-party:vote', (data: {
    sessionId: string;
    vote: Vote;
  }) => {
    const { sessionId, vote } = data;
    broadcastVote(sessionId, vote);
  });

  // Handle wrap party data update from client
  socket.on('wrap-party:update', (data: {
    sessionId: string;
    wrapPartyData: WrapPartyData;
  }) => {
    const { sessionId, wrapPartyData } = data;
    broadcastWrapPartyData(sessionId, wrapPartyData);
  });

  // Handle performance start from Director
  socket.on('performance:start', (data: { sessionId: string }) => {
    handlePerformanceStart(socket, data);
  });

  // Handle character override from Director
  socket.on('character:override', (data: {
    sessionId: string;
    characterId: string;
    participantId: string | null;
  }) => {
    // Character override is handled client-side via cast atom
    // Just broadcast to all participants
    const { sessionId } = data;
    socket.to(sessionId).emit('character:overridden', {
      ...data,
      timestamp: Date.now(),
    });
  });
}

/**
 * Handle session room join
 */
function handleSessionJoin(
  socket: Socket,
  data: { sessionId: string; participantId: string; role?: 'director' | 'actor'; vibeContext?: VibeType }
): void {
  const { sessionId, participantId, role = 'actor', vibeContext } = data;

  if (!sessionId || !participantId) {
    socket.emit('error', { message: 'Invalid session join data' });
    return;
  }

  // Get or create socket session
  const sessionVibeContext = vibeContext || 'VIRAL_NEON'; // Default if not provided
  const socketSession = getOrCreateSocketSession(sessionId, sessionVibeContext);

  // Add participant to session store
  addParticipantToSession(sessionId, participantId, socket.id, role);

  // Join session room
  socket.join(sessionId);
  console.log(`Socket ${socket.id} joined session ${sessionId} as participant ${participantId} (${role})`);

  // Get all participants in session
  const participants = getSessionParticipants(sessionId);

  // Notify others in the room
  socket.to(sessionId).emit('participant:joined', {
    participantId,
    socketId: socket.id,
    role,
    participants,
  });

  // Confirm join to the client with current session state
  socket.emit('session:joined', {
    sessionId,
    participantId,
    role,
    participants,
    vibeContext: socketSession.vibeContext,
  });
}

/**
 * Handle performance start
 */
function handlePerformanceStart(socket: Socket, data: { sessionId: string }): void {
  const { sessionId } = data;

  if (!sessionId) {
    socket.emit('error', { message: 'Invalid performance start data' });
    return;
  }

  // Get session and verify Director is starting
  const socketSession = getSocketSession(sessionId);
  if (!socketSession) {
    socket.emit('error', { message: 'Session not found' });
    return;
  }

  // Find the participant who sent this (should be Director)
  const participants = getSessionParticipants(sessionId);
  const director = participants.find((p) => p.socketId === socket.id && p.role === 'director');
  
  if (!director) {
    socket.emit('error', { message: 'Only Director can start performance' });
    return;
  }

  // Verify minimum participants (at least 2)
  if (participants.length < 2) {
    socket.emit('error', { message: 'At least 2 participants required to start performance' });
    return;
  }

  // Update session status to performing
  updateSessionStatus(sessionId, 'performing');

  // Broadcast performance start to all participants
  broadcastPerformanceStart(sessionId);
}

/**
 * Handle session room leave
 */
function handleSessionLeave(socket: Socket, data: { sessionId: string; participantId?: string }): void {
  const { sessionId, participantId } = data;

  if (!sessionId) {
    return;
  }

  // Remove participant from session store if participantId provided
  if (participantId) {
    removeParticipantFromSession(sessionId, participantId);
  }

  socket.leave(sessionId);
  console.log(`Socket ${socket.id} left session ${sessionId}`);

  // Get updated participants list
  const participants = getSessionParticipants(sessionId);

  // Notify others in the room
  socket.to(sessionId).emit('participant:left', {
    socketId: socket.id,
    participantId,
    participants,
  });
}

/**
 * Broadcast VibeContext change to session room
 */
export function broadcastVibeContextChange(sessionId: string, vibeContext: VibeType): void {
  if (!io) {
    console.error('Socket.io server not initialized');
    return;
  }

  io.to(sessionId).emit('vibe:changed', {
    sessionId,
    vibeContext,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast script update to session room
 */
export function broadcastScriptUpdate(sessionId: string, script: Script): void {
  if (!io) {
    console.error('Socket.io server not initialized');
    return;
  }

  io.to(sessionId).emit('script:updated', {
    sessionId,
    script,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast performance progress update to session room
 */
export function broadcastPerformanceProgress(
  sessionId: string,
  progress: {
    currentLineIndex: number;
    currentScene: number;
    startedAt: number | null;
    pausedAt: number | null;
    completedLines: number[];
  }
): void {
  if (!io) {
    console.error('Socket.io server not initialized');
    return;
  }

  io.to(sessionId).emit('performance:progress', {
    sessionId,
    progress,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast vote to session room
 */
export function broadcastVote(sessionId: string, vote: Vote): void {
  if (!io) {
    console.error('Socket.io server not initialized');
    return;
  }

  io.to(sessionId).emit('wrap-party:vote', {
    sessionId,
    vote,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast wrap party data update to session room
 */
export function broadcastWrapPartyData(sessionId: string, wrapPartyData: WrapPartyData): void {
  if (!io) {
    console.error('Socket.io server not initialized');
    return;
  }

  io.to(sessionId).emit('wrap-party:updated', {
    sessionId,
    wrapPartyData,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast performance start to session room
 */
export function broadcastPerformanceStart(sessionId: string): void {
  if (!io) {
    console.error('Socket.io server not initialized');
    return;
  }

  io.to(sessionId).emit('performance:started', {
    sessionId,
    timestamp: Date.now(),
  });
}
