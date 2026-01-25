# Wrap Party Loading Stuck - Root Cause Analysis & Solution

## Problem Summary

Actors on the wrap party page can get stuck in a loading state when the director disconnects before properly ending the performance. The page shows a loading spinner indefinitely because:

1. Session state is still `'performing'` (never transitioned to `'completed'`)
2. `wrapPartyData` is `null` (never initialized because performance never ended)
3. The component's loading logic requires either `sessionState === 'completed'` OR `wrapPartyData` to exist

## Root Cause Analysis

### How the Broken State Occurs

1. **Director disconnects before ending performance**
   - Director's WebSocket connection drops (network issue, browser close, etc.)
   - Director cannot call `endPerformance()` because they're disconnected
   - PartyKit's `handlePerformanceEnd` requires director to be connected (`requireDirector` check at line 1406 of `parties/session.ts`)
   - Session state remains `'performing'` instead of transitioning to `'completed'`
   - No wrap party data is initialized

2. **Actor navigates to wrap party page**
   - Actor may navigate manually to `/wrap-party/[sessionCode]`
   - Or actor may already be on the page when director disconnects
   - Stage page redirects to wrap party when `sessionState === 'completed'` (line 132-135 of `src/app/stage/[sessionCode]/page.tsx`), but this won't trigger if state never changes

3. **Wrap party component gets stuck**
   - Component tries to recover state via `state:recover` (lines 56-108 of `wrap-party.tsx`)
   - If WebSocket connection fails or recovery doesn't return wrap party data, component stays in loading
   - Loading condition: `isLoading = !isCompletedOrHasData && !wrapPartyData` (line 111)
   - Since `sessionState !== 'completed'` and `wrapPartyData === null`, `isLoading` is always `true`

### Code Flow

```
Director disconnects
  ↓
endPerformance() fails (director not connected)
  ↓
Session state stays 'performing'
  ↓
No wrap party data initialized
  ↓
Actor on wrap party page
  ↓
isLoading = !('completed' || wrapPartyData) && !wrapPartyData
  ↓
isLoading = !false && true = true
  ↓
STUCK IN LOADING STATE
```

## Proposed Solution

### Solution 1: Fallback HTTP State Fetch with Timeout (Recommended)

Add a timeout mechanism and HTTP fallback to fetch state directly from PartyKit if WebSocket recovery fails.

**Changes to `src/components/wrap-party/wrap-party.tsx`:**

1. Add a timeout (e.g., 5 seconds) for state recovery
2. If WebSocket recovery doesn't complete within timeout, fetch state via HTTP (`fetchSessionState`)
3. If HTTP fetch also fails or returns no wrap party data, show appropriate error/fallback UI
4. Allow wrap party to render if wrap party data exists, even if session state isn't 'completed'

**Benefits:**
- Handles director disconnection gracefully
- Works even if WebSocket is unreliable
- Allows wrap party to function if data exists but state transition failed
- Provides clear feedback to users

### Solution 2: Server-Side Fallback for Director Disconnection

Modify PartyKit server to allow session completion even if director disconnects, using a timeout or actor-initiated completion.

**Changes to `parties/session.ts`:**

1. Add a timeout mechanism: if performance has been running for X minutes and director disconnects, auto-complete
2. Or allow actors to request completion if director is disconnected for Y minutes
3. Initialize wrap party data when session auto-completes

**Benefits:**
- Prevents the broken state from occurring
- More resilient to director disconnections
- Requires server-side changes

### Solution 3: Hybrid Approach (Best)

Combine both solutions:
- Client-side: Add timeout and HTTP fallback (Solution 1)
- Server-side: Add director disconnection resilience (Solution 2)

## Implementation Plan

### Phase 1: Immediate Fix (Client-Side)

1. **Add timeout to state recovery** (5 seconds)
2. **Add HTTP fallback** if WebSocket recovery fails
3. **Update loading logic** to allow wrap party if data exists, even if state isn't 'completed'
4. **Add error state** for when both recovery methods fail

### Phase 2: Resilience (Server-Side)

1. **Add director disconnection detection** in PartyKit
2. **Add auto-completion timeout** (e.g., if performance running > 15 minutes and director disconnected > 2 minutes)
3. **Initialize wrap party data** on auto-completion

## Code Changes Required

### File: `src/components/wrap-party/wrap-party.tsx`

**Key changes:**
- Add timeout mechanism for state recovery
- Add HTTP fallback using `fetchSessionState`
- Update `isCompletedOrHasData` logic to be more lenient
- Add error state handling

### File: `parties/session.ts` (Phase 2)

**Key changes:**
- Add director disconnection tracking
- Add auto-completion logic
- Initialize wrap party data on completion

## Testing Scenarios

1. **Director disconnects before ending performance**
   - Actor should see wrap party after timeout/HTTP fallback
   - Or see appropriate "not ready" message

2. **Director disconnects during performance**
   - Performance should auto-complete after timeout
   - Wrap party data should be initialized

3. **Normal flow (director ends performance)**
   - Should work as before
   - No regressions

4. **WebSocket connection issues**
   - HTTP fallback should handle state recovery
   - User should see wrap party if data exists

## Risk Assessment

**Low Risk:**
- Client-side timeout and HTTP fallback (Solution 1)
- Only adds resilience, doesn't change core logic

**Medium Risk:**
- Server-side auto-completion (Solution 2)
- Requires careful testing to ensure it doesn't trigger incorrectly

**Mitigation:**
- Start with Solution 1 (client-side only)
- Test thoroughly before implementing Solution 2
- Add feature flags for gradual rollout
