/**
 * Session Type Definitions
 * 
 * Defines types for session state, configuration, and related entities.
 */

import type { VibeType } from './vibe';

export type SessionStatus = 
  | 'idle'
  | 'configuring'
  | 'casting'
  | 'performing'
  | 'completed'
  | 'expired';

export type ConnectionStatus = 
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting';

export type AssignmentStatus = 
  | 'none' // No assignment or request
  | 'requested' // Actor has requested a character
  | 'pending' // Director has assigned, waiting for actor confirmation
  | 'rejected' // Director rejected request or unassigned character
  | 'locked'; // Assignment is confirmed and locked

export interface Participant {
  id: string;
  sessionId: string;
  role: 'director' | 'actor';
  name: string;
  characterAssignment: Character | null;
  assignmentStatus: AssignmentStatus;
  requestedCharacterId: string | null; // Character ID actor requested
  rejectedCharacterId?: string | null; // Character ID that was rejected/unassigned (optional for backward compatibility)
  connectionStatus: ConnectionStatus;
  joinedAt: number;
  deviceInfo: {
    userAgent: string;
    screenSize: string;
    timezone: string;
  };
}

export interface Character {
  id: string;
  sessionId: string;
  participantId: string | null;
  isLocked: boolean; // Whether assignment is locked (cannot be reassigned)
  name: string;
  archetypeLabel: string;
  personalityTraits: string[];
  hiddenMotivation: string;
  visualRepresentation: {
    imageUrl: string;
    imagePrompt: string;
  };
  dialogueLines: number[];
  attributes?: Array<{
    name: string;
    rating: number;
  }>;
}

export interface Script {
  id: string;
  sessionId: string;
  vibeContext: VibeType;
  title: string;
  length: string;
  description: string;
  scenes: Array<{
    title: string;
    length: string;
    description: string;
    dialogue: Array<{
      characterName: string;
      content: string;
    }>;
    stageDirections: Array<{
      lineIndex: number;
      text: string;
    }>;
    soundCues: Array<{
      lineIndex: number;
      soundName: string;
      startOffset: number;
    }>;
  }>;
  generatedAt: number;
  version: number;
}

export type VoteCategory = 
  | 'overall_quality'
  | 'favorite_moment'
  | 'best_actor'
  | 'funniest_moment';

export interface Vote {
  id: string;
  participantId: string;
  category: VoteCategory;
  targetId: string; // Character ID, line index, or 'overall'
  value: number; // 1-5 stars or boolean (0/1)
  createdAt: number;
}

export interface Award {
  id: string;
  category: VoteCategory;
  winnerId: string; // Character ID or participant ID
  voteCount: number;
  vibeAppropriateLabel: string; // e.g., "Ate" (Viral) or "Best Actor" (Indie)
}

export interface Feedback {
  id: string;
  participantId: string;
  text: string; // Free text feedback
  createdAt: number;
}

export interface SharedLink {
  id: string;
  platform: 'twitter' | 'instagram' | 'tiktok' | 'direct';
  url: string;
  createdAt: number;
}

export interface WrapPartyData {
  sessionId: string;
  votes: Vote[];
  awards: Award[];
  feedback: Feedback[];
  sharedLinks: SharedLink[];
  createdAt: number;
}

export interface AssignmentRequest {
  participantId: string;
  characterId: string;
  requestedAt: number;
}

export interface AssignmentApproval {
  participantId: string;
  characterId: string | null; // null if director suggests different character
  suggestedCharacterId: string | null; // Character director suggests instead
  approvedAt: number;
}
