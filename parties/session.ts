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
} from '../src/state/types/session';

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
}

/**
 * Message types for PartyKit communication
 */
type Message =
  | { type: 'session:join'; data: { sessionId: string; participantId: string; role?: 'director' | 'actor'; vibeContext?: VibeType } }
  | { type: 'session:leave'; data: { sessionId: string; participantId?: string } }
  | { type: 'vibe:change'; data: { sessionId: string; vibeContext: VibeType } }
  | { type: 'script:update'; data: { sessionId: string; script: Script } }
  | { type: 'performance:advance'; data: { sessionId: string; progress: { currentLineIndex: number; currentScene: number; startedAt: number | null; pausedAt: number | null; completedLines: number[] } } }
  | { type: 'performance:start'; data: { sessionId: string } }
  | { type: 'wrap-party:vote'; data: { sessionId: string; vote: Vote } }
  | { type: 'wrap-party:update'; data: { sessionId: string; wrapPartyData: WrapPartyData } }
  | { type: 'character:override'; data: { sessionId: string; characterId: string; participantId: string | null } }
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
    const startTime = performance.now();
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
      const latency = performance.now() - startTime;
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
      const latency = performance.now() - startTime;
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
    data: { sessionId: string; participantId: string; role?: 'director' | 'actor'; vibeContext?: VibeType },
    sender: Party.Connection
  ) {
    const { sessionId, participantId, role = 'actor', vibeContext } = data;

    if (!sessionId || !participantId) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Invalid session join data',
      }));
      return;
    }

    // Get or create session state
    const sessionState = await this.getOrCreateSession(sessionId, vibeContext || 'VIRAL_NEON');

    // Add participant to session
    const participantData: ParticipantData = {
      participantId,
      connectionId: sender.id,
      role,
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      lastSeen: Date.now(),
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
    const broadcastStart = performance.now();
    this.room.broadcast(JSON.stringify({
      type: 'vibe:changed',
      data: {
        sessionId,
        vibeContext,
        timestamp: Date.now(),
      },
    }));
    const broadcastLatency = performance.now() - broadcastStart;

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
   * Handle state recovery request
   */
  private async handleStateRecover(
    data: { sessionId?: string; timestamp: number },
    sender: Party.Connection
  ) {
    if (!data.sessionId) {
      return;
    }

    const sessionState = await this.getSession(data.sessionId);
    if (sessionState) {
      const participants = Array.from(sessionState.participants.values());
      sender.send(JSON.stringify({
        type: 'state:recovered',
        data: {
          sessionId: data.sessionId,
          vibeContext: sessionState.vibeContext,
          status: sessionState.status,
          participants,
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
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: Date.now(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Metrics endpoint
    if (url.pathname === '/metrics') {
      const metrics = {
        averageLatency: Metrics.getAverageLatency(),
        messageCounts: Metrics.getMessageCounts(),
        timestamp: Date.now(),
      };

      Logger.info('Metrics requested', {
        metrics: {
          averageLatency: metrics.averageLatency,
          messageCount: Object.keys(metrics.messageCounts).length,
        },
      });

      return new Response(JSON.stringify(metrics), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // This can be called via cron or scheduled task
    // For now, expiration is checked on session access
    Logger.debug('Request received', {
      path: url.pathname,
    });

    return new Response('OK', { status: 200 });
  }
}
