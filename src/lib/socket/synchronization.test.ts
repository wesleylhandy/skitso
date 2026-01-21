/**
 * Socket.io Synchronization Tests
 * 
 * Tests for synchronization latency and reconnection state recovery.
 * 
 * T109: Test synchronization latency (<500ms requirement)
 * T110: Test reconnection and state recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Socket as SocketIOClient } from 'socket.io-client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';
import {
  initializeSocketServer,
  broadcastVibeContextChange,
  broadcastScriptUpdate,
  broadcastPerformanceProgress,
} from './server';
import {
  getOrCreateSocketSession,
  addParticipantToSession,
  updateSessionVibeContext,
  removeSession,
} from './session-store';
import type { VibeType } from '@/src/state/types/vibe';
import type { Script } from '@/src/state/types/session';

describe('Socket.io Synchronization Tests', () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let client1: SocketIOClient;
  let client2: SocketIOClient;
  const TEST_SESSION_ID = 'test-session-123';
  const TEST_PARTICIPANT_1 = 'participant-1';
  const TEST_PARTICIPANT_2 = 'participant-2';

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize Socket.io server
    io = initializeSocketServer(httpServer);
    
    // Start server on a random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const port = (httpServer.address() as { port: number }).port;
        const serverURL = `http://localhost:${port}`;
        
        // Create two client connections
        client1 = ioClient(serverURL, {
          path: '/api/socket',
          transports: ['websocket', 'polling'],
          reconnection: false, // Disable auto-reconnection for tests
        });
        
        client2 = ioClient(serverURL, {
          path: '/api/socket',
          transports: ['websocket', 'polling'],
          reconnection: false, // Disable auto-reconnection for tests
        });
        
        resolve();
      });
    });

    // Wait for both clients to connect (with timeout)
    await Promise.race([
      Promise.all([
        new Promise<void>((resolve) => {
          client1.on('connect', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.on('connect', () => resolve());
        }),
      ]),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      }),
    ]);

    // Initialize test session
    getOrCreateSocketSession(TEST_SESSION_ID, 'VIRAL_NEON');
  });

  afterEach(async () => {
    // Cleanup clients
    if (client1 && client1.connected) {
      client1.disconnect();
    }
    if (client2 && client2.connected) {
      client2.disconnect();
    }
    
    // Close server
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    
    // Clean up session store
    removeSession(TEST_SESSION_ID);
  });

  describe('T109: Synchronization Latency', () => {
    it('should broadcast VibeContext changes within 500ms', async () => {
      // Join both clients to session
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });
      
      client2.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_2,
        role: 'actor',
      });

      // Wait for both to join
      await Promise.all([
        new Promise<void>((resolve) => {
          client1.once('session:joined', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.once('session:joined', () => resolve());
        }),
      ]);

      // Set up listener on client2
      const receivedPromise = new Promise<{ vibeContext: VibeType; timestamp: number }>((resolve) => {
        client2.once('vibe:changed', (data) => {
          resolve({
            vibeContext: data.vibeContext,
            timestamp: data.timestamp,
          });
        });
      });

      // Record start time
      const startTime = Date.now();

      // Broadcast VibeContext change
      const newVibe: VibeType = 'INDIE_A24';
      updateSessionVibeContext(TEST_SESSION_ID, newVibe);
      broadcastVibeContextChange(TEST_SESSION_ID, newVibe);

      // Wait for client2 to receive the change (with timeout)
      const received = await Promise.race([
        receivedPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout waiting for vibe change')), 1000);
        }),
      ]);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is within 500ms
      expect(latency).toBeLessThan(500);
      expect(received.vibeContext).toBe(newVibe);
    });

    it('should broadcast script updates within 500ms', async () => {
      // Join both clients to session
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });
      
      client2.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_2,
        role: 'actor',
      });

      // Wait for both to join
      await Promise.all([
        new Promise<void>((resolve) => {
          client1.once('session:joined', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.once('session:joined', () => resolve());
        }),
      ]);

      // Set up listener on client2
      const receivedPromise = new Promise<{ script: Script; timestamp: number }>((resolve) => {
        client2.once('script:updated', (data) => {
          resolve({
            script: data.script,
            timestamp: data.timestamp,
          });
        });
      });

      // Record start time
      const startTime = Date.now();

      // Create test script
      const testScript: Script = {
        id: 'script-1',
        sessionId: TEST_SESSION_ID,
        vibeContext: 'VIRAL_NEON',
        title: 'Test Script',
        length: '5 minutes',
        description: 'A test script',
        scenes: [
          {
            title: 'Scene 1',
            length: '2 minutes',
            description: 'First scene',
            dialogue: [
              {
                characterName: 'Character 1',
                content: 'Hello!',
              },
            ],
            stageDirections: [],
            soundCues: [],
          },
        ],
        generatedAt: Date.now(),
        version: 1,
      };

      // Broadcast script update
      broadcastScriptUpdate(TEST_SESSION_ID, testScript);

      // Wait for client2 to receive the update
      const received = await receivedPromise;
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is within 500ms
      expect(latency).toBeLessThan(500);
      expect(received.script.id).toBe(testScript.id);
      expect(received.script.title).toBe(testScript.title);
    });

    it('should broadcast performance progress updates within 500ms', async () => {
      // Join both clients to session
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });
      
      client2.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_2,
        role: 'actor',
      });

      // Wait for both to join
      await Promise.all([
        new Promise<void>((resolve) => {
          client1.once('session:joined', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.once('session:joined', () => resolve());
        }),
      ]);

      // Set up listener on client2
      const receivedPromise = new Promise<{
        progress: {
          currentLineIndex: number;
          currentScene: number;
          startedAt: number | null;
          pausedAt: number | null;
          completedLines: number[];
        };
        timestamp: number;
      }>((resolve) => {
        client2.once('performance:progress', (data) => {
          resolve({
            progress: data.progress,
            timestamp: data.timestamp,
          });
        });
      });

      // Record start time
      const startTime = Date.now();

      // Create test progress
      const testProgress = {
        currentLineIndex: 5,
        currentScene: 1,
        startedAt: Date.now(),
        pausedAt: null,
        completedLines: [0, 1, 2, 3, 4],
      };

      // Broadcast performance progress
      broadcastPerformanceProgress(TEST_SESSION_ID, testProgress);

      // Wait for client2 to receive the update (with timeout)
      const received = await Promise.race([
        receivedPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout waiting for performance progress')), 1000);
        }),
      ]);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is within 500ms
      expect(latency).toBeLessThan(500);
      expect(received.progress.currentLineIndex).toBe(testProgress.currentLineIndex);
      expect(received.progress.currentScene).toBe(testProgress.currentScene);
    });
  });

  describe('T110: Reconnection and State Recovery', () => {
    it('should recover session state after reconnection', async () => {
      // Join client1 as director
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
        vibeContext: 'INDIE_A24',
      });

      await new Promise<void>((resolve) => {
        client1.once('session:joined', () => resolve());
      });

      // Update session state
      const sessionVibe: VibeType = 'SITCOM_STUDIO';
      updateSessionVibeContext(TEST_SESSION_ID, sessionVibe);

      // Disconnect client1
      client1.disconnect();

      // Wait a bit for disconnect to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reconnect client1
      const port = (httpServer.address() as { port: number }).port;
      const serverURL = `http://localhost:${port}`;
      client1 = ioClient(serverURL, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        client1.on('connect', () => resolve());
      });

      // Join session again
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });

      // Request state recovery
      const stateRecoveryPromise = new Promise<{
        sessionId: string;
        vibeContext: VibeType;
        status: string;
        participants: unknown[];
      }>((resolve) => {
        client1.once('state:recovered', (data) => {
          resolve(data);
        });
      });

      client1.emit('state:recover', {
        sessionId: TEST_SESSION_ID,
        timestamp: Date.now(),
      });

      // Wait for state recovery (with timeout)
      const recoveredState = await Promise.race([
        stateRecoveryPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout waiting for state recovery')), 2000);
        }),
      ]);

      // Verify state was recovered
      expect(recoveredState.sessionId).toBe(TEST_SESSION_ID);
      expect(recoveredState.vibeContext).toBe(sessionVibe);
    });

    it('should maintain session state during reconnection', async () => {
      // Join both clients
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });
      
      client2.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_2,
        role: 'actor',
      });

      await Promise.all([
        new Promise<void>((resolve) => {
          client1.once('session:joined', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.once('session:joined', () => resolve());
        }),
      ]);

      // Update vibe context
      const newVibe: VibeType = 'BRAINROT_THEATER';
      updateSessionVibeContext(TEST_SESSION_ID, newVibe);

      // Disconnect and reconnect client2
      client2.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const port = (httpServer.address() as { port: number }).port;
      const serverURL = `http://localhost:${port}`;
      client2 = ioClient(serverURL, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        client2.on('connect', () => resolve());
      });

      // Rejoin session
      client2.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_2,
        role: 'actor',
      });

      // Wait for session joined event
      const sessionJoinedPromise = new Promise<{ vibeContext: VibeType }>((resolve) => {
        client2.once('session:joined', (data) => {
          resolve({ vibeContext: data.vibeContext });
        });
      });

      const joinedData = await Promise.race([
        sessionJoinedPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout waiting for session join')), 2000);
        }),
      ]);

      // Verify the vibe context is correct (should be the updated one)
      expect(joinedData.vibeContext).toBe(newVibe);
    });

    it('should recover participant list after reconnection', async () => {
      // Join client1
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });

      await new Promise<void>((resolve) => {
        client1.once('session:joined', () => resolve());
      });

      // Add participant2 to session store manually (simulating previous join)
      addParticipantToSession(TEST_SESSION_ID, TEST_PARTICIPANT_2, 'old-socket-id', 'actor');

      // Disconnect and reconnect client1
      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const port = (httpServer.address() as { port: number }).port;
      const serverURL = `http://localhost:${port}`;
      client1 = ioClient(serverURL, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        client1.on('connect', () => resolve());
      });

      // Rejoin and request state recovery
      client1.emit('session:join', {
        sessionId: TEST_SESSION_ID,
        participantId: TEST_PARTICIPANT_1,
        role: 'director',
      });

      const stateRecoveryPromise = new Promise<{ participants: unknown[] }>((resolve) => {
        client1.once('state:recovered', (data) => {
          resolve({ participants: data.participants });
        });
      });

      client1.emit('state:recover', {
        sessionId: TEST_SESSION_ID,
        timestamp: Date.now(),
      });

      const recoveredState = await Promise.race([
        stateRecoveryPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout waiting for state recovery')), 2000);
        }),
      ]);

      // Verify participants are recovered
      expect(recoveredState.participants).toBeDefined();
      expect(Array.isArray(recoveredState.participants)).toBe(true);
    });
  });
});
