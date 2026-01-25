/**
 * Participant Atom Tests
 * 
 * Tests for participant state management with localStorage persistence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAtom } from 'jotai';
import { participantAtom } from './participant-atom';
import type { Participant } from '../types/session';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('participantAtom', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should initialize with null default value', () => {
    const { result } = renderHook(() => useAtom(participantAtom));
    expect(result.current[0]).toBeNull();
  });

  it('should persist participant to localStorage', () => {
    const { result } = renderHook(() => useAtom(participantAtom));
    const participant: Participant = {
      id: 'participant-1',
      sessionId: 'session-1',
      role: 'actor',
      name: 'Test Actor',
      characterAssignment: null,
      assignmentStatus: 'none',
      requestedCharacterId: null,
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      deviceInfo: {
        userAgent: 'test',
        screenSize: '1920x1080',
        timezone: 'UTC',
      },
    };

    act(() => {
      result.current[1](participant);
    });

    expect(result.current[0]).toEqual(participant);
    const stored = localStorageMock.getItem('participant');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(participant);
  });

  it('should restore participant from localStorage on mount', () => {
    const participant: Participant = {
      id: 'participant-2',
      sessionId: 'session-2',
      role: 'director',
      name: 'Test Director',
      characterAssignment: null,
      assignmentStatus: 'none',
      requestedCharacterId: null,
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      deviceInfo: {
        userAgent: 'test',
        screenSize: '1920x1080',
        timezone: 'UTC',
      },
    };

    localStorageMock.setItem('participant', JSON.stringify(participant));

    const { result } = renderHook(() => useAtom(participantAtom));
    expect(result.current[0]).toEqual(participant);
  });

  it('should update participant atom', () => {
    const { result } = renderHook(() => useAtom(participantAtom));
    const initial: Participant = {
      id: 'participant-3',
      sessionId: 'session-3',
      role: 'actor',
      name: 'Initial Name',
      characterAssignment: null,
      assignmentStatus: 'none',
      requestedCharacterId: null,
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      deviceInfo: {
        userAgent: 'test',
        screenSize: '1920x1080',
        timezone: 'UTC',
      },
    };

    act(() => {
      result.current[1](initial);
    });

    const updated: Participant = {
      ...initial,
      name: 'Updated Name',
      connectionStatus: 'disconnected',
    };

    act(() => {
      result.current[1](updated);
    });

    expect(result.current[0]).toEqual(updated);
  });

  it('should clear participant when set to null', () => {
    const { result } = renderHook(() => useAtom(participantAtom));
    const participant: Participant = {
      id: 'participant-4',
      sessionId: 'session-4',
      role: 'actor',
      name: 'Test',
      characterAssignment: null,
      assignmentStatus: 'none',
      requestedCharacterId: null,
      connectionStatus: 'connected',
      joinedAt: Date.now(),
      deviceInfo: {
        userAgent: 'test',
        screenSize: '1920x1080',
        timezone: 'UTC',
      },
    };

    act(() => {
      result.current[1](participant);
    });

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
  });
});
