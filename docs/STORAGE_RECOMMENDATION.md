# Storage Recommendation: localStorage vs sessionStorage

## Current State

**All atoms currently use localStorage** via `createPersistentAtom`, which wraps `atomWithStorage` with a localStorage backend.

## Analysis: What Should Use What?

### ✅ Keep localStorage (Current Approach is Correct)

**User Preferences** - Should persist across browser sessions:
- `vibe` - User's preferred production style
- `chaos_level` - User's preferred chaos level default

**Session Data** - Should persist across page refreshes but be session-scoped:
- `session_code` - Current session ID
- `session_state` - Session state (idle, configuring, casting, performing, completed, expired)
- `cast` - Character cast array
- `current_script` - Generated script
- `participant` - Participant data (actor/director info, character assignment)
- `performance_progress` - Performance tracking
- `wrap_party_data` - Wrap party results

**Why localStorage for session data?**
1. **Page Refresh Resilience**: Users can refresh without losing their place in the session
2. **Multi-tab Support**: Multiple tabs can share the same session state
3. **Better UX**: Users can close/reopen browser and return to their session
4. **Offline Resilience**: State persists even if network is temporarily unavailable

### ❌ Don't Use sessionStorage for Session Data

**Why sessionStorage would be problematic:**
1. **Lost on Refresh**: Data cleared when tab closes → users lose state on accidental refresh
2. **No Multi-tab**: Each tab has separate sessionStorage → can't share session across tabs
3. **Poor UX**: Would require re-joining session on every page refresh
4. **Race Conditions**: Tab close during active session would lose all progress

### 🤔 Potential Use Cases for sessionStorage

**Truly Temporary UI State** (not currently implemented):
- Form draft data (auto-save while typing)
- Scroll positions (if we want per-tab scroll memory)
- Modal open/close state
- Temporary filters/selections

**However**, these are better handled with:
- React state (for component-local state)
- URL search params (for shareable/filterable state)
- Jotai atoms without persistence (for temporary global state)

## Recommendation: **Keep Current Approach**

### Current Strategy (localStorage + Validation) ✅

**Pros:**
- ✅ Persists across refreshes (better UX)
- ✅ Multi-tab support
- ✅ Offline resilience
- ✅ Can return to session after browser close

**Cons:**
- ⚠️ Requires validation to prevent stale data (which we just fixed)
- ⚠️ Manual cleanup needed when sessions change

### Alternative Strategy (sessionStorage) ❌

**Pros:**
- ✅ Automatic cleanup on tab close
- ✅ No stale data issues

**Cons:**
- ❌ Lost on page refresh (terrible UX)
- ❌ No multi-tab support
- ❌ Users lose state on accidental refresh
- ❌ Can't return to session after browser close

## The Real Issue Was Validation, Not Storage Choice

The problem we fixed wasn't that we're using localStorage - it's that we weren't validating that data belongs to the current session.

### What We Fixed

1. **ActorPreview**: Now validates `participant.sessionId === sessionCode` before showing assignment UI
2. **Join Page**: Now clears stale participant data when `sessionId` doesn't match
3. **Session Validation**: Added checks to ensure data belongs to current session

### What We Should Keep Doing

1. ✅ Use localStorage for all persistent state
2. ✅ Validate session-scoped data (`participant.sessionId === sessionCode`)
3. ✅ Clear stale data when session changes (`clearSessionState()`)
4. ✅ Validate on component mount before using session data

## Future Improvements (Optional)

### Option 1: Session-Scoped Keys (Better Isolation)

Instead of global keys like `participant`, use session-scoped keys:
```typescript
// Current: 'participant'
// Proposed: `participant_${sessionCode}`

// Benefits:
// - Automatic isolation between sessions
// - No stale data issues
// - Simpler validation

// Trade-offs:
// - More complex key management
// - Need to clean up old session keys
```

### Option 2: Hybrid Approach (More Complex)

Use sessionStorage for truly temporary state, localStorage for persistent:
```typescript
// sessionStorage: Temporary UI state
// localStorage: Session data + user preferences

// Trade-offs:
// - More complex (two storage systems)
// - Harder to reason about
// - Minimal benefit for our use case
```

### Option 3: Keep Current + Better Cleanup (Recommended)

Keep localStorage but improve cleanup:
- ✅ Add session expiration timestamps
- ✅ Auto-cleanup expired sessions on app start
- ✅ Better validation helpers
- ✅ Session-scoped validation utilities

## Conclusion

**Answer: No, we should NOT switch to sessionStorage.**

**Current approach (localStorage + validation) is correct** because:
1. Better UX (persists across refreshes)
2. Multi-tab support
3. Offline resilience
4. Can return to sessions after browser close

**The issue was missing validation, not storage choice.** We've fixed that by:
- Validating `participant.sessionId === sessionCode` before using participant data
- Clearing stale data when sessions change
- Adding session validation in components

**Recommendation**: Keep localStorage, maintain validation, consider session-scoped keys as future improvement.
