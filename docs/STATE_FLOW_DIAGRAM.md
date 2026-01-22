# State Flow Diagram - Skitso Platform

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  (Next.js React Components - Jotai Atoms for Local State)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (PartyKit)
                              │ HTTP REST API (Fallback)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PARTYKIT SERVER                            │
│  (Real-time State Management - Single Source of Truth)          │
│                                                                  │
│  Storage:                                                        │
│  ├── session:{sessionId} → SessionState                         │
│  ├── cast → Character[]                                         │
│  ├── script → Script                                            │
│  └── configuration → SessionConfiguration                       │
└─────────────────────────────────────────────────────────────────┘
```

## Complete State Flow

### 1. SESSION CREATION PHASE

```
┌──────────────────────────────────────────────────────────────┐
│ Director Desk Page                                           │
└──────────────────────────────────────────────────────────────┘
         │
         │ User fills form
         ▼
┌──────────────────────────────────────────────────────────────┐
│ DirectorConfigForm                                           │
│                                                              │
│ 1. Generate sessionCode                                      │
│ 2. Create director participant                               │
│ 3. POST /api/sessions → Create session in PartyKit          │
│    └── Status: 'configuring'                                │
│    └── Stores: vibeContext, configuration                    │
│                                                              │
│ 4. Generate Characters (API call)                           │
│    ├── setCast(characters) [LOCAL STATE]                   │
│    └── ❌ MISSING: updateCast() → PartyKit                 │
│                                                              │
│ 5. Generate Script (API call)                               │
│    ├── setScript(script) [LOCAL STATE]                      │
│    └── ❌ MISSING: updateScript() → PartyKit                │
│                                                              │
│ 6. Generate Images (API call)                               │
│    ├── Update characters [LOCAL STATE]                     │
│    └── ❌ MISSING: updateCast() → PartyKit                 │
│                                                              │
│ 7. POST /api/sessions → Update session                      │
│    └── Stores: cast, script                                 │
│    └── Broadcasts: cast:updated, script:updated             │
│                                                              │
│ 8. updateSessionState('casting')                            │
└──────────────────────────────────────────────────────────────┘
         │
         │ State Updates
         ▼
┌──────────────────────────────────────────────────────────────┐
│ PartyKit Server                                              │
│                                                              │
│ Storage:                                                     │
│ ├── session:{sessionId}                                      │
│ │   ├── status: 'casting'                                    │
│ │   ├── vibeContext                                          │
│ │   └── participants: Map                                    │
│ ├── cast: Character[]                                        │
│ ├── script: Script                                           │
│ └── configuration: SessionConfiguration                      │
│                                                              │
│ Broadcasts:                                                  │
│ ├── cast:updated → All connected clients                    │
│ ├── script:updated → All connected clients                  │
│ └── session:state:updated → All connected clients           │
└──────────────────────────────────────────────────────────────┘
```

### 2. PARTICIPANT JOINING PHASE

```
┌──────────────────────────────────────────────────────────────┐
│ Participant Join Page (/join/[sessionCode])                  │
└──────────────────────────────────────────────────────────────┘
         │
         │ User enters session code
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Load Session Flow                                            │
│                                                              │
│ 1. POST /api/sessions/[sessionCode] (REST API)              │
│    └── Returns: session data (if exists)                    │
│    └── ⚠️  Might be stale if PartyKit has newer data        │
│                                                              │
│ 2. Initialize PartyKit Client                                │
│    └── Connect to WebSocket                                  │
│                                                              │
│ 3. Request state:recover                                     │
│    └── PartyKit responds with full state                    │
│        ├── cast                                             │
│        ├── script                                           │
│        ├── status                                           │
│        └── participants                                     │
│                                                              │
│ 4. Update Local State (Jotai Atoms)                         │
│    ├── setCast(recoveredData.cast)                          │
│    ├── setScript(recoveredData.script)                      │
│    ├── setSessionState(recoveredData.status)                │
│    └── setParticipant(...)                                 │
│                                                              │
│ 5. Listen for Real-time Updates                             │
│    ├── character:assigned                                   │
│    ├── cast:updated                                         │
│    ├── script:updated                                       │
│    └── session:state:updated                                │
└──────────────────────────────────────────────────────────────┘
         │
         │ State Recovery Response
         ▼
┌──────────────────────────────────────────────────────────────┐
│ PartyKit Server                                              │
│                                                              │
│ handleStateRecover()                                         │
│ ├── Get session from storage                                │
│ ├── Get cast from storage                                   │
│ ├── Get script from storage                                 │
│ └── Send state:recovered response                           │
└──────────────────────────────────────────────────────────────┘
```

### 3. CHARACTER ASSIGNMENT PHASE

```
┌──────────────────────────────────────────────────────────────┐
│ Director (CastingCouch Component)                           │
└──────────────────────────────────────────────────────────────┘
         │
         │ User clicks "Assign Character"
         ▼
┌──────────────────────────────────────────────────────────────┐
│ CharacterAssignmentModal                                     │
│                                                              │
│ 1. User selects character + participant                     │
│ 2. Send character:assign message                            │
│    └── { type: 'character:assign',                          │
│          data: { sessionId, characterId, participantId } }  │
└──────────────────────────────────────────────────────────────┘
         │
         │ WebSocket Message
         ▼
┌──────────────────────────────────────────────────────────────┐
│ PartyKit Server                                              │
│                                                              │
│ handleCharacterAssign()                                      │
│ ├── ❌ ISSUE: Get cast from storage                         │
│ │   └── Might be empty if not synced                       │
│ ├── Find character in cast                                 │
│ ├── Update character.participantId                          │
│ ├── Save cast to storage                                    │
│ ├── Broadcast character:assigned                            │
│ └── Broadcast cast:updated                                  │
└──────────────────────────────────────────────────────────────┘
         │
         │ Broadcast Events
         ▼
┌──────────────────────────────────────────────────────────────┐
│ All Connected Clients                                        │
│                                                              │
│ Director (CastingCouch):                                     │
│ ├── Receives character:assigned                             │
│ │   └── Updates cast atom (local state)                    │
│ └── Receives cast:updated                                   │
│     └── Full cast sync                                      │
│                                                              │
│ Participant (Join Page):                                     │
│ ├── Receives character:assigned                             │
│ │   └── Updates participant.characterAssignment            │
│ └── Receives cast:updated                                   │
│     └── Updates cast atom                                   │
└──────────────────────────────────────────────────────────────┘
```

### 4. PRODUCTION START PHASE

```
┌──────────────────────────────────────────────────────────────┐
│ Director (CastingCouch)                                     │
└──────────────────────────────────────────────────────────────┘
         │
         │ User clicks "Start Performance"
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Send performance:start message                               │
└──────────────────────────────────────────────────────────────┘
         │
         │ WebSocket Message
         ▼
┌──────────────────────────────────────────────────────────────┐
│ PartyKit Server                                              │
│                                                              │
│ handlePerformanceStart()                                     │
│ ├── Update session.status = 'performing'                    │
│ ├── Save session state                                      │
│ └── Broadcast performance:started                           │
└──────────────────────────────────────────────────────────────┘
         │
         │ Broadcast Event
         ▼
┌──────────────────────────────────────────────────────────────┐
│ All Connected Clients                                        │
│                                                              │
│ ├── Update sessionState = 'performing'                       │
│ └── Redirect to /stage/[sessionCode]                         │
└──────────────────────────────────────────────────────────────┘
```

## State Synchronization Issues

### Issue 1: Cast/Script Not Synced Immediately

**Current Flow:**
```
Generate Characters → setCast() [LOCAL] → ... → POST /api/sessions → PartyKit
```

**Problem:**
- Cast exists in local state but not in PartyKit
- If participant joins during generation, cast doesn't exist
- If director assigns character, cast might be empty in PartyKit

**Fixed Flow:**
```
Generate Characters → setCast() [LOCAL] → updateCast() → PartyKit [IMMEDIATE]
```

### Issue 2: Director Desk Doesn't Recover State

**Current Flow:**
```
Director Desk Loads → Only requests state:recover if sessionCode exists
```

**Problem:**
- If director refreshes page, might lose state
- If director hasn't connected, participants can't get full state

**Fixed Flow:**
```
Director Desk Loads → Always request state:recover → Sync from PartyKit
```

### Issue 3: Participant Connects After REST API

**Current Flow:**
```
Participant Joins → REST API call → Then connect to PartyKit
```

**Problem:**
- REST API data might be stale
- State recovery happens late
- Might miss real-time updates

**Fixed Flow:**
```
Participant Joins → Connect to PartyKit FIRST → Request state:recover → REST API as fallback
```

### Issue 4: Script Not Sent via updateScript()

**Current Flow:**
```
Generate Script → setScript() [LOCAL] → POST /api/sessions → PartyKit
```

**Problem:**
- Script only synced via REST API
- No real-time script updates
- Director desk might not receive script updates

**Fixed Flow:**
```
Generate Script → setScript() [LOCAL] → updateScript() → PartyKit [IMMEDIATE]
```

## Recommended State Flow (Fixed)

### Director Flow

```
1. Director Desk Loads
   └── Request state:recover [ALWAYS]
   └── Listen for all updates

2. Create Session
   └── POST /api/sessions → PartyKit
   └── Status: 'configuring'

3. Generate Characters
   ├── setCast() [LOCAL]
   └── updateCast() → PartyKit [IMMEDIATE]

4. Generate Script
   ├── setScript() [LOCAL]
   └── updateScript() → PartyKit [IMMEDIATE]

5. Generate Images
   ├── Update characters [LOCAL]
   └── updateCast() → PartyKit [AFTER EACH]

6. Update Status
   └── updateSessionState('casting')

7. Assign Characters
   └── character:assign → PartyKit → Broadcast

8. Start Performance
   └── performance:start → PartyKit → Broadcast
```

### Participant Flow

```
1. Participant Joins
   └── Connect to PartyKit [FIRST]
   └── Request state:recover [IMMEDIATE]

2. Receive State
   ├── Get: cast, script, status, participants
   └── Update local state

3. Listen for Updates
   ├── character:assigned
   ├── cast:updated
   ├── script:updated
   └── session:state:updated

4. Display UI
   ├── If no cast/script: "Waiting..."
   ├── If cast/script: Show ActorPreview
   └── If performing: Redirect to stage
```

## Key Principles

1. **PartyKit is Single Source of Truth**
   - All state stored in PartyKit
   - Local state synced from PartyKit
   - Updates go through PartyKit first

2. **Immediate Synchronization**
   - Cast/script synced immediately after generation
   - No delay between local and PartyKit state
   - Real-time updates via WebSocket

3. **State Recovery on Mount**
   - All clients request state:recover on mount
   - Ensures consistency after refresh
   - Handles late joiners

4. **Real-time Updates**
   - All state changes broadcast to all clients
   - Clients listen for updates
   - Local state updated from broadcasts
