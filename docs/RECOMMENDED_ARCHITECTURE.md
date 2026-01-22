# Recommended Architecture - Complete System Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│  Next.js React Components + Jotai Atoms (Local State Cache)          │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Director     │  │ Participant  │  │ Stage       │              │
│  │ Desk         │  │ Join Page    │  │ Page        │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                  │                  │                     │
│         └──────────────────┼──────────────────┘                     │
│                            │                                         │
│                   ┌───────────────┐                                │
│                   │ PartyKit Client│                                │
│                   │  - Connection  │                                │
│                   │  - Message Queue│                                │
│                   │  - State Sync  │                                │
│                   └───────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket + HTTP REST (Fallback)
                            │
┌─────────────────────────────────────────────────────────────────────┐
│                      PARTYKIT SERVER                                 │
│  Real-time State Management (Single Source of Truth)                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Message Handlers                                           │    │
│  │  - Authorization Layer                                     │    │
│  │  - Validation Layer                                        │    │
│  │  - State Management                                        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Storage (Durable State)                                    │    │
│  │  - session:{sessionId} → SessionState                      │    │
│  │  - cast → Character[]                                      │    │
│  │  - script → Script                                          │    │
│  │  - configuration → SessionConfiguration                    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Broadcast System                                            │    │
│  │  - Real-time updates to all connected clients              │    │
│  │  - Event ordering                                           │    │
│  │  - Message deduplication                                    │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## State Flow (Fixed Architecture)

### Director Flow - Complete

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Director Desk Page Loads                                  │
│    ├── Initialize PartyKit Client                            │
│    ├── Request state:recover [ALWAYS]                       │
│    ├── Listen for: ALL state updates                        │
│    └── Show: Config Form OR Casting Couch                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Director Fills Config Form                                │
│    ├── Generate sessionCode                                  │
│    ├── Create director participant                           │
│    └── POST /api/sessions → Create session                  │
│        └── Status: 'configuring'                             │
│        └── Stores: vibeContext, configuration               │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Generate Characters                                       │
│    ├── API Call: /api/openai/characters                     │
│    ├── setCast(characters) [LOCAL - Optimistic]             │
│    └── updateCast(sessionCode, characters) [IMMEDIATE]       │
│        └── PartyKit: handleCastUpdate()                      │
│            ├── Store cast in storage                         │
│            └── Broadcast: cast:updated → All clients         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Generate Script                                           │
│    ├── API Call: /api/openai/script                          │
│    ├── setScript(script) [LOCAL - Optimistic]                │
│    └── updateScript(sessionCode, script) [IMMEDIATE]       │
│        └── PartyKit: handleScriptUpdate()                     │
│            ├── Store script in storage                       │
│            └── Broadcast: script:updated → All clients        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Generate Images (Parallel)                                │
│    ├── For each character:                                   │
│    │   ├── API Call: /api/openai/character-image            │
│    │   ├── Update character.imageUrl [LOCAL]                 │
│    │   └── updateCast() [AFTER EACH]                         │
│    └── All clients receive real-time image updates           │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Update Status to 'casting'                                │
│    └── updateSessionState('casting')                         │
│        └── PartyKit: Updates status                          │
│            └── Broadcast: session:state:updated              │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Director Sees Casting Couch                               │
│    ├── Shows: Participants, Cast, Script                     │
│    ├── Can assign characters                                 │
│    └── Can start performance                                 │
└──────────────────────────────────────────────────────────────┘
```

### Participant Flow - Complete

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Participant Enters Session Code                            │
│    └── Navigate to /join/[sessionCode]                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Connect to PartyKit [FIRST]                               │
│    ├── Initialize PartyKit Client                             │
│    ├── Wait for connection                                    │
│    └── Request state:recover [IMMEDIATE]                    │
│        └── PartyKit responds with full state                 │
│            ├── cast                                           │
│            ├── script                                         │
│            ├── status                                         │
│            └── participants                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Update Local State from PartyKit                          │
│    ├── setCast(recoveredData.cast)                          │
│    ├── setScript(recoveredData.script)                      │
│    ├── setSessionState(recoveredData.status)                │
│    └── Check for character assignment                        │
│        └── If assigned: setParticipant(...)                 │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Listen for Real-time Updates                             │
│    ├── character:assigned                                     │
│    ├── cast:updated                                           │
│    ├── script:updated                                         │
│    └── session:state:updated                                  │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Display UI Based on State                                │
│    ├── If no cast/script: "Waiting for director..."         │
│    ├── If cast/script + no assignment: Show ActorPreview    │
│    ├── If assigned: Show character details                   │
│    └── If performing: Redirect to stage                      │
└──────────────────────────────────────────────────────────────┘
```

### Character Assignment Flow - Complete (Fixed)

```
┌──────────────────────────────────────────────────────────────┐
│ Director: Click "Assign Character"                           │
│    └── Opens CharacterAssignmentModal                        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Director: Select Character + Participant                     │
│    └── Click "Assign"                                        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Client: Optimistic Update                                    │
│    ├── Update cast atom immediately [LOCAL]                  │
│    ├── Show loading state                                    │
│    └── Send character:assign message                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ PartyKit Server: handleCharacterAssign()                     │
│    ├── [NEW] Verify sender is director                       │
│    ├── [NEW] Verify participant exists                        │
│    ├── Get cast from storage                                 │
│    ├── [NEW] Verify character exists                          │
│    ├── [NEW] Check character not already assigned             │
│    ├── Update character.participantId                        │
│    ├── Save cast to storage                                  │
│    ├── Broadcast: character:assigned                         │
│    └── Broadcast: cast:updated                                │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ All Clients: Receive Updates                                 │
│    ├── Director (CastingCouch):                               │
│    │   ├── Receives character:assigned                       │
│    │   │   └── Updates cast atom [Already optimistic]        │
│    │   └── Receives cast:updated                             │
│    │       └── Full cast sync [Confirms optimistic]          │
│    │                                                          │
│    └── Participant (Join Page):                                │
│        ├── Receives character:assigned                       │
│        │   └── Updates participant.characterAssignment       │
│        └── Receives cast:updated                             │
│            └── Updates cast atom                             │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Client: Show Success Feedback                                │
│    ├── [NEW] Show success toast                              │
│    ├── Hide loading state                                    │
│    └── Close modal                                           │
└──────────────────────────────────────────────────────────────┘
```

## Reconnection Flow (Fixed)

```
┌──────────────────────────────────────────────────────────────┐
│ Network Disconnection Detected                               │
│    └── WebSocket close/error event                           │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Client: Handle Disconnection                                 │
│    ├── Set connectionStatus = 'disconnected'                 │
│    ├── Queue pending messages                                │
│    └── Schedule reconnection (exponential backoff)            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Client: Reconnection Attempt                                 │
│    ├── Wait for backoff delay                                │
│    ├── Initialize new WebSocket connection                   │
│    └── Wait for 'open' event                                 │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Client: On Reconnect [NEW]                                   │
│    ├── Set connectionStatus = 'connected'                    │
│    ├── [NEW] Request state:recover [AUTO]                    │
│    ├── [NEW] Replay message queue                            │
│    └── [NEW] Re-register event listeners                     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ PartyKit: Respond to State Recovery                          │
│    ├── Get session from storage                              │
│    ├── Get cast from storage                                 │
│    ├── Get script from storage                               │
│    └── Send state:recovered response                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Client: Sync State from PartyKit                             │
│    ├── Update cast atom                                      │
│    ├── Update script atom                                    │
│    ├── Update sessionState atom                              │
│    └── Update participant state                              │
└──────────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

### 1. **PartyKit as Single Source of Truth**
- All state stored in PartyKit storage
- Local state (Jotai) is cache only
- All updates go through PartyKit first
- State recovery ensures consistency

### 2. **Immediate Synchronization**
- Cast/script synced immediately after generation
- No delay between local and PartyKit state
- Real-time updates via WebSocket broadcasts

### 3. **Optimistic Updates with Rollback**
- UI updates immediately for responsiveness
- Server confirms or rejects
- Rollback on failure with error feedback

### 4. **Resilient Connection Management**
- Auto-reconnection with exponential backoff
- Message queuing during disconnection
- State recovery on reconnect
- Connection status visible to users

### 5. **Security & Validation**
- Authorization checks for all operations
- Participant/character validation
- Conflict detection and resolution

### 6. **User Feedback & UX**
- Success/error feedback for all actions
- Loading states during operations
- Connection status indicators
- Clear error messages

## State Consistency Guarantees

### Before Fixes
- ❌ Local state can diverge from PartyKit
- ❌ Race conditions during generation
- ❌ Stale state after reconnection
- ❌ Lost messages during disconnection

### After Fixes
- ✅ PartyKit is single source of truth
- ✅ Immediate sync after generation
- ✅ Auto state recovery on reconnect
- ✅ Message queue prevents data loss
- ✅ Optimistic updates with rollback
- ✅ Authorization prevents unauthorized actions

## Performance Considerations

### Optimizations
1. **Debounced State Recovery**: Prevent rapid-fire requests
2. **Incremental Updates**: Only send changed data when possible
3. **Message Deduplication**: Prevent duplicate processing
4. **Connection Pooling**: Reuse connections when possible
5. **Lazy Loading**: Load data only when needed

### Monitoring
1. **Connection Metrics**: Track connection health
2. **Message Latency**: Monitor message delivery time
3. **State Sync Time**: Track state recovery duration
4. **Error Rates**: Monitor failed operations

## Testing Strategy

### Unit Tests
- Authorization checks
- State validation
- Message handling

### Integration Tests
- State synchronization
- Reconnection flow
- Message queuing

### E2E Tests
- Complete director flow
- Complete participant flow
- Character assignment
- Production start

### Load Tests
- Multiple concurrent participants
- Rapid state changes
- Network interruptions
