# Actor Stuck at Welcome View - Diagnosis

## Issue Summary

After a brief error about "full character too big for message", both director and actor performance views went into error state. After refresh:
- **Director**: Recovered successfully, went to performance view
- **Actor**: Stuck at "Welcome to Cast" view with spinner, waiting for skit generation

## Root Cause Analysis

### 1. Character Message Size Error

**Location**: `src/lib/partykit/client.ts:1257`

**Problem**: Even after chunking characters into individual messages, a single character message exceeded the 500-byte limit (WebSocket has 576-byte hard limit).

```typescript
if (chunkSize > maxMessageSize) {
  console.error('[PartyKit] Single character still too large even with minimal fields:', {
    sessionId,
    characterId: char.id,
    chunkSizeBytes: chunkSize,
    characterFields: Object.keys(minimalChar),
  });
  // Still try to send - might work if limit is slightly flexible
}
```

**Issue**: The code logs an error but still attempts to send the message. If the message fails:
- WebSocket connection might error
- State recovery messages might fail
- Cast updates might not reach the actor

### 2. State Recovery Retry Exhaustion

**Location**: `src/app/join/[sessionCode]/page.tsx:240-268`

**Problem**: State recovery has a maximum of 3 retries. If all retries are exhausted:
- Actor stops requesting state updates
- Actor remains stuck in current state (likely 'configuring')
- No mechanism to detect and recover from this stuck state

```typescript
const STATE_RECOVERY_RETRY_MAX = 3;
// ...
if (stateRecoveryRetryCount >= STATE_RECOVERY_RETRY_MAX) {
  console.warn('[JoinPage] Max state recovery retries reached, stopping');
  return;
}
```

### 3. Actor Stuck State Logic

**Location**: `src/app/join/[sessionCode]/page.tsx:1061-1062`

**Problem**: Actor shows spinner (waiting for generation) when:
- `sessionState === 'configuring'` (prevents preview from showing)
- OR `!hasScriptAndCast && !isCastingState` (script/cast not ready)

If state recovery fails or cast/script messages fail due to WebSocket size issues:
- Actor never receives cast/script
- `sessionState` might remain 'configuring' even if generation is complete
- Actor is stuck waiting indefinitely

### 4. Missing Error Recovery

**Problem**: When WebSocket messages fail (due to size limits or connection issues):
- No fallback to HTTP polling
- No detection of stuck state
- No automatic recovery mechanism

## Why Director Recovered But Actor Didn't

1. **Timing**: Director refreshed after the error cleared, getting a fresh state recovery
2. **State Recovery**: Director's state recovery succeeded (maybe retries weren't exhausted)
3. **Message Delivery**: Director might have received cast/script via different path (HTTP fallback or successful WebSocket)

## Relationship to GAP_MITIGATION_PLAN.md

### Gap 4: Image Storage Strategy (Relevant)

**Status**: Not yet implemented

**Impact**: This gap addresses the root cause - removing data URLs and using Cloudinary URLs would eliminate WebSocket size limit issues.

**Current State**: 
- Images are converted to HTTP URLs for WebSocket messages
- But character data (name, traits, hiddenMotivation) can still be large
- Single character with all fields can exceed 500 bytes

### Gap 2: Connectivity Sync Issues (Relevant)

**Status**: Partially addressed

**Impact**: This gap addresses state recovery and event replay, but doesn't handle:
- WebSocket message failures
- Stuck state detection
- Automatic recovery after retry exhaustion

## Immediate Fixes Needed

### 1. Improve Character Message Size Handling

**File**: `src/lib/partykit/client.ts`

**Fix**: When a character message is too large, strip more fields or use HTTP fallback:

```typescript
if (chunkSize > maxMessageSize) {
  console.error('[PartyKit] Single character still too large, using HTTP fallback');
  // Instead of sending via WebSocket, trigger HTTP fetch for this character
  // Or strip even more fields (remove hiddenMotivation, reduce traits)
}
```

### 2. Add Stuck State Detection and Recovery

**File**: `src/app/join/[sessionCode]/page.tsx`

**Fix**: Detect when actor is stuck and trigger recovery:

```typescript
// After max retries, add periodic check for stuck state
useEffect(() => {
  if (stateRecoveryRetryCount >= STATE_RECOVERY_RETRY_MAX) {
    // Check if we're stuck in configuring state for too long
    const stuckCheckInterval = setInterval(() => {
      if (sessionState === 'configuring' && participant) {
        // Try HTTP fallback for state recovery
        fetchSessionState(sessionCode).then((fetched) => {
          if (fetched && fetched.status !== 'configuring') {
            handleStateRecovered(fetched);
          }
        });
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(stuckCheckInterval);
  }
}, [stateRecoveryRetryCount, sessionState]);
```

### 3. Add HTTP Fallback for State Recovery

**File**: `src/app/join/[sessionCode]/page.tsx`

**Fix**: When WebSocket state recovery fails, use HTTP polling:

```typescript
const scheduleRecoveryRetry = (delayMs: number) => {
  if (stateRecoveryRetryCount >= STATE_RECOVERY_RETRY_MAX) {
    console.warn('[JoinPage] Max WebSocket retries reached, switching to HTTP polling');
    // Switch to HTTP polling every 3 seconds
    const httpPollInterval = setInterval(async () => {
      if (!mounted) {
        clearInterval(httpPollInterval);
        return;
      }
      try {
        const fetched = await fetchSessionState(sessionCode);
        if (fetched && mounted) {
          handleStateRecovered(fetched);
          // If we got valid state, stop polling
          if (fetched.status !== 'configuring' || (fetched.cast && fetched.cast.length > 0)) {
            clearInterval(httpPollInterval);
          }
        }
      } catch (error) {
        console.error('[JoinPage] HTTP state recovery failed:', error);
      }
    }, 3000);
    return;
  }
  // ... existing retry logic
};
```

### 4. Improve Error Handling for WebSocket Messages

**File**: `src/lib/partykit/client.ts`

**Fix**: Detect WebSocket send failures and trigger recovery:

```typescript
try {
  sendMessageWithQueue(chunkMessage);
} catch (error) {
  console.error('[PartyKit] Failed to send character chunk:', error);
  // Trigger HTTP fallback for this character
  // Or mark for retry via HTTP
}
```

## Long-Term Solution

**Implement Gap 4 (Image Storage Strategy)** from GAP_MITIGATION_PLAN.md:
- Remove all data URLs from WebSocket messages
- Use Cloudinary URLs exclusively
- This will eliminate WebSocket size limit issues entirely

## Testing Recommendations

1. **Test large character data**: Create a character with very long name, traits, and hiddenMotivation
2. **Test WebSocket failures**: Simulate WebSocket message failures
3. **Test state recovery exhaustion**: Verify HTTP fallback activates after max retries
4. **Test stuck state detection**: Verify actor recovers from stuck 'configuring' state

## Priority

**High** - This blocks actors from joining sessions when character data is large or WebSocket messages fail.
