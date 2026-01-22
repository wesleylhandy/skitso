/**
 * PartyKit Server - Session Management
 * 
 * Handles real-time session synchronization for Skitso platform.
 * Migrated from Socket.io to PartyKit for Vercel compatibility.
 * 
 * Monitoring and Observability:
 * - Structured logging for all operations
 * - Error tracking with context
 * - Performance metrics (latency, message counts)
 * - Connection health monitoring
 */

import type * as Party from 'partykit/server';
import type { VibeType } from '../src/state/types/vibe';
import type {
  Script,
  Vote,
  WrapPartyData,
  SessionStatus,
  ConnectionStatus,
  Character,
} from '../src/state/types/session';
import type { SessionConfiguration } from '../src/lib/validation/session-config-schema';

/**
 * Log levels for structured logging
 */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Structured log entry
 */
interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: {
    sessionId?: string;
    participantId?: string;
    connectionId?: string;
    messageType?: string;
    vibeContext?: VibeType;
    path?: string;
    error?: {
      name: string;
      message: string;
      stack?: string;
    };
    metrics?: {
      latency?: number;
      participantCount?: number;
      sessionCount?: number;
      averageLatency?: number;
      messageCount?: number;
    };
  };
}

/**
 * Logging utility with structured output
 */
class Logger {
  private static log(level: LogLevel, message: string, context?: LogEntry['context']) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    // In production, this could send to external logging service (Sentry, DataDog, etc.)
    const logMessage = JSON.stringify(entry);
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        // Only log debug in development
        if (process.env.NODE_ENV !== 'production') {
          console.debug(logMessage);
        }
        break;
      default:
        console.log(logMessage);
    }
  }

  static info(message: string, context?: LogEntry['context']) {
    this.log('info', message, context);
  }

  static warn(message: string, context?: LogEntry['context']) {
    this.log('warn', message, context);
  }

  static error(message: string, error?: Error, context?: LogEntry['context']) {
    this.log('error', message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  static debug(message: string, context?: LogEntry['context']) {
    this.log('debug', message, context);
  }
}

/**
 * Performance metrics tracker
 */
class Metrics {
  private static messageCounts = new Map<string, number>();
  private static latencies: number[] = [];
  private static maxLatencies = 100; // Keep last 100 latency measurements

  static recordMessage(type: string) {
    const count = this.messageCounts.get(type) || 0;
    this.messageCounts.set(type, count + 1);
  }

  static recordLatency(latency: number) {
    this.latencies.push(latency);
    if (this.latencies.length > this.maxLatencies) {
      this.latencies.shift();
    }
  }

  static getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  static getMessageCounts(): Record<string, number> {
    return Object.fromEntries(this.messageCounts);
  }

  static reset() {
    this.messageCounts.clear();
    this.latencies = [];
  }
}

/**
 * Session state stored in PartyKit storage
 */
interface SessionState {
  sessionId: string;
  vibeContext: VibeType;
  status: SessionStatus;
  participants: Map<string, ParticipantData>;
  createdAt: number;
  lastActivity: number;
  expiresAt: number; // createdAt + 24 hours
}

/**
 * Participant data in session
 */
interface ParticipantData {
  participantId: string;
  connectionId: string;
  role: 'director' | 'actor';
  connectionStatus: ConnectionStatus;
  joinedAt: number;
  lastSeen: number;
  name: string;
}

/**
 * Message types for PartyKit communication
 */
type Message =
  | { type: 'session:join'; data: { sessionId: string; participantId: string; role?: 'director' | 'actor'; vibeContext?: VibeType; name?: string } }
  | { type: 'session:leave'; data: { sessionId: string; participantId?: string } }
  | { type: 'vibe:change'; data: { sessionId: string; vibeContext: VibeType } }
  | { type: 'script:update'; data: { sessionId: string; script: Script } }
  | { type: 'cast:update'; data: { sessionId: string; cast: Character[] } }
  | { type: 'session:state:update'; data: { sessionId: string; status: SessionStatus } }
  | { type: 'performance:advance'; data: { sessionId: string; progress: { currentLineIndex: number; currentScene: number; startedAt: number | null; pausedAt: number | null; completedLines: number[] } } }
  | { type: 'performance:start'; data: { sessionId: string } }
  | { type: 'wrap-party:vote'; data: { sessionId: string; vote: Vote } }
  | { type: 'wrap-party:update'; data: { sessionId: string; wrapPartyData: WrapPartyData } }
  | { type: 'character:override'; data: { sessionId: string; characterId: string; participantId: string | null } }
  | { type: 'character:assign'; data: { sessionId: string; characterId: string; participantId: string } }
  | { type: 'assignment:request'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'assignment:approve'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'assignment:suggest'; data: { sessionId: string; participantId: string; suggestedCharacterId: string } }
  | { type: 'assignment:confirm'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'state:recover'; data: { sessionId?: string; timestamp: number } };

export default class SessionServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  /**
   * Handle new connection
   */
  onConnect(connection: Party.Connection) {
    Logger.info('Connection established', {
      connectionId: connection.id,
    });
  }

  /**
   * Handle connection close
   */
  onClose(connection: Party.Connection) {
    Logger.info('Connection closed', {
      connectionId: connection.id,
    });
    // Remove participant from all sessions
    this.removeConnectionFromAllSessions(connection.id);
  }

  /**
   * Handle incoming messages
   */
  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    // Use Date.now() instead of performance.now() for compatibility with PartyKit serverless environment
    const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let messageType: string | undefined;

    try {
      // Convert ArrayBuffer to string if needed
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const msg: Message = JSON.parse(messageStr);
      messageType = msg.type;

      // Record message type for metrics
      Metrics.recordMessage(msg.type);

      Logger.debug('Message received', {
        connectionId: sender.id,
        messageType: msg.type,
        sessionId: 'data' in msg ? (msg.data as { sessionId?: string }).sessionId : undefined,
      });

      switch (msg.type) {
        case 'session:join':
          await this.handleSessionJoin(msg.data, sender);
          break;
        case 'session:leave':
          await this.handleSessionLeave(msg.data, sender);
          break;
        case 'vibe:change':
          await this.handleVibeContextChange(msg.data);
          break;
        case 'script:update':
          await this.handleScriptUpdate(msg.data);
          break;
        case 'cast:update':
          await this.handleCastUpdate(msg.data);
          break;
        case 'session:state:update':
          await this.handleSessionStateUpdate(msg.data);
          break;
        case 'performance:advance':
          await this.handlePerformanceAdvance(msg.data);
          break;
        case 'performance:start':
          await this.handlePerformanceStart(msg.data, sender);
          break;
        case 'wrap-party:vote':
          await this.handleWrapPartyVote(msg.data);
          break;
        case 'wrap-party:update':
          await this.handleWrapPartyUpdate(msg.data);
          break;
        case 'character:override':
          await this.handleCharacterOverride(msg.data);
          break;
        case 'character:assign':
          await this.handleCharacterAssign(msg.data, sender);
          break;
        case 'assignment:request':
          await this.handleAssignmentRequest(msg.data);
          break;
        case 'assignment:approve':
          await this.handleAssignmentApprove(msg.data);
          break;
        case 'assignment:suggest':
          await this.handleAssignmentSuggest(msg.data);
          break;
        case 'assignment:confirm':
          await this.handleAssignmentConfirm(msg.data);
          break;
        case 'state:recover':
          await this.handleStateRecover(msg.data, sender);
          break;
        default:
          Logger.warn('Unknown message type', {
            connectionId: sender.id,
            messageType: (msg as { type: string }).type,
          });
      }

      // Record latency
      const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const latency = endTime - startTime;
      Metrics.recordLatency(latency);

      // Log slow operations (>100ms)
      if (latency > 100) {
        Logger.warn('Slow message processing', {
          connectionId: sender.id,
          messageType,
          metrics: { latency },
        });
      }
    } catch (error) {
      const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const latency = endTime - startTime;
      Logger.error('Error handling message', error as Error, {
        connectionId: sender.id,
        messageType,
        metrics: { latency },
      });

      try {
        sender.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
        }));
      } catch (sendError) {
        Logger.error('Failed to send error response', sendError as Error, {
          connectionId: sender.id,
        });
      }
    }
  }

  /**
   * Handle session join
   */
  private async handleSessionJoin(
    data: { sessionId: string; participantId: string; role?: 'director' | 'actor'; vibeContext?: VibeType; name?: string },
    sender: Party.Connection
  ) {
    const { sessionId, participantId, role = 'actor', vibeContext, name } = data;

    if (!sessionId || !participantId) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Invalid session join data',
      }));
      return;
    }

    // Get or create session state
    const sessionState = await this.getOrCreateSession(sessionId, vibeContext || 'VIRAL_NEON');

    // Get existing participant or create new one
    const existingParticipant = sessionState.participants.get(participantId);
    const participantData: ParticipantData = {
      participantId,
      connectionId: sender.id,
      role: existingParticipant?.role || role,
      connectionStatus: 'connected',
      joinedAt: existingParticipant?.joinedAt || Date.now(),
      lastSeen: Date.now(),
      name: name || existingParticipant?.name || `Participant ${participantId.slice(-6)}`, // Use provided name, existing name, or fallback
    };

    sessionState.participants.set(participantId, participantData);
    sessionState.lastActivity = Date.now();

    // Save session state
    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    // Get all participants for response
    const participants = Array.from(sessionState.participants.values());

    // Broadcast to other participants
    this.room.broadcast(JSON.stringify({
      type: 'participant:joined',
      data: {
        participantId,
        connectionId: sender.id,
        role,
        name: participantData.name,
        participants,
      },
    }), [sender.id]); // Exclude sender

    // Confirm join to the client
    sender.send(JSON.stringify({
      type: 'session:joined',
      data: {
        sessionId,
        participantId,
        role,
        name: participantData.name,
        participants,
        vibeContext: sessionState.vibeContext,
      },
    }));
  }

  /**
   * Handle session leave
   */
  private async handleSessionLeave(
    data: { sessionId: string; participantId?: string },
    sender: Party.Connection
  ) {
    const { sessionId, participantId } = data;

    if (!sessionId) {
      return;
    }

    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      return;
    }

    // Remove participant if participantId provided
    if (participantId) {
      sessionState.participants.delete(participantId);
      sessionState.lastActivity = Date.now();

      // Save session state
      await this.room.storage.put(`session:${sessionId}`, {
        ...sessionState,
        participants: Array.from(sessionState.participants.entries()),
      });

      // Broadcast to other participants
      const participants = Array.from(sessionState.participants.values());
      this.room.broadcast(JSON.stringify({
        type: 'participant:left',
        data: {
          connectionId: sender.id,
          participantId,
          participants,
        },
      }), [sender.id]);
    }
  }

  /**
   * Handle VibeContext change
   */
  private async handleVibeContextChange(data: { sessionId: string; vibeContext: VibeType }) {
    const { sessionId, vibeContext } = data;

    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      return;
    }

    sessionState.vibeContext = vibeContext;
    sessionState.lastActivity = Date.now();

    // Save session state
    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    // Broadcast to all participants
    const broadcastStart = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    this.room.broadcast(JSON.stringify({
      type: 'vibe:changed',
      data: {
        sessionId,
        vibeContext,
        timestamp: Date.now(),
      },
    }));
    const broadcastEnd = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const broadcastLatency = broadcastEnd - broadcastStart;

    Logger.info('VibeContext changed', {
      sessionId,
      vibeContext,
      metrics: {
        latency: broadcastLatency,
        participantCount: sessionState.participants.size,
      },
    });
  }

  /**
   * Handle script update
   */
  private async handleScriptUpdate(data: { sessionId: string; script: Script }) {
    const { sessionId, script } = data;

    // Save script to storage
    await this.room.storage.put('script', script);

    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'script:updated',
      data: {
        sessionId,
        script,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle cast update
   */
  private async handleCastUpdate(data: { sessionId: string; cast: Character[] }) {
    const { sessionId, cast } = data;

    Logger.info('Cast update received', {
      sessionId,
    });

    // Save cast to storage and increment version
    const currentVersion = await this.room.storage.get<number>('cast:version') || 0;
    await this.room.storage.put('cast', cast);
    await this.room.storage.put('cast:version', currentVersion + 1);

    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast,
        timestamp: Date.now(),
      },
    }));

    Logger.info('Cast update saved and broadcasted', {
      sessionId,
    });
  }

  /**
   * Handle performance advance
   */
  private async handlePerformanceAdvance(data: {
    sessionId: string;
    progress: {
      currentLineIndex: number;
      currentScene: number;
      startedAt: number | null;
      pausedAt: number | null;
      completedLines: number[];
    };
  }) {
    const { sessionId, progress } = data;

    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'performance:progress',
      data: {
        sessionId,
        progress,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle performance start
   */
  private async handlePerformanceStart(
    data: { sessionId: string },
    sender: Party.Connection
  ) {
    const { sessionId } = data;

    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Session not found',
      }));
      return;
    }

    // Find the participant who sent this (should be Director)
    const participant = Array.from(sessionState.participants.values()).find(
      (p) => p.connectionId === sender.id && p.role === 'director'
    );

    if (!participant) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Only Director can start performance',
      }));
      return;
    }

    // Verify minimum participants (at least 2)
    if (sessionState.participants.size < 2) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'At least 2 participants required to start performance',
      }));
      return;
    }

    // Update session status
    sessionState.status = 'performing';
    sessionState.lastActivity = Date.now();

    // Save session state
    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    // Broadcast session state update
    this.room.broadcast(JSON.stringify({
      type: 'session:state:updated',
      data: {
        sessionId,
        status: 'performing',
        timestamp: Date.now(),
      },
    }));

    // Broadcast performance start to all participants
    this.room.broadcast(JSON.stringify({
      type: 'performance:started',
      data: {
        sessionId,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle wrap party vote
   */
  private async handleWrapPartyVote(data: { sessionId: string; vote: Vote }) {
    const { sessionId, vote } = data;

    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'wrap-party:vote',
      data: {
        sessionId,
        vote,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle wrap party data update
   */
  private async handleWrapPartyUpdate(data: { sessionId: string; wrapPartyData: WrapPartyData }) {
    const { sessionId, wrapPartyData } = data;

    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'wrap-party:updated',
      data: {
        sessionId,
        wrapPartyData,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle session state update
   */
  private async handleSessionStateUpdate(data: { sessionId: string; status: SessionStatus }) {
    const { sessionId, status } = data;

    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      Logger.warn('Session not found for state update', {
        sessionId,
      });
      return;
    }

    sessionState.status = status;
    sessionState.lastActivity = Date.now();

    // Save session state
    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'session:state:updated',
      data: {
        sessionId,
        status,
        timestamp: Date.now(),
      },
    }));

    Logger.info('Session state updated', {
      sessionId,
    });
  }

  /**
   * Handle character override
   */
  private async handleCharacterOverride(data: {
    sessionId: string;
    characterId: string;
    participantId: string | null;
  }) {
    // Broadcast to all participants
    this.room.broadcast(JSON.stringify({
      type: 'character:overridden',
      data: {
        ...data,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle character assignment (director assigns directly)
   */
  private async handleCharacterAssign(
    data: {
      sessionId: string;
      characterId: string;
      participantId: string;
    },
    sender: Party.Connection
  ) {
    const { sessionId, characterId, participantId } = data;

    Logger.info('Character assignment requested', {
      sessionId,
      participantId: participantId,
      connectionId: sender.id,
      messageType: 'character:assign',
    });

    // Get session state to verify authorization
    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      Logger.warn('Session not found for character assignment', {
        sessionId,
        connectionId: sender.id,
      });
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Session not found',
      }));
      return;
    }

    // Verify sender is director
    const senderParticipant = Array.from(sessionState.participants.values())
      .find((p) => p.connectionId === sender.id);
    
    if (!senderParticipant || senderParticipant.role !== 'director') {
      Logger.warn('Unauthorized character assignment attempt', {
        sessionId,
        connectionId: sender.id,
      });
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Only directors can assign characters',
      }));
      return;
    }

    // Verify target participant exists in session
    const targetParticipant = sessionState.participants.get(participantId);
    if (!targetParticipant) {
      Logger.warn('Target participant not found for assignment', {
        sessionId,
        participantId: participantId,
        connectionId: sender.id,
      });
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Participant not found in session',
      }));
      return;
    }

    // Get cast from storage with optimistic locking
    // Use a version/timestamp to detect concurrent modifications
    const cast = await this.room.storage.get<Character[]>('cast') || [];
    const castVersion = await this.room.storage.get<number>('cast:version') || 0;
    
    Logger.debug('Cast retrieved from storage', {
      sessionId,
    });
    
    // Verify cast exists
    if (cast.length === 0) {
      Logger.warn('Cast is empty, cannot assign character', {
        sessionId,
        connectionId: sender.id,
      });
      sender.send(JSON.stringify({
        type: 'error',
        message: 'No characters available. Please wait for generation to complete.',
      }));
      return;
    }
    
    // Find character and check for conflicts
    const character = cast.find((c) => c.id === characterId);
    if (!character) {
      Logger.warn('Character not found for assignment', {
        sessionId,
        connectionId: sender.id,
      });
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Character not found',
      }));
      return;
    }

    // Conflict detection: Check if character was assigned by another director since we read it
    // This is a simple optimistic locking approach
    const currentCastVersion = await this.room.storage.get<number>('cast:version') || 0;
    if (currentCastVersion > castVersion) {
      // Cast was modified by another operation, re-read and check
      const updatedCast = await this.room.storage.get<Character[]>('cast') || [];
      const updatedCharacter = updatedCast.find((c) => c.id === characterId);
      
      if (updatedCharacter && updatedCharacter.participantId && updatedCharacter.participantId !== participantId) {
        Logger.warn('Character assignment conflict detected', {
          sessionId,
          participantId: participantId,
          connectionId: sender.id,
        });
        sender.send(JSON.stringify({
          type: 'error',
          message: 'Character was just assigned to another participant. Please refresh and try again.',
        }));
        return;
      }
      
      // Use updated cast if no conflict
      cast.length = 0;
      cast.push(...updatedCast);
    }

    // Unassign from previous participant if any
    const previousParticipantId = character.participantId;
    if (previousParticipantId && previousParticipantId !== participantId) {
      // Unassign previous participant's character
      cast.forEach((c) => {
        if (c.participantId === previousParticipantId && c.id !== characterId) {
          c.participantId = null;
          c.isLocked = false;
        }
      });
    }

    // Assign to new participant (pending status, not locked yet)
    character.participantId = participantId;
    character.isLocked = false;

    // Unassign any other character this participant had
    cast.forEach((c) => {
      if (c.participantId === participantId && c.id !== characterId) {
        c.participantId = null;
        c.isLocked = false;
      }
    });
    
    // Increment version for optimistic locking
    await this.room.storage.put('cast:version', currentCastVersion + 1);

    // Save cast
    await this.room.storage.put('cast', cast);

    Logger.info('Character assigned and saved', {
      sessionId,
      participantId: participantId,
    });

    // Broadcast assignment (pending status)
    this.room.broadcast(JSON.stringify({
      type: 'character:assigned',
      data: {
        sessionId,
        characterId,
        participantId,
        isLocked: false,
        timestamp: Date.now(),
      },
    }));

    // Also broadcast full cast update to ensure all clients are in sync
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast,
        timestamp: Date.now(),
      },
    }));

    Logger.info('Character assignment broadcasted', {
      sessionId,
      participantId: participantId,
    });
  }

  /**
   * Handle assignment request (actor requests a character)
   */
  private async handleAssignmentRequest(data: {
    sessionId: string;
    participantId: string;
    characterId: string;
  }) {
    const { sessionId, participantId, characterId } = data;

    // Get cast to verify character exists
    const cast = await this.room.storage.get<Character[]>('cast') || [];
    const character = cast.find((c) => c.id === characterId);
    if (!character) {
      return;
    }

    // Broadcast request to director (and all participants for UI updates)
    this.room.broadcast(JSON.stringify({
      type: 'assignment:requested',
      data: {
        sessionId,
        participantId,
        characterId,
        requestedAt: Date.now(),
      },
    }));
  }

  /**
   * Handle assignment approval (director approves actor's request)
   */
  private async handleAssignmentApprove(data: {
    sessionId: string;
    participantId: string;
    characterId: string;
  }) {
    const { sessionId, participantId, characterId } = data;

    // Get cast from storage
    const cast = await this.room.storage.get<Character[]>('cast') || [];
    
    const character = cast.find((c) => c.id === characterId);
    if (!character) {
      return;
    }

    // Unassign from previous participant if any
    const previousParticipantId = character.participantId;
    if (previousParticipantId && previousParticipantId !== participantId) {
      cast.forEach((c) => {
        if (c.participantId === previousParticipantId && c.id !== characterId) {
          c.participantId = null;
          c.isLocked = false;
        }
      });
    }

    // Assign to participant (pending status - actor needs to confirm)
    character.participantId = participantId;
    character.isLocked = false;

    // Unassign any other character this participant had
    cast.forEach((c) => {
      if (c.participantId === participantId && c.id !== characterId) {
        c.participantId = null;
        c.isLocked = false;
      }
    });

    // Save cast
    await this.room.storage.put('cast', cast);

    // Broadcast approval (pending status - locks when actor confirms)
    this.room.broadcast(JSON.stringify({
      type: 'assignment:approved',
      data: {
        sessionId,
        participantId,
        characterId,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle assignment suggest (director suggests different character)
   */
  private async handleAssignmentSuggest(data: {
    sessionId: string;
    participantId: string;
    suggestedCharacterId: string;
  }) {
    const { sessionId, participantId, suggestedCharacterId } = data;

    // Get cast from storage
    const cast = await this.room.storage.get<Character[]>('cast') || [];
    
    const character = cast.find((c) => c.id === suggestedCharacterId);
    if (!character) {
      return;
    }

    // Unassign from previous participant if any
    const previousParticipantId = character.participantId;
    if (previousParticipantId && previousParticipantId !== participantId) {
      cast.forEach((c) => {
        if (c.participantId === previousParticipantId && c.id !== suggestedCharacterId) {
          c.participantId = null;
          c.isLocked = false;
        }
      });
    }

    // Assign suggested character (pending status)
    character.participantId = participantId;
    character.isLocked = false;

    // Unassign any other character this participant had
    cast.forEach((c) => {
      if (c.participantId === participantId && c.id !== suggestedCharacterId) {
        c.participantId = null;
        c.isLocked = false;
      }
    });

    // Save cast
    await this.room.storage.put('cast', cast);

    // Broadcast suggestion (pending status)
    this.room.broadcast(JSON.stringify({
      type: 'assignment:suggested',
      data: {
        sessionId,
        participantId,
        suggestedCharacterId,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle assignment confirm (actor confirms assignment, locks it)
   */
  private async handleAssignmentConfirm(data: {
    sessionId: string;
    participantId: string;
    characterId: string;
  }) {
    const { sessionId, participantId, characterId } = data;

    // Get cast from storage
    const cast = await this.room.storage.get<Character[]>('cast') || [];
    
    const character = cast.find((c) => c.id === characterId);
    if (!character || character.participantId !== participantId) {
      return;
    }

    // Lock the assignment
    character.isLocked = true;

    // Save cast
    await this.room.storage.put('cast', cast);

    // Broadcast confirmation (locked status)
    this.room.broadcast(JSON.stringify({
      type: 'assignment:confirmed',
      data: {
        sessionId,
        participantId,
        characterId,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle state recovery request
   */
  private async handleStateRecover(
    data: { sessionId?: string; timestamp: number },
    sender: Party.Connection
  ) {
    if (!data.sessionId) {
      return;
    }

    // Deduplicate state recovery requests - track pending requests per connection
    const requestKey = `${data.sessionId}:${sender.id}`;
    const pendingRecoveryKey = `pending_recovery:${requestKey}`;
    const lastRecovery = await this.room.storage.get<number>(pendingRecoveryKey);
    const now = Date.now();
    
    // If a recovery was requested in the last 2 seconds, skip (deduplication)
    if (lastRecovery && (now - lastRecovery) < 2000) {
      Logger.debug('Skipping duplicate state recovery request', {
        sessionId: data.sessionId,
        connectionId: sender.id,
      });
      return;
    }
    
    // Mark this recovery as pending
    await this.room.storage.put(pendingRecoveryKey, now);

    const sessionState = await this.getSession(data.sessionId);
    if (sessionState) {
      const participants = Array.from(sessionState.participants.values());
      
      // Get script and cast from storage
      const cast = await this.room.storage.get<Character[]>('cast') || [];
      const script = await this.room.storage.get<Script | null>('script') || null;
      
      // Check expiration and include in response
      const now = Date.now();
      const isExpired = now > sessionState.expiresAt;
      
      sender.send(JSON.stringify({
        type: 'state:recovered',
        data: {
          sessionId: data.sessionId,
          vibeContext: sessionState.vibeContext,
          status: isExpired ? 'expired' : sessionState.status,
          participants,
          cast,
          script,
          expiresAt: sessionState.expiresAt,
          isExpired,
          timeUntilExpiration: isExpired ? 0 : sessionState.expiresAt - now,
        },
      }));
    }
  }

  /**
   * Get or create session state
   */
  private async getOrCreateSession(
    sessionId: string,
    vibeContext: VibeType,
    status: SessionStatus = 'casting'
  ): Promise<SessionState> {
    const stored = await this.room.storage.get<{
      sessionId: string;
      vibeContext: VibeType;
      status: SessionStatus;
      participants: Array<[string, ParticipantData]>;
      createdAt: number;
      lastActivity: number;
      expiresAt: number;
    }>(`session:${sessionId}`);

    if (stored) {
      return {
        ...stored,
        participants: new Map(stored.participants),
      };
    }

    const now = Date.now();
    const sessionState: SessionState = {
      sessionId,
      vibeContext,
      status,
      participants: new Map(),
      createdAt: now,
      lastActivity: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Save to storage
    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    return sessionState;
  }

  /**
   * Get session state
   */
  private async getSession(sessionId: string): Promise<SessionState | null> {
    const stored = await this.room.storage.get<{
      sessionId: string;
      vibeContext: VibeType;
      status: SessionStatus;
      participants: Array<[string, ParticipantData]>;
      createdAt: number;
      lastActivity: number;
      expiresAt: number;
    }>(`session:${sessionId}`);

    if (!stored) {
      return null;
    }

    // Check expiration
    if (Date.now() > stored.expiresAt) {
      await this.room.storage.delete(`session:${sessionId}`);
      return null;
    }

    return {
      ...stored,
      participants: new Map(stored.participants),
    };
  }

  /**
   * Remove connection from all sessions
   */
  private async removeConnectionFromAllSessions(connectionId: string) {
    // This is a simplified implementation
    // In production, you might want to track which sessions a connection is in
    // For now, we rely on the client to send session:leave before disconnecting
  }

  /**
   * Cleanup expired sessions (called periodically)
   * Also provides health check and metrics endpoint
   */
  async onRequest(req: Party.Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // The room ID is the sessionId - use this.room.id
    const sessionId = this.room.id;
    
    // Extract path after /parties/main/{roomId}
    // Full pathname: /parties/main/{roomId}/...
    // We want just the ... part
    const pathMatch = pathname.match(/^\/parties\/main\/[^/]+(\/.+)?$/);
    const routePath = pathMatch && pathMatch[1] ? pathMatch[1] : '/';
    
    // Health check endpoint
    if (routePath === '/health' || pathname.endsWith('/health')) {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: Date.now(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Metrics endpoint
    if (routePath === '/metrics' || pathname.endsWith('/metrics')) {
      const metrics = {
        averageLatency: Metrics.getAverageLatency(),
        messageCounts: Metrics.getMessageCounts(),
        timestamp: Date.now(),
      };

      Logger.info('Metrics requested', {
        path: routePath,
      });

      return new Response(JSON.stringify(metrics), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Session lookup endpoint - GET /session or GET / (returns session data)
    // Also handle the old format /session/{sessionId} for backwards compatibility
    if ((routePath === '/session' || routePath === '/' || pathname.endsWith('/session')) && req.method === 'GET') {
      const sessionState = await this.getSession(sessionId);
      
      if (!sessionState) {
        return new Response(JSON.stringify({
          error: 'Session not found',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check expiration
      const now = Date.now();
      if (now > sessionState.expiresAt) {
        return new Response(JSON.stringify({
          error: 'Session expired',
          message: 'This session has expired. Sessions expire after 24 hours.',
        }), {
          status: 410,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get additional session data from storage
      const cast = await this.room.storage.get<Character[]>('cast') || [];
      const script = await this.room.storage.get<Script | null>('script') || null;
      const configuration = await this.room.storage.get<SessionConfiguration>('configuration') || null;

      // Return session data
      const participants = Array.from(sessionState.participants.values());
      return new Response(JSON.stringify({
        session: {
          id: sessionState.sessionId,
          vibeContext: sessionState.vibeContext,
          status: sessionState.status,
          participants,
          cast,
          script,
          configuration,
          createdAt: sessionState.createdAt,
          expiresAt: sessionState.expiresAt,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Session creation endpoint - POST /create
    if (routePath === '/create' && req.method === 'POST') {
      try {
        const body = await req.json() as {
          sessionId: string;
          vibeContext: VibeType;
          configuration?: SessionConfiguration;
          cast?: Character[];
          script?: Script | null;
        };

        const { sessionId, vibeContext, configuration, cast, script } = body;

        // Validate session code format
        if (!/^[A-Za-z0-9]{8,10}$/.test(sessionId)) {
          return new Response(JSON.stringify({
            error: 'Invalid session code format',
            message: 'Session code must be 8-10 alphanumeric characters',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check if session already exists
        const existing = await this.getSession(sessionId);
        let sessionState: SessionState;
        
        if (existing) {
          // Session exists - update it instead of erroring
          sessionState = existing;
          // Update vibeContext if provided
          if (vibeContext && sessionState.vibeContext !== vibeContext) {
            sessionState.vibeContext = vibeContext;
            sessionState.lastActivity = Date.now();
          }
        } else {
          // Create new session state
          sessionState = await this.getOrCreateSession(sessionId, vibeContext, 'casting');
        }

        // Store additional data
        if (configuration) {
          await this.room.storage.put('configuration', configuration);
        }
        if (cast) {
          await this.room.storage.put('cast', cast);
          // Broadcast cast update
          this.room.broadcast(JSON.stringify({
            type: 'cast:updated',
            data: {
              sessionId,
              cast,
              timestamp: Date.now(),
            },
          }));
        }
        if (script !== undefined) {
          await this.room.storage.put('script', script);
          // Broadcast script update
          this.room.broadcast(JSON.stringify({
            type: 'script:updated',
            data: {
              sessionId,
              script,
              timestamp: Date.now(),
            },
          }));
        }

        // Save updated session state
        sessionState.lastActivity = Date.now();
        await this.room.storage.put(`session:${sessionId}`, {
          ...sessionState,
          participants: Array.from(sessionState.participants.entries()),
        });

        // Generate shareable link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
          (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://skitso.app');
        const shareableLink = `${appUrl.replace(/\/$/, '')}/join/${sessionId}`;

        return new Response(JSON.stringify({
          session: {
            id: sessionState.sessionId,
            shareableLink,
            vibeContext: sessionState.vibeContext,
            status: sessionState.status,
          },
        }), {
          status: existing ? 200 : 201, // 200 for update, 201 for create
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        Logger.error('Session creation error', error as Error);
        return new Response(JSON.stringify({
          error: 'Failed to create session',
          message: error instanceof Error ? error.message : 'Unknown error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Session join endpoint - POST /join
    if (routePath === '/join' && req.method === 'POST') {
      try {
        const body = await req.json() as {
          sessionId: string;
          name: string;
          deviceInfo: {
            userAgent: string;
            screenSize: string;
            timezone: string;
          };
        };

        // Use room ID as sessionId (room ID is the sessionId)
        const { name, deviceInfo } = body;

        // Get current timestamp (used for expiration check and participant ID)
        const now = Date.now();

        // Get session
        const sessionState = await this.getSession(sessionId);
        if (!sessionState) {
          return new Response(JSON.stringify({
            error: 'Session not found',
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Check expiration
        if (now > sessionState.expiresAt) {
          return new Response(JSON.stringify({
            error: 'Session expired',
          }), {
            status: 410,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Get cast for character assignment
        const cast = await this.room.storage.get<Character[]>('cast') || [];
        
        // Find first unassigned character
        const unassignedChar = cast.find((char) => char.participantId === null);
        
        // Generate participant ID
        const participantId = `participant-${now}-${Math.random().toString(36).substring(2, 9)}`;

        // Assign character if available
        if (unassignedChar) {
          unassignedChar.participantId = participantId;
          await this.room.storage.put('cast', cast);
        }

        // Add participant to session state (for WebSocket connections)
        const participantData: ParticipantData = {
          participantId,
          connectionId: '', // Will be set when they connect via WebSocket
          role: 'actor',
          connectionStatus: 'connected',
          joinedAt: now,
          lastSeen: now,
          name,
        };
        sessionState.participants.set(participantId, participantData);
        sessionState.lastActivity = now;

        // Save session state
        await this.room.storage.put(`session:${sessionId}`, {
          ...sessionState,
          participants: Array.from(sessionState.participants.entries()),
        });

        // Broadcast participant joined (for existing WebSocket connections)
        const participants = Array.from(sessionState.participants.values());
        this.room.broadcast(JSON.stringify({
          type: 'participant:joined',
          data: {
            participantId,
            connectionId: '',
            role: 'actor',
            name,
            participants,
          },
        }));

        // Return participant data
        return new Response(JSON.stringify({
          participant: {
            id: participantId,
            sessionId,
            role: 'actor',
            name,
            characterAssignment: unassignedChar || null,
            assignmentStatus: unassignedChar ? 'pending' : 'none',
            requestedCharacterId: null,
            connectionStatus: 'connected' as ConnectionStatus,
            joinedAt: now,
            deviceInfo,
          },
          session: {
            id: sessionState.sessionId,
            vibeContext: sessionState.vibeContext,
            status: sessionState.status,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        Logger.error('Session join error', error as Error);
        return new Response(JSON.stringify({
          error: 'Failed to join session',
          message: error instanceof Error ? error.message : 'Unknown error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Default: return session data if no specific route matched
    // This handles requests to /parties/main/{roomId} directly
    if (req.method === 'GET' && (routePath === '/' || pathname.match(/^\/parties\/main\/[^/]+$/))) {
      const sessionState = await this.getSession(sessionId);
      
      if (!sessionState) {
        return new Response(JSON.stringify({
          error: 'Session not found',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get additional session data from storage
      const cast = await this.room.storage.get<Character[]>('cast') || [];
      const script = await this.room.storage.get<Script | null>('script') || null;
      const configuration = await this.room.storage.get<SessionConfiguration>('configuration') || null;
      const participants = Array.from(sessionState.participants.values());

      return new Response(JSON.stringify({
        session: {
          id: sessionState.sessionId,
          vibeContext: sessionState.vibeContext,
          status: sessionState.status,
          participants,
          cast,
          script,
          configuration,
          createdAt: sessionState.createdAt,
          expiresAt: sessionState.expiresAt,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // This can be called via cron or scheduled task
    // For now, expiration is checked on session access
    Logger.debug('Request received', {
      path: url.pathname,
      sessionId,
    });

    return new Response(JSON.stringify({
      error: 'Not found',
      path: pathname,
    }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
