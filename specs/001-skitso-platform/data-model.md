# Data Model: Skitso Platform

**Version:** 1.0.0  
**Last Updated:** 2025-01-27

## Overview

This document defines the data structures, entities, relationships, and validation rules for the Skitso platform. All entities are designed to support the VibeContext system and multi-device synchronization.

## Core Entities

### VibeContext

**Type:** Enum + Configuration Object

**Values:**
```typescript
type VibeType = 
  | 'VIRAL_NEON'
  | 'INDIE_A24'
  | 'SITCOM_STUDIO'
  | 'BRAINROT_THEATER'
  | 'QUIET_STUDIO';

interface VibeContext {
  id: VibeType;
  visualTokens: {
    bgColor: string;
    primaryColor: string;
    accentColor: string;
    headerFont: string;
    bodyFont: string;
    borderRadius: string;
    animationStyle: 'snappy' | 'smooth' | 'slow-fade' | 'bouncy' | 'instant';
  };
  linguisticTone: {
    buttonLabels: Record<string, string>;
    placeholders: Record<string, string>;
    errorMessages: Record<string, string>;
    successMessages: Record<string, string>;
  };
  aiParameters: {
    slangRegistry: string[];
    toneGuidelines: string;
    pacing: string;
    archetypeLabels: Record<string, string>;
  };
  interactionPatterns: {
    animationSpeed: number;
    hoverEffects: string;
    clickFeedback: string;
    soundEffects: string[];
  };
}
```

**Validation Rules:**
- VibeType must be one of the five defined values
- All color values must be valid hex codes
- Font values must be valid font family names
- AI parameters must include slang registry for VIRAL_NEON

**State Transitions:**
- Initial: User selects vibe → VibeContext atom updated
- Synchronization: Director's VibeContext → Broadcast to all Actors
- Persistence: VibeContext stored in session state

---

### Session

**Type:** Entity

**Attributes:**
```typescript
interface Session {
  id: string; // Session code (8-10 char alphanumeric)
  shareableLink: string; // https://skitso.app/join/{id}
  vibeContext: VibeType;
  directorId: string; // Director participant ID
  configuration: SessionConfiguration;
  status: SessionStatus;
  createdAt: number; // Unix timestamp
  expiresAt: number; // createdAt + 24 hours
  cast: CastMember[];
  script: Script | null;
  performanceProgress: PerformanceProgress;
  wrapPartyData: WrapPartyData | null;
}

type SessionStatus = 
  | 'configuring'
  | 'casting'
  | 'performing'
  | 'completed'
  | 'expired';

interface SessionConfiguration {
  theme: string; // 10-200 characters
  tone: TonePreference;
  participantCount: number; // 2-10
  chaosLevel: number; // 1-10
  directorDefinedCharacters?: Character[]; // Optional pre-defined characters
}

type TonePreference = 
  | 'comedic'
  | 'dramatic'
  | 'satirical'
  | 'absurd'
  | 'serious'
  | 'romantic';
```

**Validation Rules:**
- Session ID: 8-10 alphanumeric characters, cryptographically secure
- Theme: 10-200 characters, non-empty
- Participant count: 2-10 inclusive
- Chaos level: 1-10 inclusive
- Expiration: Must be 24 hours after creation

**State Transitions:**
- `configuring` → `casting`: Director completes configuration, generates script
- `casting` → `performing`: Director starts performance
- `performing` → `completed`: Performance ends, transitions to Wrap Party
- Any → `expired`: 24 hours of inactivity

**Relationships:**
- One Session has one Director (Participant with role='director')
- One Session has many Actors (Participant with role='actor')
- One Session has one Script
- One Session has one WrapPartyData (after completion)

---

### Participant

**Type:** Entity

**Attributes:**
```typescript
interface Participant {
  id: string; // Unique participant identifier
  sessionId: string; // Foreign key to Session
  role: 'director' | 'actor';
  name: string; // User-provided or generated
  characterAssignment: Character | null; // Assigned character (if actor)
  connectionStatus: ConnectionStatus;
  joinedAt: number; // Unix timestamp
  deviceInfo: {
    userAgent: string;
    screenSize: string;
    timezone: string;
  };
}

type ConnectionStatus = 
  | 'connected'
  | 'disconnected'
  | 'reconnecting';
```

**Validation Rules:**
- Participant ID: Unique within session
- Name: Non-empty string, max 50 characters
- Role: Must be 'director' or 'actor'
- Connection status: Must be one of defined values

**State Transitions:**
- `disconnected` → `connected`: Participant joins or reconnects
- `connected` → `disconnected`: Network interruption or leave
- `disconnected` → `reconnecting`: Attempting to reconnect

**Relationships:**
- Many Participants belong to one Session
- One Participant (actor) has one Character assignment
- One Participant (director) has one Session

---

### Character

**Type:** Entity

**Attributes:**
```typescript
interface Character {
  id: string; // Unique character identifier
  sessionId: string; // Foreign key to Session
  participantId: string | null; // Foreign key to Participant (if assigned)
  name: string; // Vibe-appropriate name
  archetypeLabel: string; // e.g., "The Main Character" (Viral) or "The Protagonist" (Indie)
  personalityTraits: string[]; // List of traits
  hiddenMotivation: string; // Not visible to other participants
  visualRepresentation: {
    imageUrl: string; // gpt-image-1.5 generated image
    imagePrompt: string; // Original prompt used
  };
  dialogueLines: number[]; // References to script line indices
}
```

**Validation Rules:**
- Character ID: Unique within session
- Name: Non-empty string, vibe-appropriate
- Archetype label: Must match vibe's archetype terminology
- Personality traits: Non-empty array, max 10 traits
- Hidden motivation: Non-empty string, not visible to others
- Visual representation: Valid image URL or data URI

**State Transitions:**
- Created: Generated by AI or pre-defined by Director
- Assigned: Participant ID set when Actor joins
- Unassigned: Participant ID cleared if Actor leaves (character available for reassignment)

**Relationships:**
- Many Characters belong to one Session
- One Character assigned to one Participant (actor)
- One Character has many DialogueLines (references)

---

### Script

**Type:** Entity

**Attributes:**
```typescript
interface Script {
  id: string; // Unique script identifier
  sessionId: string; // Foreign key to Session
  vibeContext: VibeType; // For style matching
  dialogueLines: DialogueLine[];
  stageDirections: StageDirection[];
  soundCues: SoundCue[];
  timingMarkers: TimingMarker[];
  generatedAt: number; // Unix timestamp
  version: number; // For edits/regenerations
}

interface DialogueLine {
  id: number; // Line index
  characterId: string; // Foreign key to Character
  text: string; // Dialogue text
  timing: {
    estimatedDuration: number; // Seconds
    pauseAfter: number; // Seconds
  };
}

interface StageDirection {
  id: number; // Line index (interspersed with dialogue)
  text: string; // Action description
  timing: {
    estimatedDuration: number; // Seconds
  };
}

interface SoundCue {
  id: number; // Line index (interspersed with dialogue)
  soundName: string; // Sound effect name
  timing: {
    startOffset: number; // Seconds from line start
    duration: number; // Seconds
  };
}

interface TimingMarker {
  lineIndex: number;
  pauseDuration: number; // Seconds
  pacing: 'fast' | 'normal' | 'slow';
}
```

**Validation Rules:**
- Script ID: Unique within session
- Dialogue lines: Non-empty array, all characters have at least one line
- Stage directions: Optional, interspersed with dialogue
- Sound cues: Optional, vibe-appropriate
- Timing markers: Valid line indices, positive durations
- Total performance time: 2-5 minutes (120-300 seconds)

**State Transitions:**
- Created: Generated by AI after Director configuration
- Updated: Regenerated if Director edits configuration
- Active: Used during performance
- Completed: All lines delivered or Director ends early

**Relationships:**
- One Script belongs to one Session
- One Script has many DialogueLines
- Many DialogueLines reference one Character

---

### PerformanceProgress

**Type:** Value Object

**Attributes:**
```typescript
interface PerformanceProgress {
  currentLineIndex: number; // Current active line
  currentScene: number; // Current scene/segment
  startedAt: number | null; // Unix timestamp when performance started
  pausedAt: number | null; // Unix timestamp when paused (if applicable)
  completedLines: number[]; // Indices of completed lines
  advancementControl: {
    lastAdvancedBy: string; // Participant ID
    lastAdvancedAt: number; // Unix timestamp
    directorOverride: boolean; // Director paused/controlled
  };
}
```

**Validation Rules:**
- Current line index: Non-negative, within script bounds
- Current scene: Non-negative integer
- Completed lines: Sorted array, no duplicates
- Advancement control: Valid participant ID, valid timestamp

**State Transitions:**
- Initial: currentLineIndex = 0, no completed lines
- Advancing: Line index increments, line added to completed
- Paused: Director override = true
- Completed: All lines in completedLines array

---

### WrapPartyData

**Type:** Entity

**Attributes:**
```typescript
interface WrapPartyData {
  sessionId: string; // Foreign key to Session
  votes: Vote[];
  awards: Award[];
  feedback: Feedback[];
  sharedLinks: SharedLink[];
  createdAt: number; // Unix timestamp
}

interface Vote {
  id: string;
  participantId: string; // Voter
  category: VoteCategory;
  targetId: string; // Character ID, line index, or 'overall'
  value: number; // 1-5 stars or boolean
  createdAt: number;
}

type VoteCategory = 
  | 'overall_quality'
  | 'favorite_moment'
  | 'best_actor'
  | 'funniest_moment';

interface Award {
  id: string;
  category: VoteCategory;
  winnerId: string; // Character ID or participant ID
  voteCount: number;
  vibeAppropriateLabel: string; // e.g., "Ate" (Viral) or "Best Actor" (Indie)
}

interface Feedback {
  id: string;
  participantId: string;
  text: string; // Free text feedback
  createdAt: number;
}

interface SharedLink {
  id: string;
  platform: 'twitter' | 'instagram' | 'tiktok' | 'direct';
  url: string;
  createdAt: number;
}
```

**Validation Rules:**
- Votes: One vote per participant per category
- Awards: Calculated from vote aggregation
- Feedback: Max 500 characters
- Shared links: Valid URLs

**Relationships:**
- One WrapPartyData belongs to one Session
- Many Votes belong to one WrapPartyData
- Many Awards belong to one WrapPartyData

---

### Recording (Premium Feature)

**Type:** Entity

**Attributes:**
```typescript
interface Recording {
  id: string; // Unique recording identifier
  sessionId: string; // Foreign key to Session
  creatorId: string; // Participant ID who created recording
  videoFileUrl: string | null; // Video file URL (if video chat enabled)
  audioFileUrl: string; // Audio file URL
  scriptSyncData: {
    lineTimings: Array<{
      lineIndex: number;
      timestamp: number; // Seconds from start
    }>;
  };
  performanceTiming: {
    startedAt: number;
    endedAt: number;
    duration: number; // Seconds
  };
  createdAt: number; // Unix timestamp
  expiresAt: number; // createdAt + 30 days (premium) or 7 days (trial)
  shareSettings: {
    visibility: 'public' | 'private' | 'link-based';
    shareLink: string | null;
  };
  viewCount: number;
  downloadCount: number;
}
```

**Validation Rules:**
- Recording ID: Unique
- File URLs: Valid URLs or null
- Expiration: Must be 30 days (premium) or 7 days (trial) after creation
- Share settings: Valid visibility, share link if link-based

**Relationships:**
- One Recording belongs to one Session
- One Recording created by one Participant

---

## Data Validation Schemas (Zod)

```typescript
import { z } from 'zod';

export const VibeTypeSchema = z.enum([
  'VIRAL_NEON',
      'INDIE_A24',
  'SITCOM_STUDIO',
  'BRAINROT_THEATER',
  'QUIET_STUDIO'
]);

export const SessionConfigurationSchema = z.object({
  theme: z.string().min(10).max(200),
  tone: z.enum(['comedic', 'dramatic', 'satirical', 'absurd', 'serious', 'romantic']),
  participantCount: z.number().int().min(2).max(10),
  chaosLevel: z.number().int().min(1).max(10),
  directorDefinedCharacters: z.array(CharacterSchema).optional()
});

export const SessionCodeSchema = z.string()
  .regex(/^[A-Za-z0-9]{8,10}$/)
  .describe('8-10 character alphanumeric session code');

export const CharacterSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  participantId: z.string().nullable(),
  name: z.string().min(1).max(50),
  archetypeLabel: z.string(),
  personalityTraits: z.array(z.string()).min(1).max(10),
  hiddenMotivation: z.string().min(1),
  visualRepresentation: z.object({
    imageUrl: z.string().url(),
    imagePrompt: z.string()
  }),
  dialogueLines: z.array(z.number())
});

// Additional schemas for all entities...
```

---

## Entity Relationships Diagram

```
Session (1) ──< (many) Participant
Session (1) ──< (1) Script
Session (1) ──< (1) WrapPartyData
Session (1) ──< (many) Recording

Participant (1) ──< (1) Character [if actor]
Script (1) ──< (many) DialogueLine
DialogueLine (many) ──> (1) Character

VibeContext (enum) ──> (many) Session
VibeContext (enum) ──> (many) Script
```

---

## State Persistence

**Browser Storage (localStorage):**
- All Jotai atoms persist to localStorage
- Keys: `vibe`, `cast`, `current_script`, `chaos_level`, `session_code`, `session_state`
- Expiration: 24 hours or Wrap Party completion

**Server Storage (Post-MVP):**
- Session state maintained on server for multi-device sync
- Authoritative source of truth for synchronization
- Browser storage becomes cache, server is source

---

## Data Migration Strategy

**MVP to Post-MVP:**
- Maintain atom interface compatibility
- Server becomes source of truth
- Atoms sync to server on changes
- Backward compatible: Works with or without server

**Versioning:**
- Script version field for regeneration tracking
- Session state version for schema migrations
- Backward compatibility maintained for 2 versions
