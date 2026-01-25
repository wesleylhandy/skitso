# Director Exit During Performance - Evaluation

## Current Behavior

### What Happens Now

1. **Director exits/closes browser during performance:**
   - PartyKit `onClose` handler removes the director's connection from participants map
   - Session state remains `'performing'` (no automatic state change)
   - Actors on `/stage/[sessionCode]` stay on stage page
   - Actors see teleprompter but no director controls (dead session)

2. **Stage page redirect logic:**
   ```typescript
   // src/app/stage/[sessionCode]/page.tsx:135-138
   if (sessionState !== 'performing') {
     router.push(`/director-desk`);
     return;
   }
   ```
   - Only redirects if state is NOT 'performing'
   - If state stays 'performing', actors remain stuck

3. **Director's Desk behavior:**
   - Shows CastingCouch when `sessionState === 'casting' || sessionState === 'performing'`
   - If director returns, they'd see CastingCouch (correct)
   - But actors are still on stage (incorrect)

## Proposed Solution

### Should Everyone Be Redirected Back to Casting Couch?

**Yes, with caveats:**

1. **If director explicitly exits/closes during performance:**
   - Change session state from `'performing'` → `'casting'`
   - Broadcast `session:state:updated` to all participants
   - Actors on stage automatically redirect (existing logic works)
   - Director returns to CastingCouch (existing logic works)

2. **Edge cases to consider:**
   - **Temporary network disconnect:** Should we wait before changing state? (e.g., 30s grace period)
   - **Director returns quickly:** Should we prevent state change if reconnection happens within grace period?
   - **Multiple directors:** Currently only one director per session, but should we handle this?

### How Would It Work?

#### Implementation Approach

**Option 1: Immediate State Change (Simplest)**
```typescript
// parties/session.ts - onClose handler
onClose(connection: Party.Connection) {
  // Find if this connection was the director
  const sessionState = await this.getSession(sessionId);
  const directorParticipant = Array.from(sessionState.participants.values())
    .find(p => p.connectionId === connection.id && p.role === 'director');
  
  if (directorParticipant && sessionState.status === 'performing') {
    // Change state back to casting
    sessionState.status = 'casting';
    await this.room.storage.put(`session:${sessionId}`, {...});
    
    // Broadcast state change
    this.room.broadcast(JSON.stringify({
      type: 'session:state:updated',
      data: { sessionId, status: 'casting', timestamp: Date.now() }
    }));
  }
  
  // Remove participant
  this.removeConnectionFromAllSessions(connection.id);
}
```

**Option 2: Grace Period (More Robust)**
- Track director disconnect time
- Wait 30 seconds before changing state
- If director reconnects within grace period, cancel state change
- More complex but handles temporary network issues

**Option 3: Explicit Exit Button (User-Controlled)**
- Add "End Performance" button on stage for director
- Sends explicit `session:state:update` message
- Most user-friendly but requires UI changes

#### Redirect Flow

1. **Director exits** → PartyKit detects connection close
2. **Server changes state** → `'performing'` → `'casting'`
3. **Server broadcasts** → `session:state:updated` to all clients
4. **Actors receive update** → `onSessionStateUpdate` callback fires
5. **Stage page redirects** → Existing `useEffect` checks `sessionState !== 'performing'`
6. **Actors land on join page** → `/join/[sessionCode]` shows CastingCouch view
7. **Director returns** → `/director-desk` shows CastingCouch (already works)

**Note:** Actors on `/stage/[sessionCode]` would redirect to `/director-desk`, but they should probably go to `/join/[sessionCode]` instead. This is a minor fix.

## Should We Address This Now or Later?

### Arguments for NOW (High Priority)

1. **Critical UX Gap:**
   - Actors get stuck on stage with no way to continue
   - Creates confusion and poor user experience
   - Easy to trigger (director closes tab, network issue, etc.)

2. **Infrastructure Already Exists:**
   - State update mechanism works (`session:state:update`)
   - Redirect logic exists (just needs state change)
   - PartyKit connection tracking is in place
   - Minimal code changes required

3. **Edge Case Frequency:**
   - Directors closing browsers/tabs is common
   - Network disconnects happen
   - Mobile app switching causes disconnects
   - Not a rare edge case

4. **Low Risk:**
   - Simple state change logic
   - Well-tested broadcast mechanism
   - Easy to test and verify

### Arguments for LATER (Lower Priority)

1. **Not Core MVP Flow:**
   - Normal flow: Director → Casting → Performance → Wrap Party
   - Director exit is an error/edge case
   - Could be handled in post-MVP polish

2. **Grace Period Complexity:**
   - Option 2 (grace period) requires more logic
   - Need to track reconnection timing
   - Adds complexity for edge case

3. **Other Priorities:**
   - May have more critical features to ship
   - Can document as known limitation

### Recommendation: **ADDRESS NOW (with Option 1)**

**Rationale:**
- **Low effort, high impact:** ~20 lines of code fixes a critical UX issue
- **Infrastructure ready:** All pieces exist, just need to connect them
- **Common scenario:** Not a rare edge case
- **Simple solution:** Option 1 (immediate) is sufficient for MVP
- **Can enhance later:** Option 2 (grace period) can be added post-MVP if needed

**Implementation Plan:**
1. Update `parties/session.ts` `onClose` handler to detect director exit during performance
2. Change state to `'casting'` and broadcast update
3. Fix stage page redirect to go to `/join/[sessionCode]` instead of `/director-desk` for actors
4. Add test case for director exit scenario
5. Document behavior in spec

**Estimated Effort:** 1-2 hours

## Implementation Details

### Code Changes Required

1. **`parties/session.ts`** - Update `onClose` handler:
   ```typescript
   onClose(connection: Party.Connection) {
     // Check all sessions for this connection
     // If director leaves during performance, change state to casting
     // Broadcast state update
   }
   ```

2. **`src/app/stage/[sessionCode]/page.tsx`** - Fix redirect destination:
   ```typescript
   // Current: router.push(`/director-desk`);
   // Should be: router.push(`/join/${sessionCode}`); // For actors
   // Or: router.push(`/director-desk`); // For director (check role)
   ```

3. **Tests** - Add scenario:
   - Director disconnects during performance
   - Verify state changes to 'casting'
   - Verify actors receive update and redirect

### Testing Scenarios

1. ✅ Director closes browser during performance → State changes, actors redirect
2. ✅ Director network disconnects → State changes, actors redirect
3. ✅ Director returns after exit → Sees CastingCouch (already works)
4. ✅ Multiple actors on stage → All redirect correctly
5. ⚠️ Director reconnects quickly → Should we prevent state change? (Future enhancement)

## Conclusion

**Address this now** with Option 1 (immediate state change). It's a simple fix that solves a critical UX issue with minimal code changes. Option 2 (grace period) can be added later if temporary disconnects become a problem.
