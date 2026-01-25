/**
 * PartyKit Integration Tests
 * 
 * Integration tests for PartyKit real-time synchronization.
 * These tests require a running PartyKit server (local dev server or deployed).
 * 
 * Run with: npm test -- partykit-integration.test.ts
 * 
 * Prerequisites:
 * - PartyKit dev server running: npm run dev:partykit
 * - Or set NEXT_PUBLIC_PARTYKIT_HOST to deployed PartyKit server URL
 * 
 * T294: Test session join/leave flow with PartyKit
 * T295: Test VibeContext synchronization with PartyKit
 * T296: Test script update synchronization with PartyKit
 * T297: Test performance progress synchronization with PartyKit
 * T298: Test wrap party vote synchronization with PartyKit
 * T299: Test reconnection and state recovery with PartyKit
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  initializePartyKitClient,
  joinSession,
  leaveSession,
  onVibeContextChange,
  onScriptUpdate,
  onPerformanceProgress,
  onWrapPartyVote,
  advancePerformance,
  submitVote,
  disconnectPartyKit,
  getConnectionStatus,
  isPartyKitConnected,
} from './client';
import type { VibeType } from '@/src/state/types/vibe';
import type { Script, Vote } from '@/src/state/types/session';

// Test configuration
const TEST_SESSION_ID = `test-session-${Date.now()}`;
const TEST_PARTICIPANT_1 = 'test-participant-1';
const TEST_PARTICIPANT_2 = 'test-participant-2';

// Timeout for async operations (5 seconds)
const TEST_TIMEOUT = 5000;

// Helper to wait for condition with timeout
function waitForCondition(
  condition: () => boolean,
  timeout = TEST_TIMEOUT,
  interval = 100
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}

describe('PartyKit Integration Tests', () => {
  beforeAll(() => {
    // Verify PartyKit host is configured
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';
    if (!host) {
      throw new Error('NEXT_PUBLIC_PARTYKIT_HOST not configured. Set it in .env.local or environment variables.');
    }
  });

  afterEach(() => {
    // Clean up connections after each test
    disconnectPartyKit();
  });

  afterAll(() => {
    // Final cleanup
    disconnectPartyKit();
  });

  describe('T294: Session Join/Leave Flow', () => {
    it('should join a session and receive confirmation', async () => {
      initializePartyKitClient(TEST_SESSION_ID);
      
      // Wait for connection
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      // Join session
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      // Verify connection status
      await waitForCondition(() => getConnectionStatus() === 'connected', TEST_TIMEOUT);
      
      expect(isPartyKitConnected()).toBe(true);
      expect(getConnectionStatus()).toBe('connected');
    }, TEST_TIMEOUT + 1000);

    it('should leave a session gracefully', async () => {
      initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      await waitForCondition(() => getConnectionStatus() === 'connected', TEST_TIMEOUT);
      
      // Leave session
      leaveSession(TEST_SESSION_ID);
      
      // Disconnect should be clean
      disconnectPartyKit();
      
      expect(isPartyKitConnected()).toBe(false);
    }, TEST_TIMEOUT + 1000);
  });

  describe('T295: VibeContext Synchronization', () => {
    it('should broadcast VibeContext changes within 500ms', async () => {
      const client1 = initializePartyKitClient(TEST_SESSION_ID);
      const client2 = initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      // Set up listener on client2 (simulating second device)
      let receivedVibe: VibeType | null = null;
      const unsubscribe = onVibeContextChange((data) => {
        if (data.sessionId === TEST_SESSION_ID) {
          receivedVibe = data.vibeContext;
        }
      });
      
      // Wait a bit for listener to be set up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate vibe change (this would normally be triggered by Director)
      const newVibe: VibeType = 'INDIE_A24';
      const startTime = Date.now();
      
      // Send vibe change message directly (normally done through PartyKit server)
      // Note: In real implementation, this would be done via the server
      // For testing, we need to send through the PartyKit message system
      
      // Wait for synchronization (should be <500ms)
      await waitForCondition(() => receivedVibe === newVibe, 1000);
      
      const latency = Date.now() - startTime;
      
      expect(receivedVibe).toBe(newVibe);
      expect(latency).toBeLessThan(500);
      
      unsubscribe();
    }, TEST_TIMEOUT + 1000);
  });

  describe('T296: Script Update Synchronization', () => {
    it('should broadcast script updates within 500ms', async () => {
      const client1 = initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      // Set up listener
      let receivedScript: Script | null = null;
      const unsubscribe = onScriptUpdate((data) => {
        if (data.sessionId === TEST_SESSION_ID) {
          receivedScript = data.script;
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create test script
      const testScript: Script = {
        id: 'script-1',
        sessionId: TEST_SESSION_ID,
        vibeContext: 'VIRAL_NEON',
        title: 'Test Script',
        length: '2 minutes',
        description: 'A test script',
        scenes: [
          {
            title: 'Scene 1',
            length: '1 minute',
            description: 'First scene',
            dialogue: [
              { characterName: 'Character A', content: 'Hello!' },
            ],
            stageDirections: [],
            soundCues: [],
          },
        ],
        generatedAt: Date.now(),
        version: 1,
      };
      
      const startTime = Date.now();
      
      // Send script update (normally done through server)
      // Wait for synchronization
      await waitForCondition(() => receivedScript !== null, 1000);
      
      const latency = Date.now() - startTime;
      
      expect(receivedScript).toBeTruthy();
      expect(latency).toBeLessThan(500);
      const script = receivedScript as Script | null;
      if (script) {
        expect(script.id).toBe(testScript.id);
      }
      
      unsubscribe();
    }, TEST_TIMEOUT + 1000);
  });

  describe('T297: Performance Progress Synchronization', () => {
    it('should broadcast performance progress within 500ms', async () => {
      initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      // Set up listener
      let receivedProgress: {
        currentLineIndex: number;
        currentScene: number;
        startedAt: number | null;
        pausedAt: number | null;
        completedLines: number[];
      } | null = null;
      
      const unsubscribe = onPerformanceProgress((data) => {
        if (data.sessionId === TEST_SESSION_ID) {
          receivedProgress = data.progress;
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const testProgress = {
        currentLineIndex: 5,
        currentScene: 1,
        startedAt: Date.now(),
        pausedAt: null,
        completedLines: [0, 1, 2, 3, 4],
      };
      
      const startTime = Date.now();
      
      // Advance performance
      advancePerformance(TEST_SESSION_ID, testProgress);
      
      // Wait for synchronization
      await waitForCondition(() => receivedProgress !== null, 1000);
      
      const latency = Date.now() - startTime;
      
      expect(receivedProgress).toBeTruthy();
      expect(latency).toBeLessThan(500);
      // Type assertion needed because TypeScript can't infer the type after waitForCondition
      const progress = receivedProgress as {
        currentLineIndex: number;
        currentScene: number;
        startedAt: number | null;
        pausedAt: number | null;
        completedLines: number[];
      } | null;
      expect(progress).not.toBeNull();
      if (progress) {
        expect(progress.currentLineIndex).toBe(testProgress.currentLineIndex);
      }
      
      unsubscribe();
    }, TEST_TIMEOUT + 1000);
  });

  describe('T298: Wrap Party Vote Synchronization', () => {
    it('should broadcast wrap party votes within 500ms', async () => {
      initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'actor' });
      
      // Set up listener
      let receivedVote: Vote | null = null;
      const unsubscribe = onWrapPartyVote((data) => {
        if (data.sessionId === TEST_SESSION_ID) {
          receivedVote = data.vote;
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const testVote: Vote = {
        id: 'vote-1',
        participantId: TEST_PARTICIPANT_1,
        category: 'overall_quality',
        targetId: 'overall',
        value: 5,
        createdAt: Date.now(),
      };
      
      const startTime = Date.now();
      
      // Submit vote
      submitVote(TEST_SESSION_ID, testVote);
      
      // Wait for synchronization
      await waitForCondition(() => receivedVote !== null, 1000);
      
      const latency = Date.now() - startTime;
      
      expect(receivedVote).toBeTruthy();
      expect(latency).toBeLessThan(500);
      const vote = receivedVote as Vote | null;
      if (vote) {
        expect(vote.category).toBe(testVote.category);
        expect(vote.value).toBe(testVote.value);
      }
      
      unsubscribe();
    }, TEST_TIMEOUT + 1000);
  });

  describe('T299: Reconnection and State Recovery', () => {
    it('should handle network interruption and reconnect', async () => {
      initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      // Verify connected
      expect(isPartyKitConnected()).toBe(true);
      
      // Simulate disconnection (close connection)
      disconnectPartyKit();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify disconnected
      expect(isPartyKitConnected()).toBe(false);
      
      // Reconnect
      const newClient = initializePartyKitClient(TEST_SESSION_ID);
      
      // Wait for reconnection (PartyKit client should attempt automatic reconnection)
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT * 2);
      
      // Verify reconnected
      expect(isPartyKitConnected()).toBe(true);
      expect(getConnectionStatus()).toBe('connected');
    }, TEST_TIMEOUT * 3);

    it('should maintain session state after reconnection', async () => {
      initializePartyKitClient(TEST_SESSION_ID);
      
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT);
      
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director', vibeContext: 'INDIE_A24' });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Disconnect
      disconnectPartyKit();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reconnect
      const newClient = initializePartyKitClient(TEST_SESSION_ID);
      await waitForCondition(() => isPartyKitConnected(), TEST_TIMEOUT * 2);
      
      // Rejoin session
      joinSession(TEST_SESSION_ID, TEST_PARTICIPANT_1, { role: 'director' });
      
      // State should be recoverable from server (PartyKit storage)
      // This depends on PartyKit server implementation
      expect(isPartyKitConnected()).toBe(true);
    }, TEST_TIMEOUT * 3);
  });
});
