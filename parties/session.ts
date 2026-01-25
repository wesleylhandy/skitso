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
    characterId?: string;
    eventType?: string;
    eventId?: string;
    logSize?: number;
    since?: number;
    totalEvents?: number;
    filteredEvents?: number;
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
 * Convert data URL to HTTP endpoint URL for character image
 * Data URLs are stored separately, but cast arrays use HTTP URLs to avoid size limits
 */
function getCharacterImageHttpUrl(sessionId: string, characterId: string): string {
  // Return relative path - clients will construct full URL using getCharacterImageUrl
  return `/parties/main/${sessionId}/image/${characterId}`;
}

/** PartyKit storage value size limit (128 KiB). Data URLs larger than this cannot be stored. */
const PARTYKIT_STORAGE_VALUE_LIMIT_BYTES = 128 * 1024;

/**
 * True if the URL is our own PartyKit image endpoint (relative or absolute).
 * We must never store this in cast:image storage nor redirect to it (causes redirect loop).
 */
function isOwnPartyKitImageUrl(url: string): boolean {
  if (!url || url.length === 0) return false;
  if (url.startsWith('/parties/main/') && url.includes('/image/')) return true;
  try {
    const u = new URL(url);
    return u.pathname.startsWith('/parties/main/') && u.pathname.includes('/image/');
  } catch {
    return false;
  }
}

/**
 * Convert image URL to HTTP URL if it's a data URL
 * Preserves HTTP URLs, converts data URLs to HTTP endpoint URLs
 */
function convertImageUrlToHttp(sessionId: string, characterId: string, imageUrl: string | undefined): string | undefined {
  if (!imageUrl || imageUrl.length === 0) {
    return undefined;
  }
  
  // If already an HTTP URL (external or endpoint), keep it
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/parties/main/')) {
    return imageUrl;
  }
  
  // If it's a data URL, convert to HTTP endpoint URL
  if (imageUrl.startsWith('data:')) {
    return getCharacterImageHttpUrl(sessionId, characterId);
  }
  
  // Unknown format, return as-is
  return imageUrl;
}

/**
 * Convert all data URLs in cast array to HTTP URLs
 * This ensures WebSocket messages stay under size limits
 */
function convertCastToHttpUrls(sessionId: string, cast: Character[]): Character[] {
  return cast.map((char) => {
    const originalImageUrl = char.visualRepresentation?.imageUrl;
    const httpImageUrl = convertImageUrlToHttp(sessionId, char.id, originalImageUrl);
    
    return {
      ...char,
      visualRepresentation: {
        ...char.visualRepresentation,
        imageUrl: httpImageUrl || '', // Ensure string, not undefined
      },
    };
  });
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
  vibeLockedAt?: number | null;
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
 * Event log entry for tracking session events
 */
interface EventLogEntry {
  id: string; // Unique event ID: `${timestamp}-${type}-${participantId}-${characterId?}`
  timestamp: number;
  type: string;
  data: unknown;
  participantId?: string;
  characterId?: string;
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
  | { type: 'performance:end'; data: { sessionId: string } }
  | { type: 'session:end'; data: { sessionId: string } }
  | { type: 'wrap-party:vote'; data: { sessionId: string; vote: Vote } }
  | { type: 'wrap-party:update'; data: { sessionId: string; wrapPartyData: WrapPartyData } }
  | { type: 'character:override'; data: { sessionId: string; characterId: string; participantId: string | null } }
  | { type: 'character:assign'; data: { sessionId: string; characterId: string; participantId: string } }
  | { type: 'assignment:request'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'assignment:approve'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'assignment:reject'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'assignment:suggest'; data: { sessionId: string; participantId: string; suggestedCharacterId: string } }
  | { type: 'assignment:confirm'; data: { sessionId: string; participantId: string; characterId: string } }
  | { type: 'state:recover'; data: { sessionId?: string; timestamp: number } }
  | { type: 'generation:progress'; data: { sessionId: string; phase: string; message: string } };

/**
 * Event log configuration
 * Keep events while room is active (24 hours = session lifetime)
 * Increased limits to support full event replay during session
 */
const MAX_EVENT_LOG_SIZE = 1000; // Keep last 1000 events (increased from 100)
const MAX_EVENT_LOG_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours (session lifetime, increased from 1 hour)
const MAX_EVENT_LOG_SIZE_ACTIVE = 10000; // Larger limit for active rooms (10x normal)

/**
 * Generate unique event ID
 */
function generateEventId(
  timestamp: number,
  type: string,
  participantId?: string,
  characterId?: string
): string {
  const parts = [timestamp.toString(), type];
  if (participantId) parts.push(participantId);
  if (characterId) parts.push(characterId);
  return parts.join('-');
}

/**
 * Notify Next.js to delete Cloudinary images for a closed session (room).
 * Fire-and-forget; used when session expires and we delete session storage.
 * Requires INTERNAL_API_SECRET and APP URL (NEXT_PUBLIC_APP_URL or default).
 */
function notifyCloudinaryDeleteSession(sessionId: string): void {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://skitso.app');
  const base = appUrl.replace(/\/$/, '');
  const url = `${base}/api/cloudinary/delete-session`;
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ sessionId }),
  }).catch((err: unknown) => {
    Logger.warn('Cloudinary delete-session notify failed', {
      sessionId,
      error: {
        name: 'CloudinaryNotifyError',
        message: err instanceof Error ? err.message : String(err),
      },
    });
  });
}

export default class SessionServer implements Party.Server {
  constructor(readonly room: Party.Room) { }

  /**
   * Log an event to the event log
   */
  private async logEvent(
    sessionId: string,
    type: string,
    data: unknown,
    participantId?: string,
    characterId?: string
  ): Promise<void> {
    try {
      const timestamp = Date.now();
      const eventId = generateEventId(timestamp, type, participantId, characterId);

      const event: EventLogEntry = {
        id: eventId,
        timestamp,
        type,
        data,
        participantId,
        characterId,
      };

      // Get existing event log
      const eventLogKey = `events:${sessionId}`;
      const existingLog = await this.room.storage.get<EventLogEntry[]>(eventLogKey) || [];

      // Add new event
      const updatedLog = [...existingLog, event];

      // Check if room is active (not expired) to determine cleanup strategy
      const sessionState = await this.getSession(sessionId);
      const now = Date.now();
      const isRoomActive = sessionState && now < sessionState.expiresAt;

      // Clean up old events based on room activity
      let filteredLog: EventLogEntry[];
      if (isRoomActive) {
        // While room is active, keep more events and only filter by age
        // This ensures full event replay during session lifetime
        filteredLog = updatedLog
          .filter((e) => now - e.timestamp < MAX_EVENT_LOG_AGE_MS)
          .slice(-MAX_EVENT_LOG_SIZE_ACTIVE);
      } else {
        // Room expired, use normal limits
        filteredLog = updatedLog
          .filter((e) => now - e.timestamp < MAX_EVENT_LOG_AGE_MS)
          .slice(-MAX_EVENT_LOG_SIZE);
      }

      // Save updated log
      await this.room.storage.put(eventLogKey, filteredLog);

      Logger.debug('Event logged', {
        sessionId,
        eventType: type,
        eventId,
        logSize: filteredLog.length,
      });
    } catch (error) {
      Logger.error('Failed to log event', error as Error, {
        sessionId,
        eventType: type,
      });
      // Don't throw - event logging failure shouldn't break the flow
    }
  }

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
  async onClose(connection: Party.Connection) {
    Logger.info('Connection closed', {
      connectionId: connection.id,
    });

    // Get session ID from room ID (room ID is the sessionId)
    const sessionId = this.room.id;
    const sessionState = await this.getSession(sessionId);

    if (sessionState) {
      // Find participant with this connection ID
      const disconnectedParticipant = Array.from(sessionState.participants.values()).find(
        (p) => p.connectionId === connection.id
      );

        if (disconnectedParticipant) {
          // Check if director is leaving during performance
          const isDirector = disconnectedParticipant.role === 'director';
          const isPerforming = sessionState.status === 'performing';

          if (isDirector && isPerforming) {
            // Director disconnected during performance - allow performance to continue
            // Actors can continue advancing the script independently
            // Director can reconnect and resume control
            Logger.info('Director disconnected during performance, performance continues', {
              sessionId,
              connectionId: connection.id,
              participantId: disconnectedParticipant.participantId,
            });
            // Do NOT change state - performance continues
          }

          // Remove participant from session
        sessionState.participants.delete(disconnectedParticipant.participantId);
        sessionState.lastActivity = Date.now();

        // Save session state
        await this.room.storage.put(`session:${sessionId}`, {
          ...sessionState,
          participants: Array.from(sessionState.participants.entries()),
        });

        // Broadcast participant left
        const participants = Array.from(sessionState.participants.values());
        this.room.broadcast(JSON.stringify({
          type: 'participant:left',
          data: {
            connectionId: connection.id,
            participantId: disconnectedParticipant.participantId,
            participants,
          },
        }), [connection.id]);
      }
    }

    // Legacy cleanup (kept for compatibility)
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
          await this.handleScriptUpdate(msg.data, sender);
          break;
        case 'cast:update':
          await this.handleCastUpdate(msg.data, sender);
          break;
        case 'session:state:update':
          await this.handleSessionStateUpdate(msg.data, sender);
          break;
        case 'performance:advance':
          await this.handlePerformanceAdvance(msg.data);
          break;
        case 'performance:start':
          await this.handlePerformanceStart(msg.data, sender);
          break;
        case 'performance:end':
          await this.handlePerformanceEnd(msg.data, sender);
          break;
        case 'session:end':
          await this.handleSessionEnd(msg.data, sender);
          break;
        case 'wrap-party:vote':
          await this.handleWrapPartyVote(msg.data);
          break;
        case 'wrap-party:update':
          await this.handleWrapPartyUpdate(msg.data, sender);
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
          await this.handleAssignmentApprove(msg.data, sender);
          break;
        case 'assignment:reject':
          await this.handleAssignmentReject(msg.data, sender);
          break;
        case 'assignment:suggest':
          await this.handleAssignmentSuggest(msg.data, sender);
          break;
        case 'assignment:confirm':
          await this.handleAssignmentConfirm(msg.data);
          break;
        case 'state:recover':
          await this.handleStateRecover(msg.data, sender);
          break;
        case 'generation:progress':
          await this.handleGenerationProgress(msg.data);
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

    // Prevent mid-performance vibe changes once locked
    if (sessionState.status === 'performing' || sessionState.status === 'completed' || sessionState.vibeLockedAt) {
      Logger.warn('VibeContext change ignored because session is locked', {
        sessionId,
        vibeContext,
      });
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
   * Handle script update (director-only)
   */
  private async handleScriptUpdate(
    data: { sessionId: string; script: Script },
    sender: Party.Connection
  ) {
    const { sessionId, script } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

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
   * Handle cast update (director-only)
   */
  private async handleCastUpdate(
    data: { sessionId: string; cast: Character[] },
    sender: Party.Connection
  ) {
    const { sessionId, cast } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

    const roomId = this.room.id;

    // Log incoming character data to debug missing fields
    const incomingCharDetails = cast.map((c) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cAny = c as any;
      return {
        id: c.id,
        hasAbbrevName: cAny.n !== undefined,
        hasFullName: c.name !== undefined,
        name: cAny.n || c.name || 'MISSING',
        hasAbbrevArchetype: cAny.a !== undefined,
        hasFullArchetype: c.archetypeLabel !== undefined,
        archetypeLabel: cAny.a || c.archetypeLabel || 'MISSING',
        hasAbbrevTraits: cAny.t !== undefined,
        hasFullTraits: c.personalityTraits !== undefined,
        traitsCount: Array.isArray(cAny.t || c.personalityTraits) ? (cAny.t || c.personalityTraits).length : 0,
        hasAbbrevHiddenMotivation: cAny.h !== undefined,
        hasFullHiddenMotivation: c.hiddenMotivation !== undefined,
        hiddenMotivation: cAny.h || c.hiddenMotivation || 'MISSING',
        hasImage: Boolean(c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0),
      };
    });
    
    const hasAnyHiddenMotivation = incomingCharDetails.some(
      (d) => d.hasAbbrevHiddenMotivation || d.hasFullHiddenMotivation
    );
    console.log('[PartyKit Server] handleCastUpdate called:', {
      sessionId,
      roomId,
      castLength: cast.length,
      charactersWithImages: cast.filter((c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0).length,
      hasAnyHiddenMotivation,
      incomingCharacterDetails: incomingCharDetails,
    });

    // Verify room ID matches session ID
    if (roomId !== sessionId) {
      Logger.error('Room ID mismatch in cast update', undefined, {
        sessionId,
        messageType: 'cast:update',
      });
      console.error('[PartyKit Server] Room ID mismatch:', {
        sessionId,
        roomId,
        message: 'Cast update received for different room than current room',
      });
      return;
    }

    // Log what we're receiving to help debug image URL issues
    const charactersWithImages = cast.filter(
      (char) => char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0
    ).length;
    Logger.info('Cast update received', {
      sessionId,
      messageType: 'cast:update',
      // Log cast info in message for debugging
    });
    // Log detailed cast info separately (not in context due to type constraints)
    console.log('[PartyKit Server] Cast update details:', {
      sessionId,
      roomId,
      castLength: cast.length,
      charactersWithImages,
      imageUrls: cast.map((char) => ({
        name: char.name,
        hasImage: Boolean(char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0),
        imageUrl: char.visualRepresentation?.imageUrl || null,
      })),
    });

    // CRITICAL: Load existing cast and merge with incoming cast
    // This prevents losing characters when cast updates are sent one at a time (chunking)
    const existingCast = await this.room.storage.get<Character[]>('cast') || [];
    const existingImages = new Map<string, string>();
    
    // Create a map of existing characters by ID for efficient merging
    const existingCastMap = new Map<string, Character>();
    for (const existingChar of existingCast) {
      existingCastMap.set(existingChar.id, existingChar);
    }
    
    // Load all existing images from storage
    for (const existingChar of existingCast) {
      const storageKey = `cast:image:${existingChar.id}`;
      try {
        const existingImage = await this.room.storage.get<string>(storageKey);
        if (existingImage && existingImage.length > 0) {
          existingImages.set(existingChar.id, existingImage);
          console.log('[PartyKit Server] Loaded existing image for preservation:', {
            characterId: existingChar.id,
            characterName: existingChar.name,
            imageUrlLength: existingImage.length,
          });
        }
      } catch (err) {
        console.warn('[PartyKit Server] Failed to load existing image:', {
          characterId: existingChar.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // CRITICAL: Merge incoming cast with existing cast
    // When cast updates are sent one at a time (chunking), we need to preserve existing characters
    const incomingCastMap = new Map<string, Character>();
    for (const char of cast) {
      incomingCastMap.set(char.id, char);
    }
    
    // Merge: incoming characters overwrite existing ones, but we keep existing characters not in incoming
    const mergedCast: Character[] = [];
    
    // First, add all existing characters (they'll be updated if in incoming cast)
    for (const existingChar of existingCast) {
      if (incomingCastMap.has(existingChar.id)) {
        // Character exists in incoming cast - will be processed below
        continue;
      }
      // Character not in incoming cast - preserve it
      mergedCast.push(existingChar);
    }
    
    // Then, process incoming characters (they overwrite existing ones)
    // CRITICAL: Merge intelligently - only update fields that are actually provided
    // This allows minimal character updates (for WebSocket size limits) without losing data
    const imagesToStore = new Map<string, string>();
    
    const castWithPreservedImages = cast.map((char) => {
      // Get existing character to merge with
      const existingChar = existingCastMap.get(char.id);
      
      // Handle abbreviated/minimal character format (for WebSocket size limits)
      // Support full format and abbreviated keys: n,a,t,h,attr (name, archetypeLabel, personalityTraits, hiddenMotivation, attributes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const charAny = char as any;
      const participantId = charAny.p !== undefined ? charAny.p : (char.participantId !== undefined ? char.participantId : undefined);
      const isLocked = charAny.l !== undefined ? charAny.l : (char.isLocked !== undefined ? char.isLocked : undefined);
      const imageUrl = charAny.i !== undefined ? charAny.i : (char.visualRepresentation?.imageUrl !== undefined ? char.visualRepresentation.imageUrl : undefined);
      
      const hasIncomingName = charAny.n !== undefined || char.name !== undefined;
      const hasIncomingArchetype = charAny.a !== undefined || char.archetypeLabel !== undefined;
      const hasIncomingTraits = charAny.t !== undefined || char.personalityTraits !== undefined;
      const hasIncomingHiddenMotivation = charAny.h !== undefined || char.hiddenMotivation !== undefined;
      const hasIncomingAttributes = charAny.attr !== undefined || (char.attributes !== undefined && Array.isArray(char.attributes));
      
      const incomingName = charAny.n !== undefined ? charAny.n : char.name;
      const incomingArchetype = charAny.a !== undefined ? charAny.a : char.archetypeLabel;
      const incomingTraits = charAny.t !== undefined ? charAny.t : char.personalityTraits;
      const incomingHiddenMotivation = charAny.h !== undefined ? charAny.h : char.hiddenMotivation;
      const incomingAttributes = charAny.attr !== undefined ? charAny.attr : char.attributes;
      
      // Merge: Use incoming values ONLY if they're explicitly provided AND non-empty, otherwise preserve existing
      const mergedChar: Character = existingChar ? {
        ...existingChar,
        participantId: participantId !== undefined ? participantId : existingChar.participantId,
        isLocked: isLocked !== undefined ? isLocked : existingChar.isLocked,
        name: hasIncomingName && incomingName && String(incomingName).length > 0 ? String(incomingName) : existingChar.name,
        archetypeLabel: hasIncomingArchetype && incomingArchetype && String(incomingArchetype).length > 0 ? String(incomingArchetype) : existingChar.archetypeLabel,
        personalityTraits: hasIncomingTraits && Array.isArray(incomingTraits) && incomingTraits.length > 0 ? incomingTraits : existingChar.personalityTraits,
        hiddenMotivation: hasIncomingHiddenMotivation && incomingHiddenMotivation && String(incomingHiddenMotivation).length > 0 ? String(incomingHiddenMotivation) : existingChar.hiddenMotivation,
        visualRepresentation: {
          imageUrl: '', // Will be set below
          imagePrompt: char.visualRepresentation?.imagePrompt && char.visualRepresentation.imagePrompt.length > 0 
            ? char.visualRepresentation.imagePrompt 
            : existingChar.visualRepresentation?.imagePrompt || '',
        },
        dialogueLines: char.dialogueLines && char.dialogueLines.length > 0 ? char.dialogueLines : existingChar.dialogueLines,
        attributes: hasIncomingAttributes && Array.isArray(incomingAttributes) && incomingAttributes.length > 0 ? incomingAttributes : existingChar.attributes,
      } : {
        // No existing character - use incoming (full or abbreviated n/a/t/attr) or defaults
        id: char.id,
        sessionId: char.sessionId || sessionId,
        participantId: participantId !== undefined ? participantId : null,
        isLocked: isLocked !== undefined ? isLocked : false,
        name: hasIncomingName && incomingName && String(incomingName).length > 0 
          ? String(incomingName) 
          : `Character ${char.id}`,
        archetypeLabel: hasIncomingArchetype && incomingArchetype && String(incomingArchetype).length > 0 
          ? String(incomingArchetype) 
          : '',
        personalityTraits: hasIncomingTraits && Array.isArray(incomingTraits) && incomingTraits.length > 0 
          ? incomingTraits 
          : [],
        hiddenMotivation: hasIncomingHiddenMotivation && incomingHiddenMotivation && String(incomingHiddenMotivation).length > 0 
          ? String(incomingHiddenMotivation) 
          : '',
        visualRepresentation: {
          imageUrl: '',
          imagePrompt: char.visualRepresentation?.imagePrompt || '',
        },
        dialogueLines: char.dialogueLines || [],
        attributes: hasIncomingAttributes && Array.isArray(incomingAttributes) && incomingAttributes.length > 0 ? incomingAttributes : undefined,
      };
      
      // Get image URL from incoming character (supports both full and minimal format)
      const incomingImageUrl = imageUrl || char.visualRepresentation?.imageUrl;
      const existingImageUrl = existingImages.get(char.id);
      
      // Determine which image URL to use (incoming takes precedence)
      const finalImageUrl = (incomingImageUrl && incomingImageUrl.length > 0) 
        ? incomingImageUrl 
        : existingImageUrl;
      
      // Store image URL for HTTP endpoint serving if:
      // 1. It's a data URL (needs to be served as binary)
      // 2. It's an external HTTP URL (needs to be redirected to)
      // 3. It's NOT our own PartyKit image URL (storing or redirecting to it causes redirect loop)
      if (finalImageUrl) {
        const isDataUrl = finalImageUrl.startsWith('data:');
        const isOwnUrl = isOwnPartyKitImageUrl(finalImageUrl);
        const isExternalHttpUrl =
          (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://')) && !isOwnUrl;

        if (isOwnUrl) {
          // Never store our own endpoint URL; preserve existing data URL or external URL if we have one
          if (existingImageUrl && !isOwnPartyKitImageUrl(existingImageUrl)) {
            imagesToStore.set(char.id, existingImageUrl);
          }
        } else if (isDataUrl || isExternalHttpUrl) {
          imagesToStore.set(char.id, finalImageUrl);
        } else if (existingImageUrl && !isOwnPartyKitImageUrl(existingImageUrl)) {
          // Incoming is empty or unknown; preserve existing non–self image
          imagesToStore.set(char.id, existingImageUrl);
        }
      } else if (existingImageUrl && !isOwnPartyKitImageUrl(existingImageUrl)) {
        imagesToStore.set(char.id, existingImageUrl);
      }
      
      // Set final image URL
      mergedChar.visualRepresentation.imageUrl = finalImageUrl || '';
      
      return mergedChar;
    });
    
    // Add processed incoming characters to merged cast
    mergedCast.push(...castWithPreservedImages);
    
    // Use merged cast for storage and broadcast
    const finalCast = mergedCast;

    // Save cast to storage and increment version
    const currentVersion = await this.room.storage.get<number>('cast:version') || 0;
    Logger.info('Saving cast to storage', {
      sessionId,
      messageType: 'cast:save',
    });
    
    // CRITICAL: Convert data URLs to HTTP URLs for storage and broadcast
    // Data URLs are stored separately in cast:image:${characterId} for HTTP endpoint to serve
    // But cast arrays use HTTP URLs to avoid WebSocket message size limits
    const castForStorage = finalCast.map((char) => {
      const originalImageUrl = char.visualRepresentation?.imageUrl;
      // Convert data URLs to HTTP URLs, preserve HTTP URLs
      const httpImageUrl = convertImageUrlToHttp(sessionId, char.id, originalImageUrl);
      
      return {
        ...char,
        visualRepresentation: {
          ...char.visualRepresentation,
          imageUrl: httpImageUrl || '', // Use HTTP URL instead of data URL, ensure string
        },
      };
    });
    
    // Store images separately - CRITICAL: await this to ensure images are stored before cast is saved
    // Otherwise state recovery might happen before images are stored
    console.log('[PartyKit Server] Processing images for storage:', {
      totalCharacters: finalCast.length,
      incomingCharacters: cast.length,
      existingCharacters: existingCast.length,
      charactersWithImageUrls: finalCast.filter((c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0).length,
      charactersWithNewImages: cast.filter((c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0).length,
      charactersWithPreservedImages: Array.from(existingImages.keys()).length,
      characterDetails: finalCast.map((c) => ({
        id: c.id,
        name: c.name,
        hasVisualRep: !!c.visualRepresentation,
        hasImageUrl: !!(c.visualRepresentation?.imageUrl),
        imageUrlLength: c.visualRepresentation?.imageUrl?.length || 0,
        imageUrlType: typeof c.visualRepresentation?.imageUrl,
        imageUrlPrefix: c.visualRepresentation?.imageUrl?.substring(0, 30) || 'N/A',
        source: existingImages.has(c.id) && !cast.find(ic => ic.id === c.id && ic.visualRepresentation?.imageUrl) ? 'preserved' : 'new',
      })),
    });
    
    // CRITICAL: Store all images (data URLs and external HTTP URLs) before converting to HTTP URLs
    // This ensures HTTP endpoint can serve images even after cast is converted
    console.log('[PartyKit Server] Starting image storage for cast update:', {
      sessionId,
      roomId: this.room.id,
      totalCharacters: cast.length,
      imagesToStoreCount: imagesToStore.size,
      imagesToStoreKeys: Array.from(imagesToStore.keys()),
      castWithPreservedImagesCount: castWithPreservedImages.length,
      charactersWithImageUrls: castWithPreservedImages.filter((c) => c.visualRepresentation?.imageUrl && c.visualRepresentation.imageUrl.length > 0).length,
    });
    
    // Store all images (data URLs and external HTTP URLs). Never store our own PartyKit image URL.
    const allImageStoragePromises = Array.from(imagesToStore.entries()).map(async ([characterId, imageUrl]) => {
      try {
        if (isOwnPartyKitImageUrl(imageUrl)) {
          console.warn('[PartyKit Server] Skipping store of own PartyKit image URL:', {
            characterId,
            sessionId,
            roomId: this.room.id,
          });
          return;
        }
        const storageKey = `cast:image:${characterId}`;
        const isDataUrl = imageUrl.startsWith('data:');
        const isExternalHttpUrl =
          (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) && !isOwnPartyKitImageUrl(imageUrl);

        console.log('[PartyKit Server] Storing image:', {
          storageKey,
          characterId,
          sessionId,
          roomId: this.room.id,
          imageUrlType: isDataUrl ? 'data-url' : isExternalHttpUrl ? 'external-http-url' : 'unknown',
          imageUrlLength: imageUrl.length,
          imageUrlPrefix: imageUrl.substring(0, 50), // First 50 chars for debugging
        });
        
        await this.room.storage.put(storageKey, imageUrl);
        
        console.log('[PartyKit Server] Stored image successfully:', {
          storageKey,
          characterId,
          sessionId,
          roomId: this.room.id,
          imageUrlType: isDataUrl ? 'data-url' : isExternalHttpUrl ? 'external-http-url' : 'unknown',
          imageUrlLength: imageUrl.length,
        });
        
        // Verify it was stored (only for data URLs, as HTTP URLs are just references)
        if (isDataUrl) {
          const stored = await this.room.storage.get<string>(storageKey);
          if (!stored) {
            console.error('[PartyKit Server] Image storage verification failed - image not found after storing:', {
              storageKey,
              characterId,
            });
            throw new Error(`Image storage verification failed for ${characterId}`);
          } else if (stored.length !== imageUrl.length) {
            console.error('[PartyKit Server] Image storage verification failed - length mismatch:', {
              storageKey,
              characterId,
              expectedLength: imageUrl.length,
              storedLength: stored.length,
            });
            throw new Error(`Image storage length mismatch for ${characterId}`);
          } else {
            console.log('[PartyKit Server] Image storage verified successfully:', {
              storageKey,
              characterId,
              storedLength: stored.length,
            });
          }
        }
      } catch (err) {
        console.error('[PartyKit Server] Failed to store image:', {
          characterId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err; // Re-throw to fail Promise.all if critical
      }
    });
    // CRITICAL: Await image storage to ensure images are persisted before cast is saved
    // This prevents race conditions where state recovery happens before images are stored
    // Use Promise.allSettled to continue even if some images fail, but log failures
    const imageStorageResults = await Promise.allSettled(allImageStoragePromises);
    const failedImages = imageStorageResults.filter((r) => r.status === 'rejected');
    if (failedImages.length > 0) {
      console.error('[PartyKit Server] Some images failed to store:', {
        failedCount: failedImages.length,
        totalCount: allImageStoragePromises.length,
        errors: failedImages.map((r) => r.status === 'rejected' ? r.reason : null),
      });
      Logger.error('Some images failed to store during cast update', undefined, {
        sessionId,
        messageType: 'cast:update',
      });
      console.error('[PartyKit Server] Image storage failures:', {
        sessionId,
        failedCount: failedImages.length,
        totalCount: allImageStoragePromises.length,
      });
    } else {
      console.log('[PartyKit Server] All images stored separately, proceeding with cast storage');
    }
    
    // Check size of cast data without image URLs (PartyKit has 128 KiB limit per value)
    const castJson = JSON.stringify(castForStorage);
    const castSizeBytes = new Blob([castJson]).size;
    const castSizeKiB = castSizeBytes / 1024;
    const maxSizeKiB = 128; // PartyKit limit
    
    console.log('[PartyKit Server] Saving cast (images stored separately):', {
      sessionId,
      roomId,
      castLength: cast.length,
      currentVersion,
      castSizeBytes,
      castSizeKiB: castSizeKiB.toFixed(2),
      maxSizeKiB,
      willFit: castSizeBytes <= maxSizeKiB * 1024,
      imagesStoredSeparately: cast.filter((c) => c.visualRepresentation?.imageUrl).length,
    });
    
    if (castSizeBytes > maxSizeKiB * 1024) {
      Logger.error('Cast data exceeds PartyKit storage limit even without images', undefined, {
        sessionId,
        messageType: 'cast:save',
      });
      console.error('[PartyKit Server] Cast too large for storage:', {
        sessionId,
        roomId,
        castSizeBytes,
        castSizeKiB: castSizeKiB.toFixed(2),
        maxSizeBytes: maxSizeKiB * 1024,
        error: 'Cast data exceeds 128 KiB limit even after stripping images',
      });
      // Still broadcast the cast update so clients get it, but warn about storage
    }
    
    try {
      // Store cast without image URLs
      await this.room.storage.put('cast', castForStorage);
      await this.room.storage.put('cast:version', currentVersion + 1);
      console.log('[PartyKit Server] Cast successfully saved to storage (images stored separately)');
    } catch (error) {
      Logger.error('Failed to save cast to storage', error as Error, {
        sessionId,
        messageType: 'cast:save',
      });
      console.error('[PartyKit Server] Storage save error:', {
        sessionId,
        roomId,
        error: error instanceof Error ? error.message : String(error),
        castSizeBytes,
      });
      // Continue anyway - broadcast will still work
    }

    // Verify what was actually saved
    const savedCast = await this.room.storage.get<Character[]>('cast') || [];
    const savedCharactersWithImages = savedCast.filter(
      (char) => char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0
    ).length;
    
    if (savedCast.length !== finalCast.length) {
      Logger.error('Cast length mismatch after save', undefined, {
        sessionId,
        messageType: 'cast:save',
      });
      console.error('[PartyKit Server] Cast length mismatch:', {
        sessionId,
        roomId,
        expectedLength: finalCast.length,
        savedLength: savedCast.length,
      });
    }
    
    Logger.info('Cast saved to storage', {
      sessionId,
      messageType: 'cast:save',
    });
    // Log detailed cast info separately (not in context due to type constraints)
    console.log('[PartyKit Server] Cast saved details:', {
      sessionId,
      roomId,
      savedCastLength: savedCast.length,
      savedCharactersWithImages,
      savedImageUrls: savedCast.map((char) => ({
        name: char.name,
        hasImage: Boolean(char.visualRepresentation?.imageUrl && char.visualRepresentation.imageUrl.length > 0),
        imageUrl: char.visualRepresentation?.imageUrl || null,
      })),
    });

    // ALWAYS broadcast cast update, even if storage failed
    // This ensures clients receive cast via cast:updated event even if storage has issues
    // CRITICAL: Convert data URLs to HTTP URLs for broadcast to avoid WebSocket message size limit
    // Images are stored separately in cast:image:${characterId} and served via HTTP endpoint
    // Use merged cast for broadcast so all characters are included
    const castForBroadcast = finalCast.map((char) => {
      const originalImageUrl = char.visualRepresentation?.imageUrl;
      // Convert data URLs to HTTP URLs, preserve HTTP URLs
      const httpImageUrl = convertImageUrlToHttp(sessionId, char.id, originalImageUrl);
      
      return {
        ...char,
        visualRepresentation: {
          ...char.visualRepresentation,
          imageUrl: httpImageUrl, // Use HTTP URL instead of data URL
        },
      };
    });
    
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast: castForBroadcast, // Broadcast without images
        timestamp: Date.now(),
      },
    }));

    Logger.info('Cast update broadcasted', {
      sessionId,
      messageType: 'cast:update',
    });
    console.log('[PartyKit Server] Cast broadcasted to all participants:', {
      sessionId,
      roomId,
      castLength: cast.length,
      broadcastTimestamp: Date.now(),
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

    // Allow start with director only (solo read-through) or with actors
    if (sessionState.participants.size < 1) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'At least 1 participant (director) required to start performance',
      }));
      return;
    }

    // Update session status
    sessionState.status = 'performing';
    sessionState.lastActivity = Date.now();
    sessionState.vibeLockedAt = sessionState.vibeLockedAt ?? Date.now();

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
   * Handle performance end (director-only)
   */
  private async handlePerformanceEnd(
    data: { sessionId: string },
    sender: Party.Connection
  ) {
    const { sessionId } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Session not found',
      }));
      return;
    }

    // Only allow ending if currently performing
    if (sessionState.status !== 'performing') {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Performance is not in progress',
      }));
      return;
    }

    // Update to completed state
    sessionState.status = 'completed';
    sessionState.lastActivity = Date.now();

    // Save session state
    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    // Initialize wrap party data so clients can show voting UI immediately.
    // State recovery and session:state:updated both provide it.
    const now = Date.now();
    const wrapPartyData: WrapPartyData = {
      sessionId,
      votes: [],
      awards: [],
      feedback: [],
      sharedLinks: [],
      createdAt: now,
    };
    await this.room.storage.put('wrap-party', wrapPartyData);

    // Broadcast state change to all participants (include wrapPartyData so clients don't wait for recovery).
    this.room.broadcast(JSON.stringify({
      type: 'session:state:updated',
      data: {
        sessionId,
        status: 'completed',
        vibeContext: sessionState.vibeContext,
        vibeLockedAt: sessionState.vibeLockedAt ?? null,
        wrapPartyData,
        timestamp: now,
      },
    }));

    Logger.info('Performance ended by director', {
      sessionId,
      connectionId: sender.id,
    });
  }

  /**
   * Handle session end (director-only). Sets status to expired and broadcasts
   * so all participants cleanup and redirect (e.g. to vibe-selection).
   */
  private async handleSessionEnd(
    data: { sessionId: string },
    sender: Party.Connection
  ) {
    const { sessionId } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      sender.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
      return;
    }

    sessionState.status = 'expired';
    sessionState.lastActivity = Date.now();
    sessionState.expiresAt = Date.now();

    await this.room.storage.put(`session:${sessionId}`, {
      ...sessionState,
      participants: Array.from(sessionState.participants.entries()),
    });

    this.room.broadcast(JSON.stringify({
      type: 'session:state:updated',
      data: {
        sessionId,
        status: 'expired',
        vibeContext: sessionState.vibeContext,
        vibeLockedAt: sessionState.vibeLockedAt ?? null,
        timestamp: Date.now(),
      },
    }));

    Logger.info('Session ended by director', { sessionId, connectionId: sender.id });
  }

  /**
   * Handle wrap party vote
   */
  private async handleWrapPartyVote(data: { sessionId: string; vote: Vote }) {
    const { sessionId, vote } = data;

    // Validate session exists
    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      Logger.warn('Wrap party vote for non-existent session ignored', { sessionId });
      return;
    }

    // Validate participant belongs to session
    if (!sessionState.participants.has(vote.participantId)) {
      Logger.warn('Wrap party vote from unknown participant ignored', {
        sessionId,
        participantId: vote.participantId,
      });
      return;
    }

    // Validate category and value ranges
    const validCategories: Vote['category'][] = [
      'overall_quality',
      'favorite_moment',
      'best_actor',
      'funniest_moment',
    ];

    if (!validCategories.includes(vote.category)) {
      Logger.warn('Wrap party vote with invalid category ignored', {
        sessionId,
      });
      return;
    }

    if (vote.category === 'overall_quality') {
      if (vote.value < 1 || vote.value > 5) {
        Logger.warn('Wrap party overall_quality vote with out-of-range value ignored', {
          sessionId,
        });
        return;
      }
    } else {
      // Other categories are treated as single-selection (value should be 1)
      if (vote.value !== 1) {
        Logger.warn('Wrap party categorical vote with invalid value ignored', {
          sessionId,
        });
        return;
      }
    }

    // Enforce at most one vote per (participantId, category) pair using persisted wrap party data if available
    const existingWrapParty = await this.room.storage.get<WrapPartyData | null>('wrap-party');
    if (existingWrapParty) {
      const hasExistingForCategory = existingWrapParty.votes.some(
        (existing) =>
          existing.participantId === vote.participantId && existing.category === vote.category
      );
      if (hasExistingForCategory) {
        Logger.warn('Duplicate wrap party vote for participant/category ignored', {
          sessionId,
        });
        return;
      }
    }

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
   * Handle wrap party data update (director-only)
   */
  private async handleWrapPartyUpdate(
    data: { sessionId: string; wrapPartyData: WrapPartyData },
    sender: Party.Connection
  ) {
    const { sessionId, wrapPartyData } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

    // Persist wrap party data so results and sharing persist for 24 hours
    await this.room.storage.put('wrap-party', wrapPartyData);

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
   * Handle session state update (director-only)
   */
  private async handleSessionStateUpdate(
    data: { sessionId: string; status: SessionStatus },
    sender: Party.Connection
  ) {
    const { sessionId, status } = data;

    const sessionState = await this.requireDirector(sessionId, sender);
    if (!sessionState) return;

    sessionState.status = status;
    sessionState.lastActivity = Date.now();

    // If session moves into performing state via generic state update, lock vibe if not already locked
    if (status === 'performing' && !sessionState.vibeLockedAt) {
      sessionState.vibeLockedAt = Date.now();
    }

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
        vibeContext: sessionState.vibeContext,
        vibeLockedAt: sessionState.vibeLockedAt ?? null,
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

    // Log event for replay
    await this.logEvent(
      sessionId,
      'character:assigned',
      {
        sessionId,
        characterId,
        participantId,
        isLocked: false,
        timestamp: Date.now(),
      },
      participantId,
      characterId
    );

    // Also broadcast full cast update to ensure all clients are in sync
    // Convert data URLs to HTTP URLs for broadcast
    const castWithHttpUrls = convertCastToHttpUrls(sessionId, cast);
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast: castWithHttpUrls,
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

    // Log event for replay
    await this.logEvent(
      sessionId,
      'assignment:requested',
      {
        sessionId,
        participantId,
        characterId,
        requestedAt: Date.now(),
      },
      participantId,
      characterId
    );
  }

  /**
   * Handle assignment approval (director approves actor's request)
   */
  private async handleAssignmentApprove(
    data: {
      sessionId: string;
      participantId: string;
      characterId: string;
    },
    sender: Party.Connection
  ) {
    const { sessionId, participantId, characterId } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

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

    // Log event for replay
    await this.logEvent(
      sessionId,
      'assignment:approved',
      {
        sessionId,
        participantId,
        characterId,
        timestamp: Date.now(),
      },
      participantId,
      characterId
    );

    // Also broadcast full cast update to ensure all clients are in sync
    // Convert data URLs to HTTP URLs for broadcast
    const castWithHttpUrls = convertCastToHttpUrls(sessionId, cast);
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast: castWithHttpUrls,
        timestamp: Date.now(),
      },
    }));
  }

  /**
   * Handle assignment rejection (director rejects request or unassigns character)
   */
  private async handleAssignmentReject(
    data: {
      sessionId: string;
      participantId: string;
      characterId: string;
    },
    sender: Party.Connection
  ) {
    const { sessionId, participantId, characterId } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

    // Get cast from storage
    const cast = await this.room.storage.get<Character[]>('cast') || [];
    const character = cast.find((c) => c.id === characterId);

    if (!character) {
      return;
    }

    // Only reject if character is assigned to this participant
    // This handles both rejecting a request (character might not be assigned yet)
    // and unassigning an existing assignment
    if (character.participantId === participantId) {
      // Unassign character
      character.participantId = null;
      character.isLocked = false;
    }

    // Save cast
    await this.room.storage.put('cast', cast);

    // Broadcast rejection
    this.room.broadcast(JSON.stringify({
      type: 'assignment:rejected',
      data: {
        sessionId,
        participantId,
        characterId,
        timestamp: Date.now(),
      },
    }));

    // Log event for replay
    await this.logEvent(
      sessionId,
      'assignment:rejected',
      {
        sessionId,
        participantId,
        characterId,
        timestamp: Date.now(),
      },
      participantId,
      characterId
    );

    // Also broadcast full cast update to ensure all clients are in sync
    // Convert data URLs to HTTP URLs for broadcast
    const castWithHttpUrls = convertCastToHttpUrls(sessionId, cast);
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast: castWithHttpUrls,
        timestamp: Date.now(),
      },
    }));

    Logger.info('Assignment rejected', {
      sessionId,
      participantId,
      characterId,
    });
  }

  /**
   * Handle assignment suggest (director suggests different character)
   */
  private async handleAssignmentSuggest(
    data: {
      sessionId: string;
      participantId: string;
      suggestedCharacterId: string;
    },
    sender: Party.Connection
  ) {
    const { sessionId, participantId, suggestedCharacterId } = data;

    if (!(await this.requireDirector(sessionId, sender))) return;

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

    // Also broadcast full cast update to ensure all clients are in sync
    // Convert data URLs to HTTP URLs for broadcast
    const castWithHttpUrls = convertCastToHttpUrls(sessionId, cast);
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast: castWithHttpUrls,
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

    // Log event for replay
    await this.logEvent(
      sessionId,
      'assignment:confirmed',
      {
        sessionId,
        participantId,
        characterId,
        timestamp: Date.now(),
      },
      participantId,
      characterId
    );

    // Also broadcast full cast update to ensure all clients are in sync
    // This is critical so the director sees the locked assignment
    const castWithHttpUrls = convertCastToHttpUrls(sessionId, cast);
    this.room.broadcast(JSON.stringify({
      type: 'cast:updated',
      data: {
        sessionId,
        cast: castWithHttpUrls,
        timestamp: Date.now(),
      },
    }));

    Logger.info('Assignment confirmed and cast updated', {
      sessionId,
      participantId,
      characterId,
    });
  }

  /**
   * Handle state recovery request
   * Sends a minimal WS message ({ sessionId, recovered: true }) to stay under workerd's
   * 576-byte WebSocket limit. Clients fetch full state via GET /state.
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

    if (lastRecovery && (now - lastRecovery) < 2000) {
      Logger.debug('Skipping duplicate state recovery request', {
        sessionId: data.sessionId,
        connectionId: sender.id,
      });
      return;
    }

    await this.room.storage.put(pendingRecoveryKey, now);

    const stored = await this.room.storage.get<{ expiresAt: number }>(`session:${data.sessionId}`);
    const isExpired = stored && now > stored.expiresAt;
    const sessionState = await this.getSession(data.sessionId);

    if (sessionState) {
      Logger.info('State recovery - sending minimal ack', {
        sessionId: data.sessionId,
        messageType: 'state:recover',
      });
      sender.send(JSON.stringify({
        type: 'state:recovered',
        data: { sessionId: data.sessionId, recovered: true },
      }));
    } else if (isExpired) {
      Logger.info('State recovery - sending minimal ack (expired)', {
        sessionId: data.sessionId,
        messageType: 'state:recover',
      });
      sender.send(JSON.stringify({
        type: 'state:recovered',
        data: { sessionId: data.sessionId, recovered: true, isExpired: true },
      }));
    }
  }

  /**
   * Handle generation progress broadcast (Director → all clients in room).
   * Forwards phase + message to Join page and others; no persistence.
   */
  private async handleGenerationProgress(data: {
    sessionId: string;
    phase: string;
    message: string;
  }) {
    const { sessionId, phase, message } = data;
    if (!sessionId || !message) {
      return;
    }
    this.room.broadcast(
      JSON.stringify({
        type: 'generation:progress',
        data: { sessionId, phase, message, timestamp: Date.now() },
      })
    );
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
      vibeLockedAt?: number | null;
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
      vibeLockedAt: null,
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
      vibeLockedAt?: number | null;
    }>(`session:${sessionId}`);

    if (!stored) {
      return null;
    }

    // Check expiration
    if (Date.now() > stored.expiresAt) {
      await this.room.storage.delete(`session:${sessionId}`);
      notifyCloudinaryDeleteSession(sessionId);
      return null;
    }

    return {
      ...stored,
      participants: new Map(stored.participants),
    };
  }

  /**
   * Require sender to be the director for the session.
   * Sends error to sender and returns null if not authorized.
   * Returns session state if authorized (for use in handler logic).
   */
  private async requireDirector(
    sessionId: string,
    sender: Party.Connection
  ): Promise<SessionState | null> {
    const sessionState = await this.getSession(sessionId);
    if (!sessionState) {
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Session not found',
      }));
      return null;
    }

    const participant = Array.from(sessionState.participants.values()).find(
      (p) => p.connectionId === sender.id
    );

    if (!participant || participant.role !== 'director') {
      Logger.warn('Unauthorized director-only action', {
        sessionId,
        connectionId: sender.id,
      });
      sender.send(JSON.stringify({
        type: 'error',
        message: 'Only directors can perform this action',
      }));
      return null;
    }

    return sessionState;
  }

  /**
   * Remove connection from all sessions
   */
  private async removeConnectionFromAllSessions(connectionId: string) {
    // This is a simplified implementation
    // In production, you might want to track which sessions a connection is in
    // For now, we rely on the client to send session:leave before disconnecting
    void connectionId; // Parameter reserved for future implementation
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

    // Image storage endpoint - POST /image/{characterId}
    // Stores character images in PartyKit storage via HTTP
    // This avoids WebSocket message size limits (576 bytes) for large data URLs (2MB+)
    const imagePathMatch = routePath.match(/^\/image\/(.+)$/);
    
    // Handle CORS preflight request
    if (imagePathMatch && req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    
    if (imagePathMatch && req.method === 'POST') {
      const characterId = imagePathMatch[1];

      try {
        const body = (await req.json()) as { imageUrl?: string };
        const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : undefined;

        if (!imageUrl || imageUrl.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Image URL is required' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        if (isOwnPartyKitImageUrl(imageUrl)) {
          return new Response(
            JSON.stringify({
              error: 'Cannot store PartyKit image endpoint URL',
              message: 'Store data URLs or external HTTP URLs only.',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        if (imageUrl.length > PARTYKIT_STORAGE_VALUE_LIMIT_BYTES) {
          return new Response(
            JSON.stringify({
              error: 'Image too large',
              message: `PartyKit storage limit is ${PARTYKIT_STORAGE_VALUE_LIMIT_BYTES} bytes (128 KiB). Image length: ${imageUrl.length}. Use external image hosting for larger images.`,
              maxBytes: PARTYKIT_STORAGE_VALUE_LIMIT_BYTES,
              receivedBytes: imageUrl.length,
            }),
            {
              status: 413,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        }

        const storageKey = `cast:image:${characterId}`;
        await this.room.storage.put(storageKey, imageUrl);

        console.log('[PartyKit Server] Image stored via HTTP POST:', {
          storageKey,
          characterId,
          sessionId,
          roomId: this.room.id,
          imageUrlLength: imageUrl.length,
          imageUrlType: imageUrl.startsWith('data:')
            ? 'data-url'
            : imageUrl.startsWith('http')
              ? 'http-url'
              : 'unknown',
        });

        return new Response(
          JSON.stringify({ success: true, characterId, storageKey }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        Logger.error('Failed to store image via HTTP POST', err, {
          sessionId,
          characterId: imagePathMatch[1],
          path: routePath,
        });
        const status = err.message.includes('limit') || err.message.includes('quota') ? 413 : 500;
        return new Response(
          JSON.stringify({
            error: 'Failed to store image',
            message: err.message,
          }),
          {
            status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // Image serving endpoint - GET /image/{characterId}
    // Serves character images from PartyKit storage via HTTP
    // This avoids WebSocket message size limits (576 bytes) for large data URLs (100KB+)
    if (imagePathMatch && req.method === 'GET') {
      const characterId = imagePathMatch[1];

      try {
        const storageKey = `cast:image:${characterId}`;
        const imageUrl = await this.room.storage.get<string>(storageKey);

        if (!imageUrl || imageUrl.length === 0) {
          // Try to get cast to see if character exists
          const cast = await this.room.storage.get<Character[]>('cast') || [];
          const character = cast.find((c) => c.id === characterId);
          
          console.warn('[PartyKit Server] Image not found in storage:', {
            storageKey,
            characterId,
            sessionId,
            roomId: this.room.id,
            characterExists: !!character,
            characterName: character?.name || 'N/A',
            castLength: cast.length,
            characterIds: cast.map((c) => c.id),
          });
          
          return new Response(JSON.stringify({
            error: 'Image not found',
            characterId,
            storageKey,
            sessionId,
            roomId: this.room.id,
            characterExists: !!character,
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Determine MIME type from data URL
        let mimeType = 'image/png'; // default
        if (imageUrl.startsWith('data:image/')) {
          const mimeMatch = imageUrl.match(/^data:image\/([^;]+)/);
          if (mimeMatch) {
            mimeType = `image/${mimeMatch[1]}`;
          }
        }

        // Extract base64 data from data URL
        let imageData: string;
        if (imageUrl.startsWith('data:')) {
          const base64Match = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            imageData = base64Match[1];
          } else {
            // Not base64, return as-is (shouldn't happen with our implementation)
            return new Response(JSON.stringify({
              error: 'Invalid image format',
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } else {
          // External HTTP URL: redirect. Never redirect to our own PartyKit image URL (causes redirect loop).
          if (isOwnPartyKitImageUrl(imageUrl)) {
            await this.room.storage.delete(storageKey);
            console.warn('[PartyKit Server] Removed self-referential image URL from storage:', {
              storageKey,
              characterId,
              sessionId,
              roomId: this.room.id,
            });
            return new Response(JSON.stringify({
              error: 'Image not found',
              characterId,
              storageKey,
            }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return Response.redirect(imageUrl, 302);
        }

        // Convert base64 to binary
        const binaryString = atob(imageData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Return image with proper headers
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            'Access-Control-Allow-Origin': '*', // Allow CORS for image requests
          },
        });
      } catch (error) {
        Logger.error('Failed to serve image', error as Error, {
          sessionId,
          characterId,
          path: routePath,
        });
        return new Response(JSON.stringify({
          error: 'Failed to serve image',
          message: error instanceof Error ? error.message : 'Unknown error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Event log endpoint - GET /events?since={timestamp}&type={eventType}
    // Returns events since the specified timestamp for event replay on reconnection.
    // Optional type parameter filters events by type.
    if (routePath === '/events' && req.method === 'GET') {
      const url = new URL(req.url);
      const sinceParam = url.searchParams.get('since');
      const typeParam = url.searchParams.get('type'); // Optional: filter by event type
      const since = sinceParam ? parseInt(sinceParam, 10) : 0;

      if (isNaN(since) || since < 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid since parameter. Must be a non-negative number.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        const eventLogKey = `events:${sessionId}`;
        const eventLog = await this.room.storage.get<EventLogEntry[]>(eventLogKey) || [];

        // Filter events since the specified timestamp
        let filteredEvents = eventLog.filter((event) => event.timestamp > since);

        // Filter by type if specified
        if (typeParam) {
          filteredEvents = filteredEvents.filter((event) => event.type === typeParam);
        }

        // Sort by timestamp to ensure correct order
        filteredEvents.sort((a, b) => a.timestamp - b.timestamp);

        Logger.info('Event log queried', {
          sessionId,
          since,
          totalEvents: eventLog.length,
          filteredEvents: filteredEvents.length,
        });

        return new Response(JSON.stringify({ events: filteredEvents }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        Logger.error('Failed to query event log', error as Error, {
          sessionId,
          since,
        });
        return new Response(
          JSON.stringify({
            error: 'Failed to query event log',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // State recovery endpoint - GET /state
    // Returns full session state for clients that receive minimal state:recovered over WebSocket.
    // Keeps WS messages under workerd 576-byte limit.
    if (routePath === '/state' && req.method === 'GET') {
      const sessionState = await this.getSession(sessionId);
      if (!sessionState) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const now = Date.now();
      if (now > sessionState.expiresAt) {
        return new Response(JSON.stringify({
          error: 'Session expired',
          sessionId,
          isExpired: true,
          status: 'expired',
        }), {
          status: 410,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const cast = await this.room.storage.get<Character[]>('cast') || [];
      const script = await this.room.storage.get<Script | null>('script') || null;
      const wrapPartyData = await this.room.storage.get<WrapPartyData | null>('wrap-party') || null;
      const participants = Array.from(sessionState.participants.values());
      const castWithHttpUrls = convertCastToHttpUrls(sessionId, cast);
      const body = {
        sessionId,
        vibeContext: sessionState.vibeContext,
        status: sessionState.status,
        vibeLockedAt: sessionState.vibeLockedAt ?? null,
        participants,
        cast: castWithHttpUrls,
        script,
        wrapPartyData,
        expiresAt: sessionState.expiresAt,
        isExpired: false,
        timeUntilExpiration: sessionState.expiresAt - now,
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
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
