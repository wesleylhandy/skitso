# Event Replay Idempotency Design

## Current Event Flow Analysis

### Event Types and Their Behavior

1. **`participant:joined`** - Includes FULL participants list
   - Client replaces entire participants array
   - **Idempotent by nature** (full state replacement)

2. **`participant:left`** - Includes FULL participants list  
   - Client replaces entire participants array
   - **Idempotent by nature** (full state replacement)

3. **`cast:updated`** - Includes FULL cast array
   - Client replaces entire cast
   - **Idempotent by nature** (full state replacement)

4. **`assignment:requested`** - Incremental event
   - Adds to assignment requests Map
   - **NOT idempotent** - needs deduplication

5. **`assignment:approved`** - Incremental event
   - Updates participant state
   - **NOT idempotent** - needs deduplication

6. **`assignment:confirmed`** - Incremental event
   - Updates cast and participant state
   - **NOT idempotent** - needs deduplication

7. **`character:assigned`** - Incremental event
   - Updates cast
   - **NOT idempotent** - needs deduplication

## Idempotency Strategy

### Approach: Event ID + State-Based Deduplication

**Key Principles:**
1. **Full-state events** (participant:joined, cast:updated) are naturally idempotent
2. **Incremental events** need deduplication using event IDs
3. **State recovery provides source of truth** - events only update UI, not state
4. **Replay only updates UI** - state recovery already has correct state

### Event ID Generation

Each event gets a unique ID:
```typescript
interface EventLogEntry {
  id: string; // Unique event ID: `${timestamp}-${type}-${participantId}-${characterId?}`
  timestamp: number;
  type: string;
  data: unknown;
  // ... other fields
}
```

**Event ID Format:**
- `participant:joined`: `${timestamp}-join-${participantId}`
- `assignment:requested`: `${timestamp}-request-${participantId}-${characterId}`
- `assignment:approved`: `${timestamp}-approve-${participantId}-${characterId}`
- `assignment:confirmed`: `${timestamp}-confirm-${participantId}-${characterId}`
- `character:assigned`: `${timestamp}-assign-${participantId}-${characterId}`

### Replay Flow

```
1. Director reconnects
2. State recovery (GET /state) → Full current state (source of truth)
3. Update UI from state recovery
4. Fetch events since last timestamp
5. For each event:
   a. Check if event ID already processed (localStorage)
   b. If processed, skip
   c. If not processed:
      - For full-state events: Apply (idempotent)
      - For incremental events: Check current state first
        - If state already reflects event, skip
        - If state doesn't reflect event, apply and mark processed
```

### Deduplication Logic

#### Full-State Events (Naturally Idempotent)
- `participant:joined` - Always safe to replay (replaces full list)
- `participant:left` - Always safe to replay (replaces full list)
- `cast:updated` - Always safe to replay (replaces full cast)

**Implementation:**
```typescript
// These events are safe to replay - they replace full state
if (event.type === 'participant:joined' || event.type === 'participant:left') {
  // Always apply - replaces full participants list
  applyEvent(event);
  markEventProcessed(event.id);
}
```

#### Incremental Events (Need State Check)

**1. `assignment:requested`**
- Check: Does assignmentRequests Map already have this participant?
- If yes: Skip (already processed)
- If no: Add to Map, mark processed

**2. `assignment:approved`**
- Check: Does cast already show this participant assigned to this character?
- If yes: Skip (already processed)
- If no: Update state, mark processed

**3. `assignment:confirmed`**
- Check: Is character already locked for this participant?
- If yes: Skip (already processed)
- If no: Update state, mark processed

**4. `character:assigned`**
- Check: Does cast already show this assignment?
- If yes: Skip (already processed)
- If no: Update state, mark processed

### Implementation Details

#### Client-Side Event Tracking

```typescript
// Track processed event IDs
const PROCESSED_EVENTS_KEY = 'skitso:processedEvents';
const MAX_PROCESSED_EVENTS = 1000; // Keep last 1000 event IDs

function markEventProcessed(eventId: string): void {
  const processed = getProcessedEvents();
  processed.add(eventId);
  
  // Clean up old events (keep last 1000)
  if (processed.size > MAX_PROCESSED_EVENTS) {
    const sorted = Array.from(processed).sort();
    const toKeep = sorted.slice(-MAX_PROCESSED_EVENTS);
    processed.clear();
    toKeep.forEach(id => processed.add(id));
  }
  
  saveProcessedEvents(processed);
}

function isEventProcessed(eventId: string): boolean {
  return getProcessedEvents().has(eventId);
}
```

#### State-Based Deduplication

```typescript
function shouldApplyIncrementalEvent(
  event: EventLogEntry,
  currentState: {
    participants: Participant[];
    cast: Character[];
    assignmentRequests: Map<string, AssignmentRequest>;
  }
): boolean {
  switch (event.type) {
    case 'assignment:requested':
      // Check if request already exists
      const request = currentState.assignmentRequests.get(event.data.participantId);
      return !request || request.characterId !== event.data.characterId;
      
    case 'assignment:approved':
    case 'character:assigned':
      // Check if cast already shows this assignment
      const character = currentState.cast.find(c => c.id === event.data.characterId);
      return character?.participantId !== event.data.participantId;
      
    case 'assignment:confirmed':
      // Check if character is already locked
      const char = currentState.cast.find(c => c.id === event.data.characterId);
      return !char?.isLocked || char.participantId !== event.data.participantId;
      
    default:
      return true; // Unknown events, apply to be safe
  }
}
```

#### Replay Function

```typescript
async function replayEvents(
  events: EventLogEntry[],
  currentState: SessionState
): Promise<void> {
  // Sort events by timestamp to ensure correct order
  const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
  
  for (const event of sortedEvents) {
    // Skip if already processed
    if (isEventProcessed(event.id)) {
      continue;
    }
    
    // For full-state events, always apply (idempotent)
    if (isFullStateEvent(event.type)) {
      applyEvent(event);
      markEventProcessed(event.id);
      continue;
    }
    
    // For incremental events, check state first
    if (shouldApplyIncrementalEvent(event, currentState)) {
      applyEvent(event);
      markEventProcessed(event.id);
    } else {
      // Event already reflected in state, mark as processed
      markEventProcessed(event.id);
    }
  }
}
```

## Preventing Duplicate Participants

### Issue
If we replay `participant:joined` events, we might add participants that are already in the state from state recovery.

### Solution
Since `participant:joined` includes the FULL participants list, replaying it will:
1. Replace the entire participants array
2. Include all participants (from state recovery + any new ones)
3. **No duplicates possible** - it's a full replacement

**However**, we should:
- Replay events AFTER state recovery
- Use state recovery as source of truth
- Events only update UI for missed actions (like assignment requests)

### Safe Replay Order

```
1. State Recovery (GET /state)
   → Updates: participants, cast, script, session state
   → This is the source of truth

2. Event Replay (GET /events?since=...)
   → Only replay events that:
     a. Are not already reflected in state recovery
     b. Are incremental (assignment requests, etc.)
   → Full-state events can be skipped if state recovery is recent
```

## Handling Race Conditions

### Scenario: Event arrives during replay

**Problem:** New event arrives via WebSocket while replaying old events.

**Solution:**
1. **Pause event processing** during replay
2. **Queue new events** that arrive during replay
3. **Process queued events** after replay completes
4. **Deduplicate** - if event was in replay, skip from queue

```typescript
let isReplaying = false;
const queuedEvents: EventLogEntry[] = [];

function handleNewEvent(event: EventLogEntry): void {
  if (isReplaying) {
    // Queue for later processing
    queuedEvents.push(event);
  } else {
    // Process immediately
    processEvent(event);
  }
}

async function replayEvents(events: EventLogEntry[]): Promise<void> {
  isReplaying = true;
  try {
    // Replay events
    for (const event of events) {
      await processEvent(event);
    }
  } finally {
    isReplaying = false;
    // Process queued events
    const toProcess = queuedEvents.splice(0);
    for (const event of toProcess) {
      // Check if already processed during replay
      if (!isEventProcessed(event.id)) {
        await processEvent(event);
      }
    }
  }
}
```

## Summary

### Idempotency Guarantees

1. **Full-state events**: Naturally idempotent (replace full state)
2. **Incremental events**: State-based deduplication + event ID tracking
3. **State recovery first**: Provides source of truth
4. **Event replay second**: Only updates UI for missed incremental actions
5. **Event ID tracking**: Prevents duplicate processing
6. **Race condition handling**: Queue events during replay

### Flow for Director Reconnection

```
1. Reconnect → State Recovery (GET /state)
   → Full current state loaded
   → UI updated from state

2. Fetch Events (GET /events?since=lastTimestamp)
   → Get events since last connection

3. Replay Events (with deduplication)
   → Skip full-state events (already in state recovery)
   → Replay incremental events (assignment requests, etc.)
   → Check state before applying (prevent duplicates)
   → Track processed event IDs

4. Resume Normal Operation
   → Process new events as they arrive
   → Update last timestamp
```

### Flow for Actors

Actors follow the same pattern:
- State recovery on connection
- Event replay for missed events
- Same idempotency guarantees

This ensures smooth flow for both director and actors without duplicates or broken state.
