# Director Reconnection Resilience - Solution Proposals

## Problem Statement

When the director's connection to PartyKit is interrupted and reconnects, party actions that occurred during the outage are not captured. This includes:

- **Participant joins**: New actors joining the session
- **Character requests**: Actors requesting specific characters
- **Character assignments**: Assignments made by other directors (if multiple) or auto-assignments
- **Character confirmations**: Actors confirming their assignments
- **Other actor actions**: Any other events that occurred during the outage

The director remains unaware of these actions because:
1. Events are only broadcast in real-time via WebSocket
2. State recovery (`state:recover`) only recovers current state (participants, cast, script), not event history
3. There's no mechanism to replay missed events

## Current Architecture

### Event Flow
- **Real-time events**: Broadcast via `room.broadcast()` when they occur
- **State recovery**: Director requests `state:recover` → receives minimal ack → fetches full state via GET `/state`
- **State includes**: participants, cast, script, wrapPartyData, session status
- **State excludes**: Event history, assignment requests, join timestamps

### Reconnection Flow
1. Director disconnects (network issue, browser tab sleep, etc.)
2. PartyKit detects disconnection via `onClose`
3. Director reconnects (automatic via PartySocket)
4. Director requests state recovery
5. Director receives current state but misses event history

## Solution Options

### Option 1: Event Log in PartyKit Storage (Recommended)

**Approach**: Store a time-bounded event log in PartyKit storage that tracks all important events.

**Implementation**:
- Add event log storage: `events:${sessionId}` as an array of events
- Store events with timestamp, type, and data
- Limit log size (e.g., last 100 events or last 1 hour)
- On director reconnection, query events since last known timestamp
- Replay missed events to director's UI

**Pros**:
- ✅ Simple to implement
- ✅ Works with existing PartyKit storage
- ✅ No external dependencies
- ✅ Can replay events in order
- ✅ Director sees full history of what happened

**Cons**:
- ⚠️ Storage overhead (but minimal with size limits)
- ⚠️ Requires tracking last seen timestamp per director
- ⚠️ Events older than limit are lost (but acceptable for reconnection)

**Storage Structure**:
```typescript
interface EventLogEntry {
  timestamp: number;
  type: 'participant:joined' | 'assignment:requested' | 'assignment:approved' | 'assignment:confirmed' | 'character:assigned';
  data: unknown;
  participantId?: string;
  characterId?: string;
}

// Storage: events:${sessionId} = EventLogEntry[]
```

**Server Changes**:
- Log events to storage when they occur
- Add endpoint: GET `/events?since={timestamp}` to query events
- Clean up old events periodically

**Client Changes**:
- Track last event timestamp
- On reconnection, fetch events since last timestamp
- Replay events to update UI state

---

### Option 2: Enhanced State Recovery with Event Summary

**Approach**: Include event summary in state recovery response.

**Implementation**:
- Add `recentEvents` field to GET `/state` response
- Include last N events (e.g., last 10) with timestamps
- Director processes events on state recovery
- No separate event log storage needed

**Pros**:
- ✅ Minimal changes to existing flow
- ✅ No separate event query needed
- ✅ Works with current state recovery pattern

**Cons**:
- ⚠️ Limited event history (only last N events)
- ⚠️ If director was disconnected for long time, may miss events
- ⚠️ Events are included in state response (slightly larger payload)

**State Response Enhancement**:
```typescript
interface SessionStateResponse {
  // ... existing fields
  recentEvents: Array<{
    timestamp: number;
    type: string;
    data: unknown;
  }>;
}
```

---

### Option 3: Persistent Event Queue with Deduplication

**Approach**: Store events in a queue with participant-specific tracking.

**Implementation**:
- Store events with participant IDs who should receive them
- Track "last event seen" per participant
- On reconnection, query events since last seen
- Deduplicate events (same event ID seen by multiple participants)

**Pros**:
- ✅ Precise tracking per participant
- ✅ No duplicate event processing
- ✅ Can handle multiple directors

**Cons**:
- ⚠️ More complex implementation
- ⚠️ Requires participant-specific tracking
- ⚠️ More storage overhead

---

### Option 4: Hybrid Approach - State + Event Replay

**Approach**: Combine state recovery with event replay.

**Implementation**:
- State recovery provides current state (as now)
- Separate event log provides missed events
- Director processes state first, then replays events
- Events update UI incrementally

**Pros**:
- ✅ Best of both worlds
- ✅ Director sees current state immediately
- ✅ Then sees what changed during outage
- ✅ Clear separation of concerns

**Cons**:
- ⚠️ Two-step process (but can be parallel)
- ⚠️ Slightly more complex client logic

---

## Recommended Solution: Option 1 (Event Log)

### Why Option 1?

1. **Simple and effective**: Minimal changes, maximum benefit
2. **Works with existing architecture**: Uses PartyKit storage we already have
3. **Complete history**: Director sees everything that happened
4. **Scalable**: Can limit log size to prevent storage bloat
5. **No external dependencies**: Pure PartyKit solution

### Implementation Plan

#### Phase 1: Server-Side Event Logging

1. **Add event log storage** in `parties/session.ts`:
   - Create `logEvent()` helper function
   - Log events when they occur:
     - `participant:joined`
     - `assignment:requested`
     - `assignment:approved`
     - `assignment:confirmed`
     - `character:assigned`
   - Limit log to last 100 events or last 1 hour
   - Clean up old events periodically

2. **Add event query endpoint**:
   - GET `/events?since={timestamp}`
   - Returns events since timestamp
   - Filters by event type if needed

#### Phase 2: Client-Side Event Replay

1. **Track last event timestamp**:
   - Store in localStorage or component state
   - Update on each event received

2. **On reconnection**:
   - After state recovery, query events since last timestamp
   - Replay events to update UI
   - Update last timestamp

3. **Event replay logic**:
   - Process events in order
   - Update participants list
   - Update assignment requests
   - Update cast assignments
   - Show notifications for important events

#### Phase 3: UI Enhancements

1. **Show missed events notification**:
   - "You missed 3 events while disconnected"
   - List of events (e.g., "John joined", "Character request from Alice")
   - Dismissible notification

2. **Update UI state**:
   - Add participants who joined
   - Show pending assignment requests
   - Update character assignments

### Code Changes Summary

**Server (`parties/session.ts`)**:
- Add `EventLogEntry` interface
- Add `logEvent()` function
- Log events in handlers (join, assignment, etc.)
- Add GET `/events` endpoint
- Clean up old events

**Client (`src/lib/partykit/client.ts`)**:
- Add `fetchEvents(sessionId, since)` function
- Track last event timestamp

**Director Component (`src/components/director/casting-couch.tsx`)**:
- On reconnection, fetch and replay events
- Update UI state from events
- Show notification for missed events

**Join Page (`src/app/join/[sessionCode]/page.tsx`)**:
- Similar event replay for actors (optional, but good for consistency)

---

## Alternative: Option 2 (Simpler, Less Complete)

If Option 1 is too complex, Option 2 provides a simpler solution:

- Add `recentEvents` to state recovery response
- Include last 10-20 events
- Director processes events on state recovery
- No separate endpoint needed

**Trade-off**: Limited history, but simpler implementation.

---

## Questions for Decision

1. **How long should event history be kept?**
   - Last 100 events? Last 1 hour? Last 24 hours?

2. **Which events should be logged?**
   - All events? Only important ones (joins, assignments)?

3. **Should actors also get event replay?**
   - Currently only director has the problem
   - But actors might benefit too

4. **Should we show notifications for missed events?**
   - Or silently update UI?

5. **What about multiple directors?**
   - Should each track their own last timestamp?
   - Or share event log?

---

## Recommendation

**Implement Option 1 (Event Log)** with:
- Last 100 events or last 1 hour (whichever is smaller)
- Log: joins, assignment requests, assignments, confirmations
- Director-only event replay initially (can extend to actors later)
- Show notification: "You missed X events while disconnected"
- Track last timestamp per director connection

This provides complete resilience while keeping implementation simple and maintainable.
