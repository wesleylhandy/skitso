/**
 * Session State Management on Server
 * 
 * In-memory session store for Socket.io server state management.
 * Tracks active sessions, participants, and connection status.
 */

import type { SessionStatus, Participant, ConnectionStatus } from '@/src/state/types/session';
import type { VibeType } from '@/src/state/types/vibe';

/**
 * Socket session data stored on server
 */
export interface SocketSessionData {
  sessionId: string;
  participants: Map<string, SocketParticipant>;
  vibeContext: VibeType;
  status: SessionStatus;
  lastActivity: number;
}

/**
 * Participant data in socket session
 */
export interface SocketParticipant {
  participantId: string;
  socketId: string;
  role: 'director' | 'actor';
  connectionStatus: ConnectionStatus;
  joinedAt: number;
  lastSeen: number;
}

/**
 * In-memory session store
 * Key: sessionId, Value: SocketSessionData
 */
const socketSessionStore = new Map<string, SocketSessionData>();

/**
 * Get or create socket session data
 */
export function getOrCreateSocketSession(
  sessionId: string,
  vibeContext: VibeType,
  status: SessionStatus = 'casting'
): SocketSessionData {
  let session = socketSessionStore.get(sessionId);

  if (!session) {
    session = {
      sessionId,
      participants: new Map(),
      vibeContext,
      status,
      lastActivity: Date.now(),
    };
    socketSessionStore.set(sessionId, session);
  }

  return session;
}

/**
 * Get socket session data
 */
export function getSocketSession(sessionId: string): SocketSessionData | null {
  return socketSessionStore.get(sessionId) || null;
}

/**
 * Add participant to session
 */
export function addParticipantToSession(
  sessionId: string,
  participantId: string,
  socketId: string,
  role: 'director' | 'actor'
): void {
  const session = getSocketSession(sessionId);
  if (!session) {
    console.warn(`Cannot add participant: session ${sessionId} not found`);
    return;
  }

  const participant: SocketParticipant = {
    participantId,
    socketId,
    role,
    connectionStatus: 'connected',
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  };

  session.participants.set(participantId, participant);
  session.lastActivity = Date.now();
}

/**
 * Remove participant from session
 */
export function removeParticipantFromSession(sessionId: string, participantId: string): void {
  const session = getSocketSession(sessionId);
  if (!session) {
    return;
  }

  session.participants.delete(participantId);
  session.lastActivity = Date.now();
}

/**
 * Update participant connection status
 */
export function updateParticipantConnectionStatus(
  sessionId: string,
  participantId: string,
  status: ConnectionStatus
): void {
  const session = getSocketSession(sessionId);
  if (!session) {
    return;
  }

  const participant = session.participants.get(participantId);
  if (participant) {
    participant.connectionStatus = status;
    participant.lastSeen = Date.now();
    session.lastActivity = Date.now();
  }
}

/**
 * Update session vibe context
 */
export function updateSessionVibeContext(sessionId: string, vibeContext: VibeType): void {
  const session = getSocketSession(sessionId);
  if (!session) {
    return;
  }

  session.vibeContext = vibeContext;
  session.lastActivity = Date.now();
}

/**
 * Update session status
 */
export function updateSessionStatus(sessionId: string, status: SessionStatus): void {
  const session = getSocketSession(sessionId);
  if (!session) {
    return;
  }

  session.status = status;
  session.lastActivity = Date.now();
}

/**
 * Get all participants in session
 */
export function getSessionParticipants(sessionId: string): SocketParticipant[] {
  const session = getSocketSession(sessionId);
  if (!session) {
    return [];
  }

  return Array.from(session.participants.values());
}

/**
 * Get participant by ID
 */
export function getParticipant(sessionId: string, participantId: string): SocketParticipant | null {
  const session = getSocketSession(sessionId);
  if (!session) {
    return null;
  }

  return session.participants.get(participantId) || null;
}

/**
 * Clean up expired sessions (older than 24 hours)
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

  for (const [sessionId, session] of socketSessionStore.entries()) {
    if (now - session.lastActivity > EXPIRY_TIME) {
      socketSessionStore.delete(sessionId);
      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  }
}

/**
 * Remove session from store
 */
export function removeSession(sessionId: string): void {
  socketSessionStore.delete(sessionId);
}

/**
 * Get all active sessions
 */
export function getAllSessions(): SocketSessionData[] {
  return Array.from(socketSessionStore.values());
}
