# Session State Management

## Problem

The application was using `atomWithStorage` (localStorage) for all state, including session-specific data. This caused several issues:

1. **Stale state persisting**: Session state (sessionCode, cast, script, etc.) would persist across browser sessions, causing confusion when starting new sessions
2. **Invalid state combinations**: Old session state could remain even when no valid session exists (e.g., `sessionState: 'casting'` but no `sessionCode`)
3. **No cleanup mechanism**: There was no way to clear session state when starting a new session or when state became invalid

## Solution

### 1. State Classification

State is now classified into two categories:

#### Session-Specific State (should be cleared)
- `session_code` - Current session identifier
- `session_state` - Current session status (idle, configuring, casting, etc.)
- `cast` - Generated characters for the session
- `current_script` - Generated script for the session
- `participant` - Current participant data
- `performance_progress` - Performance progress state
- `wrap_party_data` - Wrap party data (can persist but should be session-specific)

#### User Preferences (should persist)
- `vibe` - User's preferred vibe/theme
- `chaos_level` - Default chaos level preference (can be overridden per session)

### 2. Cleanup Utilities

**`src/lib/utils/session-state-cleanup.ts`** provides:

- `clearSessionState()` - Clears all session-specific state from localStorage
- `validateSessionState()` - Validates if current session state is consistent
- `cleanupInvalidSessionState()` - Clears state if it's invalid or stale

### 3. Automatic Validation

**`src/components/session/session-state-initializer.tsx`** runs on app initialization to:
- Validate persisted session state
- Clear invalid/stale state automatically
- Ensure consistent state on app load

This component is mounted in `ThemeProvider` so it runs once per app load.

### 4. Manual Cleanup

When starting a new session (in `DirectorConfigForm`), old session state is cleared before generating a new session code.

## Usage

### Starting a New Session

```typescript
import { clearSessionState } from '@/src/lib/utils/session-state-cleanup';

// Clear old session state before starting new session
clearSessionState();
// Then generate new session code, etc.
```

### Validating State

```typescript
import { validateSessionState, cleanupInvalidSessionState } from '@/src/lib/utils/session-state-cleanup';

// Check if state is valid
if (!validateSessionState()) {
  // State is invalid, clean it up
  cleanupInvalidSessionState();
}
```

## Future Considerations

### Option 1: Use sessionStorage for Session State
- **Pros**: Automatically clears when tab closes
- **Cons**: State lost on refresh (not ideal for MVP)

### Option 2: Use Regular Atoms (No Persistence)
- **Pros**: No stale state issues
- **Cons**: State lost on refresh (not ideal for MVP)

### Option 3: Current Approach (localStorage + Validation)
- **Pros**: State persists across refreshes, validation prevents stale state
- **Cons**: Requires explicit cleanup, validation logic

**Current choice**: Option 3, as it provides the best balance for MVP while preventing stale state issues.

## Testing

The cleanup utilities can be tested by:
1. Setting invalid state in localStorage
2. Calling `cleanupInvalidSessionState()`
3. Verifying state is cleared/reset

Example:
```typescript
// Set invalid state
localStorage.setItem('session_state', '"casting"');
localStorage.removeItem('session_code'); // No session code but casting state

// Cleanup should detect and fix
cleanupInvalidSessionState();

// Verify
expect(localStorage.getItem('session_state')).toBe('"idle"');
```
