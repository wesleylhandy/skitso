# Event Sequence Diagram - Skitso Platform

This document provides a comprehensive event sequence diagram showing the complete flow from vibe selection through the wrap party, based on actual code references in the codebase.

## Complete Event Flow

```mermaid
sequenceDiagram
    participant Director
    participant Actor
    participant PartyKit as PartyKit Server
    participant NextJS as Next.js App

    Note over Director,NextJS: Phase 1: Vibe Selection & Session Creation
    
    Director->>NextJS: Navigate to /vibe-selection
    Director->>NextJS: Select Vibe (VIRAL_NEON, INDIE_A24, etc.)
    NextJS->>NextJS: Set vibeAtom
    Director->>NextJS: Navigate to /director-desk
    
    Note over Director,PartyKit: Phase 2: Session Initialization
    
    Director->>NextJS: Load /director-desk
    NextJS->>PartyKit: initializePartyKitClient(tempRoomId)
    PartyKit-->>NextJS: WebSocket connection established
    
    Director->>NextJS: Fill DirectorConfigForm<br/>(title, description, etc.)
    Director->>NextJS: Submit form (generate script/characters)
    NextJS->>NextJS: Set sessionState = 'configuring'
    NextJS->>NextJS: Generate sessionCode
    NextJS->>PartyKit: POST /parties/main/{sessionCode}/create<br/>{vibeContext, configuration}
    PartyKit->>PartyKit: Create/update session state<br/>(status: 'casting', vibeLockedAt: null)
    PartyKit-->>NextJS: Session created/updated
    
    NextJS->>PartyKit: initializePartyKitClient(sessionCode)
    NextJS->>PartyKit: send('session:join', {role: 'director', vibeContext})
    PartyKit->>PartyKit: handleSessionJoin()
    PartyKit->>PartyKit: Create/update participant<br/>(role: 'director')
    PartyKit-->>NextJS: broadcast('session:joined')
    PartyKit-->>NextJS: send('session:joined', {participants, vibeContext})
    
    NextJS->>NextJS: Start AI generation (script + characters)
    NextJS->>PartyKit: send('generation:progress', {phase, message})
    PartyKit->>PartyKit: handleGenerationProgress()
    PartyKit-->>NextJS: broadcast('generation:progress')
    
    NextJS->>PartyKit: send('script:update', {script})
    PartyKit->>PartyKit: handleScriptUpdate()<br/>(requireDirector check)
    PartyKit->>PartyKit: Save script to storage
    PartyKit-->>NextJS: broadcast('script:updated')
    
    NextJS->>PartyKit: send('cast:update', {cast[]})
    PartyKit->>PartyKit: handleCastUpdate()<br/>(requireDirector check)
    PartyKit->>PartyKit: Merge with existing cast<br/>Store images separately<br/>Convert data URLs to HTTP URLs
    PartyKit->>PartyKit: Save cast to storage
    PartyKit-->>NextJS: broadcast('cast:updated', {cast with HTTP URLs})
    
    NextJS->>PartyKit: send('session:state:update', {status: 'casting'})
    PartyKit->>PartyKit: handleSessionStateUpdate()<br/>(requireDirector check)
    PartyKit->>PartyKit: Update session.status = 'casting'
    PartyKit-->>NextJS: broadcast('session:state:updated', {status: 'casting'})
    
    Note over Actor,PartyKit: Phase 3: Actor Joining
    
    Actor->>NextJS: Navigate to /join/{sessionCode}
    NextJS->>PartyKit: initializePartyKitClient(sessionCode)
    NextJS->>PartyKit: send('state:recover', {sessionId, timestamp})
    PartyKit->>PartyKit: handleStateRecover()
    PartyKit-->>NextJS: send('state:recovered', {recovered: true})
    NextJS->>PartyKit: GET /parties/main/{sessionCode}/state
    PartyKit-->>NextJS: {vibeContext, status, cast, script, participants}
    NextJS->>NextJS: Hydrate state (vibe, cast, script, sessionState)
    
    Actor->>NextJS: Fill SessionJoinForm (name)
    Actor->>NextJS: Submit join form
    NextJS->>PartyKit: POST /parties/main/{sessionCode}/join<br/>{name, deviceInfo}
    PartyKit->>PartyKit: handleSessionJoin() (HTTP endpoint)
    PartyKit->>PartyKit: Create participant<br/>(role: 'actor', participantId)
    PartyKit->>PartyKit: Auto-assign first unassigned character<br/>(if available)
    PartyKit->>PartyKit: Save participant to session
    PartyKit-->>NextJS: {participant, session, characterAssignment}
    
    NextJS->>PartyKit: send('session:join', {participantId, role: 'actor', name})
    PartyKit->>PartyKit: handleSessionJoin() (WebSocket)
    PartyKit->>PartyKit: Update participant connectionId
    PartyKit-->>NextJS: broadcast('participant:joined')
    PartyKit-->>NextJS: send('session:joined', {participants})
    
    NextJS->>PartyKit: GET /parties/main/{sessionCode}/events?since={timestamp}
    PartyKit-->>NextJS: {events[]}
    NextJS->>NextJS: replayEvents()<br/>(idempotency checks)
    
    Note over Director,Actor: Phase 4: Character Assignment
    
    Actor->>NextJS: Request character assignment
    NextJS->>PartyKit: send('assignment:request', {participantId, characterId})
    PartyKit->>PartyKit: handleAssignmentRequest()
    PartyKit-->>NextJS: broadcast('assignment:requested')
    PartyKit->>PartyKit: logEvent('assignment:requested')
    
    Director->>NextJS: Approve assignment request
    NextJS->>PartyKit: send('assignment:approve', {participantId, characterId})
    PartyKit->>PartyKit: handleAssignmentApprove()<br/>(requireDirector check)
    PartyKit->>PartyKit: Update cast (participantId, isLocked: false)
    PartyKit->>PartyKit: Save cast
    PartyKit-->>NextJS: broadcast('assignment:approved')
    PartyKit->>PartyKit: logEvent('assignment:approved')
    PartyKit-->>NextJS: broadcast('cast:updated')
    
    Actor->>NextJS: Confirm assignment
    NextJS->>PartyKit: send('assignment:confirm', {participantId, characterId})
    PartyKit->>PartyKit: handleAssignmentConfirm()
    PartyKit->>PartyKit: Update cast (isLocked: true)
    PartyKit->>PartyKit: Save cast
    PartyKit-->>NextJS: broadcast('assignment:confirmed')
    PartyKit->>PartyKit: logEvent('assignment:confirmed')
    PartyKit-->>NextJS: broadcast('cast:updated')
    
    alt Director Direct Assignment
        Director->>NextJS: Assign character directly
        NextJS->>PartyKit: send('character:assign', {participantId, characterId})
        PartyKit->>PartyKit: handleCharacterAssign()<br/>(requireDirector check)
        PartyKit->>PartyKit: Update cast (participantId, isLocked: false)
        PartyKit->>PartyKit: Save cast
        PartyKit-->>NextJS: broadcast('character:assigned')
        PartyKit->>PartyKit: logEvent('character:assigned')
        PartyKit-->>NextJS: broadcast('cast:updated')
    end
    
    Note over Director,PartyKit: Phase 5: Performance Start
    
    Director->>NextJS: Click "Start Performance" in CastingCouch
    NextJS->>PartyKit: send('performance:start', {sessionId})
    PartyKit->>PartyKit: handlePerformanceStart()<br/>(requireDirector check)<br/>(verify min 2 participants)
    PartyKit->>PartyKit: Update session.status = 'performing'<br/>Set vibeLockedAt = Date.now()
    PartyKit->>PartyKit: Save session state
    PartyKit-->>NextJS: broadcast('session:state:updated', {status: 'performing'})
    PartyKit-->>NextJS: broadcast('performance:started')
    
    NextJS->>NextJS: Navigate Director to /stage/{sessionCode}
    NextJS->>NextJS: Navigate Actors to /stage/{sessionCode}<br/>(via performance:started event)
    
    Note over Director,Actor: Phase 6: Performance (Teleprompter)
    
    Director->>NextJS: Load /stage/{sessionCode}
    Actor->>NextJS: Load /stage/{sessionCode}
    NextJS->>PartyKit: send('state:recover')
    PartyKit-->>NextJS: Full state (script, cast, status: 'performing')
    
    Director->>NextJS: Start teleprompter (first line)
    NextJS->>PartyKit: send('performance:advance', {progress})
    PartyKit->>PartyKit: handlePerformanceAdvance()
    PartyKit-->>NextJS: broadcast('performance:progress', {progress})
    
    loop For each script line
        alt Director advances
            Director->>NextJS: Advance script (button/keyboard)
            NextJS->>PartyKit: send('performance:advance', {currentLineIndex++})
            PartyKit-->>NextJS: broadcast('performance:progress')
        else Actor advances
            Actor->>NextJS: Advance script (button/keyboard)
            NextJS->>PartyKit: send('performance:advance', {currentLineIndex++})
            PartyKit-->>NextJS: broadcast('performance:progress')
        end
        
        NextJS->>NextJS: Update teleprompter UI<br/>(all participants see same line)
    end
    
    alt Director pauses
        Director->>NextJS: Pause performance
        NextJS->>PartyKit: send('performance:advance', {pausedAt})
        PartyKit-->>NextJS: broadcast('performance:progress')
    end
    
    alt Director resumes
        Director->>NextJS: Resume performance
        NextJS->>PartyKit: send('performance:advance', {pausedAt: null})
        PartyKit-->>NextJS: broadcast('performance:progress')
    end
    
    Note over Director,PartyKit: Phase 7: Performance End
    
    Director->>NextJS: End performance (exit button/ESC)
    NextJS->>NextJS: setSessionState('completed')
    NextJS->>PartyKit: send('session:state:update', {status: 'completed'})
    PartyKit->>PartyKit: handleSessionStateUpdate()<br/>(requireDirector check)
    PartyKit->>PartyKit: Update session.status = 'completed'
    PartyKit->>PartyKit: Save session state
    PartyKit-->>NextJS: broadcast('session:state:updated', {status: 'completed'})
    
    NextJS->>NextJS: Navigate Director to /wrap-party/{sessionCode}
    NextJS->>NextJS: Navigate Actors to /wrap-party/{sessionCode}<br/>(via session:state:updated event)
    
    Note over Director,Actor: Phase 8: Wrap Party
    
    Director->>NextJS: Load /wrap-party/{sessionCode}
    Actor->>NextJS: Load /wrap-party/{sessionCode}
    NextJS->>PartyKit: send('state:recover')
    PartyKit-->>NextJS: Full state (wrapPartyData if exists)
    NextJS->>NextJS: Hydrate wrapPartyDataAtom
    
    Actor->>NextJS: Submit vote
    NextJS->>PartyKit: send('wrap-party:vote', {vote})
    PartyKit->>PartyKit: handleWrapPartyVote()<br/>(validate participant, category, value)<br/>(check duplicate votes)
    PartyKit-->>NextJS: broadcast('wrap-party:vote')
    
    Director->>NextJS: View voting results
    NextJS->>NextJS: Aggregate votes from wrapPartyData
    NextJS->>PartyKit: send('wrap-party:update', {wrapPartyData})
    PartyKit->>PartyKit: handleWrapPartyUpdate()<br/>(requireDirector check)
    PartyKit->>PartyKit: Save wrapPartyData to storage
    PartyKit-->>NextJS: broadcast('wrap-party:updated')
    
    Director->>NextJS: Share results (social share)
    Actor->>NextJS: Share results (social share)
    
    Note over Director,PartyKit: Phase 9: Session Cleanup (24 hours)
    
    PartyKit->>PartyKit: Session expires (expiresAt check)
    PartyKit->>PartyKit: Delete session storage
    PartyKit->>NextJS: notifyCloudinaryDeleteSession(sessionId)
    NextJS->>NextJS: Cleanup Cloudinary images
```

## Event Types Reference

### PartyKit Message Types (Client → Server)

1. **session:join** - Join a session (director or actor)
2. **session:leave** - Leave a session
3. **vibe:change** - Change vibe context (director only, blocked if locked)
4. **script:update** - Update script (director only)
5. **cast:update** - Update cast array (director only)
6. **session:state:update** - Update session status (director only)
7. **performance:advance** - Advance script line during performance
8. **performance:start** - Start performance (director only)
9. **wrap-party:vote** - Submit a vote
10. **wrap-party:update** - Update wrap party data (director only)
11. **character:override** - Override character assignment
12. **character:assign** - Assign character directly (director only)
13. **assignment:request** - Actor requests character assignment
14. **assignment:approve** - Director approves request (director only)
15. **assignment:suggest** - Director suggests different character (director only)
16. **assignment:confirm** - Actor confirms assignment
17. **state:recover** - Request state recovery
18. **generation:progress** - Broadcast generation progress (director → all)

### PartyKit Broadcast Types (Server → All Clients)

1. **session:joined** - Confirmation of session join
2. **participant:joined** - New participant joined
3. **participant:left** - Participant left
4. **vibe:changed** - Vibe context changed
5. **script:updated** - Script was updated
6. **cast:updated** - Cast array was updated
7. **session:state:updated** - Session status changed
8. **performance:progress** - Script advancement progress
9. **performance:started** - Performance started
10. **wrap-party:vote** - Vote was submitted
11. **wrap-party:updated** - Wrap party data updated
12. **character:overridden** - Character assignment overridden
13. **character:assigned** - Character was assigned
14. **assignment:requested** - Assignment request made
15. **assignment:approved** - Assignment approved
16. **assignment:suggested** - Assignment suggested
17. **assignment:confirmed** - Assignment confirmed
18. **state:recovered** - State recovery acknowledgment
19. **generation:progress** - Generation progress update
20. **error** - Error message

## Session States

1. **idle** - Initial state, no session
2. **configuring** - Director configuring session, generating content
3. **casting** - Session ready, actors joining and being assigned characters
4. **performing** - Performance in progress
5. **completed** - Performance ended, wrap party active
6. **expired** - Session expired (24 hours)

## Key State Transitions

1. **idle → configuring**: Director submits configuration form
2. **configuring → casting**: Script and cast generation complete
3. **casting → performing**: Director starts performance
4. **performing → completed**: Director ends performance
5. **completed → expired**: 24 hours after session creation

## Critical Gaps Identified

### 1. Vibe Locking
- **Gap**: Vibe can be changed until `vibeLockedAt` is set
- **When locked**: Set to `Date.now()` when performance starts
- **Code reference**: `parties/session.ts:1360` - `vibeLockedAt = sessionState.vibeLockedAt ?? Date.now()`

### 2. Director Disconnection During Performance
- **Gap**: If director disconnects during performance, state reverts to 'casting'
- **Code reference**: `parties/session.ts:424-456` - Director exit handling
- **Impact**: Actors may be kicked out of performance view

### 3. State Recovery
- **Gap**: State recovery uses minimal WebSocket message, full state via HTTP GET
- **Code reference**: `parties/session.ts:2037-2084` - `handleStateRecover()`
- **Reason**: WebSocket message size limits (576 bytes in workerd)

### 4. Image Storage
- **Gap**: Data URLs stored separately from cast array to avoid size limits
- **Code reference**: `parties/session.ts:1068-1160` - Image storage logic
- **Reason**: PartyKit storage value limit (128 KiB)

### 5. Event Replay
- **Gap**: Events logged for replay on reconnection
- **Code reference**: `parties/session.ts:341-390` - `logEvent()`
- **Limitation**: Max 100 events, 1 hour retention

### 6. Wrap Party Data Persistence
- **Gap**: Wrap party data persists for 24 hours after session creation
- **Code reference**: `parties/session.ts:1479-1491` - `handleWrapPartyUpdate()`
- **Note**: Data persists even after session expires

### 7. Character Assignment States
- **Gap**: Three states: none → pending (participantId set, isLocked: false) → locked (isLocked: true)
- **Code reference**: Multiple handlers in `parties/session.ts`
- **Critical**: Only locked assignments shown from state recovery

### 8. Performance Progress Synchronization
- **Gap**: Progress broadcast on every advance, no batching
- **Code reference**: `parties/session.ts:1294-1315` - `handlePerformanceAdvance()`
- **Note**: All participants receive every advancement event

## Code References

- **Session Server**: `parties/session.ts`
- **Director Desk**: `src/app/director-desk/page.tsx`
- **Join Page**: `src/app/join/[sessionCode]/page.tsx`
- **Stage Page**: `src/app/stage/[sessionCode]/page.tsx`
- **Wrap Party**: `src/app/wrap-party/[sessionCode]/page.tsx`
- **Teleprompter**: `src/components/teleprompter/teleprompter.tsx`
- **Casting Couch**: `src/components/director/casting-couch.tsx`
- **PartyKit Client**: `src/lib/partykit/client.ts`
