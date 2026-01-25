# Storage Analysis: localStorage vs sessionStorage

## Issue Summary

The casting couch on the join page was automatically showing a "Confirm Character Assignment" modal when loading, even on first visit. This was caused by stale participant data persisting in localStorage from previous sessions.

## Root Cause

1. **localStorage Persistence**: All Jotai atoms use `createPersistentAtom` which stores data in `localStorage` (not `sessionStorage`)
2. **Stale Participant Data**: When a user joins a new session, if there's old participant data in localStorage with:
   - `characterAssignment` set to a character
   - `assignmentStatus` set to 'pending'
   - But `sessionId` from a different/previous session
3. **Missing Validation**: The `ActorPreview` component was checking for pending assignments without validating that the participant's `sessionId` matched the current session code
4. **Race Condition**: The participant atom could be restored from localStorage before the join page logic validated it

## Storage Strategy

### Current Implementation: localStorage

**Why localStorage?**
- Persists across browser sessions (survives page refresh, tab close)
- Enables offline functionality
- Allows users to return to a session after closing browser
- Better UX for multi-tab scenarios

**What's Stored in localStorage:**
- `session_code` - Current session ID
- `session_state` - Session state (idle, configuring, casting, performing, completed, expired)
- `cast` - Character cast array
- `current_script` - Generated script
- `participant` - Participant data (actor/director info, character assignment)
- `performance_progress` - Performance tracking
- `wrap_party_data` - Wrap party results
- `vibe` - Selected vibe (user preference, persists across sessions)
- `chaos_level` - Chaos level preference (persists across sessions)

### Why NOT sessionStorage?

**sessionStorage limitations:**
- Cleared when tab/window closes
- Not shared across tabs
- Would require re-joining session on every page refresh
- Poor UX for multi-tab scenarios

**When sessionStorage would be appropriate:**
- Temporary form data
- UI state that shouldn't persist
- Data that should be cleared on tab close

## The Fix

### 1. ActorPreview Component (`src/components/actor/actor-preview.tsx`)

**Problem**: Showed confirmation UI for any participant with `assignmentStatus === 'pending'`, regardless of whether they belonged to the current session.

**Solution**: Added validation to ensure participant belongs to current session before showing assignment UI:

```typescript
// CRITICAL: Only show assignment UI if participant belongs to current session
// This prevents stale localStorage data from previous sessions showing confirmation modals
const participantBelongsToCurrentSession = participant?.sessionId === sessionCode;

const hasPendingAssignment = participantBelongsToCurrentSession &&
  participant?.characterAssignment && 
  participant.assignmentStatus === 'pending';
```

**Additional safeguards:**
- Early return if participant doesn't belong to current session
- Validate sessionId in all assignment handlers
- Only show available characters if participant belongs to current session

### 2. Join Page (`src/app/join/[sessionCode]/page.tsx`)

**Problem**: When same session code was detected, it preserved participant data without validating that the participant's `sessionId` matched.

**Solution**: Added validation to clear stale participant data:

```typescript
// CRITICAL: Validate that existing participant belongs to this session
// Clear participant if it belongs to a different session (stale data)
if (currentStoredParticipant && currentStoredParticipant.sessionId !== sessionCode) {
  console.log('[JoinPage] Stale participant data detected (different sessionId), clearing participant');
  setParticipant(null);
  // Also clear from localStorage to prevent future issues
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('participant');
    } catch (error) {
      console.error('Failed to clear stale participant from localStorage:', error);
    }
  }
}
```

## Do We Need localStorage?

**Yes, for these reasons:**

1. **Session Persistence**: Users can refresh the page or close/reopen browser and return to their session
2. **Multi-tab Support**: Multiple tabs can share the same session state
3. **Offline Resilience**: State persists even if network is temporarily unavailable
4. **User Preferences**: Vibe and chaos level preferences persist across sessions (good UX)

**However, we need:**
- ✅ Proper validation that data belongs to current session
- ✅ Cleanup of stale data when sessions change
- ✅ Session-scoped validation (participant.sessionId === sessionCode)

## Best Practices Going Forward

1. **Always validate session-scoped data**: Check `participant.sessionId === sessionCode` before using participant data
2. **Clear stale data on session change**: When session code changes, clear all session-scoped state
3. **Validate on component mount**: Components should validate data belongs to current session before rendering
4. **Use session-scoped keys**: Consider prefixing localStorage keys with sessionId for better isolation (future improvement)

## Related Files

- `src/state/utils/safe-storage.ts` - Storage abstraction layer
- `src/lib/utils/session-state-cleanup.ts` - Session cleanup utilities
- `src/components/actor/actor-preview.tsx` - Fixed to validate session
- `src/app/join/[sessionCode]/page.tsx` - Fixed to clear stale participant data
