# State Flow Analysis & System Architecture

## Current System Flow

### Phase 1: Session Creation & Generation

```
Director Desk Page
├── DirectorConfigForm
│   ├── User fills form
│   ├── Generate sessionCode (if not exists)
│   ├── Create participant (director role)
│   ├── [NEW] Create session in PartyKit (before generation)
│   │   └── POST /api/sessions → PartyKit /create
│   │       └── Stores: sessionId, vibeContext, configuration
│   │       └── Status: 'casting'
│   │
│   ├── Generate characters (API call)
│   │   └── setCast(characters) [LOCAL STATE ONLY]
│   │
│   ├── Generate script (API call)
│   │   └── setScript(script) [LOCAL STATE ONLY]
│   │
│   ├── Generate images (API call)
│   │   └── Updates characters with imageUrl [LOCAL STATE ONLY]
│   │
│   ├── Update session in PartyKit (after generation)
│   │   └── POST /api/sessions → PartyKit /create (updates existing)
│   │       └── Stores: cast, script
│   │       └── Broadcasts: cast:updated, script:updated
│   │
│   └── [NEW] Explicitly send cast to PartyKit
│       └── updateCast(sessionCode, characters)
│           └── Sends: cast:update message
│           └── PartyKit: handleCastUpdate()
│               └── Stores: cast in storage
│               └── Broadcasts: cast:updated
│
└── DirectorDeskPage
    ├── Listens for: script:updated, cast:updated, session:state:updated
    ├── Requests: state:recover (when sessionCode exists)
    └── Shows: CastingCouch (if cast.length > 0 && participant exists)
```

**ISSUES:**
1. ❌ Cast/script stored locally first, then synced - race condition
2. ❌ Director desk doesn't request state recovery until sessionCode exists
3. ❌ Cast sent twice: once via /api/sessions, once via updateCast()
4. ❌ Script never explicitly sent via updateScript() - only via /api/sessions

### Phase 2: Participant Joining

```
Participant Join Page (/join/[sessionCode])
├── Load session via REST API
│   └── POST /api/sessions/[sessionCode]
│       └── Returns: session data (if exists)
│
├── Connect to PartyKit
│   ├── Initialize client
│   ├── Request state:recover
│   │   └── PartyKit responds with: cast, script, status, participants
│   │
│   └── Listen for:
│       ├── character:assigned
│       ├── cast:updated
│       ├── script:updated
│       ├── session:state:updated
│       └── performance:started
│
└── Display based on state:
    ├── If no participant: Show join form
    ├── If participant + no cast/script: "Waiting for director..."
    ├── If participant + cast/script: Show ActorPreview
    └── If performing: Redirect to stage
```

**ISSUES:**
1. ❌ State recovery happens after REST API call - might miss updates
2. ❌ Participant might join before cast/script generated - shows waiting
3. ❌ Character assignment sync happens in useEffect - might miss updates

### Phase 3: Character Assignment

```
Director (CastingCouch)
├── User clicks "Assign Character"
│   └── Opens CharacterAssignmentModal
│
├── User selects character + participant
│   └── Sends: character:assign message
│
└── PartyKit Server
    ├── handleCharacterAssign()
    │   ├── Gets cast from storage
    │   ├── Updates character.participantId
    │   ├── Saves cast to storage
    │   ├── Broadcasts: character:assigned
    │   └── Broadcasts: cast:updated
    │
    └── Clients receive:
        ├── character:assigned event
        │   └── Updates cast atom (CastingCouch)
        │   └── Updates participant.characterAssignment (JoinPage)
        │
        └── cast:updated event
            └── Full cast sync (all clients)
```

**ISSUES:**
1. ❌ Cast might be empty in storage when assignment happens
2. ❌ Director's local cast might be stale
3. ❌ Participant might not receive assignment if not connected

### Phase 4: Production Start

```
Director (CastingCouch)
├── User clicks "Start Performance"
│   └── Sends: performance:start message
│
└── PartyKit Server
    ├── handlePerformanceStart()
    │   ├── Updates session.status = 'performing'
    │   ├── Saves session state
    │   └── Broadcasts: performance:started
    │
    └── Clients receive:
        ├── performance:started event
        │   └── Updates sessionState = 'performing'
        │   └── Redirects to /stage/[sessionCode]
        │
        └── session:state:updated event
            └── Updates sessionState atom
```

## State Synchronization Issues

### Problem 1: Dual State Storage
- **Local State (Jotai)**: Updated immediately for UI responsiveness
- **PartyKit Storage**: Source of truth, but updates are async
- **Issue**: Local state can be out of sync with PartyKit

### Problem 2: Missing State Recovery
- **Director Desk**: Only requests state recovery if sessionCode exists
- **Issue**: If director refreshes page, might lose state
- **Issue**: If director hasn't connected, participants can't get full state

### Problem 3: Race Conditions
- **Cast Generation**: Stored locally first, then synced
- **Issue**: If participant joins during generation, cast doesn't exist in PartyKit
- **Issue**: If director assigns before cast synced, assignment fails

### Problem 4: Incomplete State Sync
- **Script Updates**: Only sent via /api/sessions, not via updateScript()
- **Issue**: If script updated after session creation, might not sync
- **Issue**: Director desk might not receive script updates

## Recommended Flow (Fixed)

### Phase 1: Session Creation & Generation (FIXED)

```
Director Desk Page
├── DirectorConfigForm
│   ├── User fills form
│   ├── Generate sessionCode
│   ├── Create participant (director)
│   │
│   ├── [FIXED] Create session in PartyKit FIRST
│   │   └── POST /api/sessions
│   │       └── Stores: sessionId, vibeContext, configuration
│   │       └── Status: 'configuring'
│   │       └── Broadcasts: session:state:updated
│   │
│   ├── Generate characters
│   │   └── setCast(characters) [LOCAL]
│   │   └── [FIXED] updateCast() IMMEDIATELY
│   │       └── PartyKit stores cast
│   │       └── Broadcasts: cast:updated
│   │
│   ├── Generate script
│   │   └── setScript(script) [LOCAL]
│   │   └── [FIXED] updateScript() IMMEDIATELY
│   │       └── PartyKit stores script
│   │       └── Broadcasts: script:updated
│   │
│   ├── Generate images
│   │   └── Updates characters [LOCAL]
│   │   └── [FIXED] updateCast() after each image
│   │
│   └── [FIXED] Update session status to 'casting'
│       └── updateSessionState('casting')
│
└── DirectorDeskPage
    ├── [FIXED] Always request state:recover on mount
    ├── Listens for: ALL state updates
    └── Shows: CastingCouch when ready
```

### Phase 2: Participant Joining (FIXED)

```
Participant Join Page
├── [FIXED] Connect to PartyKit FIRST
│   ├── Initialize client
│   ├── Request state:recover IMMEDIATELY
│   │   └── Gets: cast, script, status, participants
│   │
│   └── Listen for: ALL state updates
│
├── [FIXED] Load session via REST API (fallback only)
│   └── Only if PartyKit fails
│
└── [FIXED] Display based on PartyKit state
    ├── If no cast/script: "Waiting for director..."
    ├── If cast/script exists: Show ActorPreview
    └── If performing: Redirect to stage
```

### Phase 3: Character Assignment (FIXED)

```
Director (CastingCouch)
├── [FIXED] Request state:recover on mount
│   └── Ensures cast is up-to-date
│
├── User assigns character
│   └── Sends: character:assign
│
└── PartyKit Server
    ├── [FIXED] Verify cast exists in storage
    ├── [FIXED] Update cast
    ├── [FIXED] Save cast
    ├── [FIXED] Broadcast: character:assigned
    └── [FIXED] Broadcast: cast:updated
```

## UX Flow Evaluation

### Current UX Issues

1. **Director Experience**
   - ❌ Can't see participants until cast generated
   - ❌ Can't assign characters until cast synced
   - ❌ State might be lost on refresh

2. **Participant Experience**
   - ❌ Might see "waiting" even if cast exists
   - ❌ Might not receive character assignment
   - ❌ State might be stale

3. **State Consistency**
   - ❌ Local state vs PartyKit state can diverge
   - ❌ No single source of truth
   - ❌ Race conditions during generation

### Recommended UX Flow

1. **Director Experience (FIXED)**
   - ✅ Session created immediately
   - ✅ Can see participants as they join
   - ✅ Cast/script synced immediately after generation
   - ✅ State always synced with PartyKit

2. **Participant Experience (FIXED)**
   - ✅ Connects to PartyKit immediately
   - ✅ Gets full state via state:recover
   - ✅ Receives real-time updates
   - ✅ Always sees current state

3. **State Consistency (FIXED)**
   - ✅ PartyKit is single source of truth
   - ✅ Local state synced from PartyKit
   - ✅ All updates go through PartyKit first
   - ✅ State recovery ensures consistency

## Implementation Checklist

### Critical Fixes Needed

- [ ] **1. Send cast/script to PartyKit immediately after generation**
  - [ ] Call `updateCast()` after character generation
  - [ ] Call `updateScript()` after script generation
  - [ ] Call `updateCast()` after each image generation

- [ ] **2. Director desk always requests state recovery**
  - [ ] Request state:recover on mount (not just when sessionCode exists)
  - [ ] Handle state:recovered response
  - [ ] Sync local state from PartyKit

- [ ] **3. Participant always connects to PartyKit first**
  - [ ] Connect before REST API call
  - [ ] Request state:recover immediately
  - [ ] Use REST API only as fallback

- [ ] **4. Ensure cast exists before assignment**
  - [ ] Verify cast in storage before assignment
  - [ ] Request state:recover if cast empty
  - [ ] Show error if cast still empty

- [ ] **5. Add updateScript() function**
  - [ ] Create updateScript() in client.ts
  - [ ] Add handleScriptUpdate() in PartyKit (already exists, verify it stores)
  - [ ] Call updateScript() after script generation

- [ ] **6. Remove duplicate state storage**
  - [ ] Remove cast/script from /api/sessions POST (or make it optional)
  - [ ] Use updateCast()/updateScript() for all updates
  - [ ] Keep /api/sessions POST only for initial session creation

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    DIRECTOR FLOW                            │
└─────────────────────────────────────────────────────────────┘

1. Director Desk Page Loads
   ├── Request state:recover
   └── Listen for updates

2. Director Fills Form
   ├── Create session in PartyKit (status: 'configuring')
   └── Generate sessionCode

3. Generate Content
   ├── Generate characters
   │   ├── setCast() [LOCAL]
   │   └── updateCast() → PartyKit [IMMEDIATE]
   │
   ├── Generate script
   │   ├── setScript() [LOCAL]
   │   └── updateScript() → PartyKit [IMMEDIATE]
   │
   └── Generate images
       ├── Update characters [LOCAL]
       └── updateCast() → PartyKit [AFTER EACH]

4. Status: 'casting'
   └── updateSessionState('casting')

5. Assign Characters
   ├── Send character:assign
   └── PartyKit updates & broadcasts

6. Start Performance
   ├── Send performance:start
   └── Status: 'performing'


┌─────────────────────────────────────────────────────────────┐
│                  PARTICIPANT FLOW                           │
└─────────────────────────────────────────────────────────────┘

1. Participant Joins
   ├── Connect to PartyKit [FIRST]
   ├── Request state:recover [IMMEDIATE]
   └── Listen for updates

2. Receive State
   ├── Get: cast, script, status, participants
   └── Update local state

3. Wait for Assignment
   ├── If cast exists: Show ActorPreview
   └── If no cast: Show "Waiting..."

4. Receive Assignment
   ├── character:assigned event
   └── Update participant.characterAssignment

5. Performance Starts
   ├── performance:started event
   └── Redirect to stage
```

## Conclusion

The main issues are:
1. **State not synced immediately** - Cast/script stored locally first
2. **Missing state recovery** - Director desk doesn't always recover state
3. **Race conditions** - Participants can join before cast exists
4. **Incomplete sync** - Script not sent via updateScript()

The fixes ensure:
1. **PartyKit is single source of truth** - All updates go through PartyKit
2. **Immediate sync** - Cast/script synced immediately after generation
3. **State recovery** - All clients request state on mount
4. **Consistent state** - Local state always synced from PartyKit
