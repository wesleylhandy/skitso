# PartyKit Rollback Procedure

This document outlines the procedure to rollback from PartyKit to Socket.io if issues are encountered with the PartyKit migration.

## Prerequisites

- Socket.io code should be preserved in a separate branch (e.g., `backup/socketio-implementation`)
- All Socket.io dependencies are still available in package.json (socket.io, socket.io-client)
- Custom server.ts file has been backed up (or can be restored from git history)

## Rollback Steps

### 1. Restore Custom Server

Restore the custom server file that was removed during migration:

```bash
git checkout backup/socketio-implementation -- server.ts
```

Or manually recreate `server.ts` in the project root with the Socket.io server setup.

### 2. Restore package.json Scripts

Update `package.json` to restore the `dev:server` script:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:server": "tsx server.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:server\"",
    ...
  }
}
```

### 3. Update Component Imports

Replace PartyKit client imports with Socket.io client imports in all components:

**Files to update:**
- `src/components/director/casting-couch.tsx`
- `src/components/teleprompter/teleprompter.tsx`
- `src/components/wrap-party/voting-interface.tsx`
- `src/components/actor/session-join-form.tsx`
- `src/app/join/[sessionCode]/page.tsx`
- `src/components/director/reset-session-button.tsx`
- `src/components/ui/connection-status.tsx`

**Change from:**
```typescript
import { 
  initializePartyKitClient,
  joinSession,
  onVibeContextChange,
  ...
} from '@/src/lib/partykit/client';
```

**Change to:**
```typescript
import {
  initializeSocketClient,
  joinSession,
  onVibeContextChange,
  ...
} from '@/src/lib/socket/client';
```

### 4. Update Client Wrapper

Ensure `src/lib/socket/client.ts` exports the same interface as the PartyKit client wrapper:
- `initializeSocketClient()`
- `getSocketClient()`
- `isSocketConnected()`
- `joinSession()`
- `leaveSession()`
- `onVibeContextChange()`
- `onScriptUpdate()`
- `onPerformanceProgress()`
- `advancePerformance()`
- `onWrapPartyVote()`
- `submitVote()`
- `startPerformance()`

### 5. Restore Socket.io Server Route

Restore or update `src/app/api/socket/route.ts` to work with the custom server:

```typescript
/**
 * Socket.io API Route Handler
 * 
 * Note: Next.js App Router doesn't support WebSocket upgrades directly.
 * This route handler works with a custom server setup (see server.ts in project root).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      message: 'Socket.io server endpoint',
      status: 'active',
      note: 'This endpoint requires a custom server setup for WebSocket support',
    },
    { status: 200 }
  );
}
```

### 6. Remove PartyKit Configuration

Remove or comment out PartyKit-specific configuration:

**Remove/Update:**
- `partykit.json` (or move to backup)
- Environment variable `NEXT_PUBLIC_PARTYKIT_HOST` from `.env.local` and `.env.example`
- PartyKit dependencies from `package.json` (optional, can keep for future use):
  - `partykit`
  - `partysocket`

### 7. Update Environment Variables

Restore Socket.io server URL configuration:

**Add to `.env.local`:**
```env
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:3000
```

**For production:** Point to your Socket.io server URL (separate server or custom server deployment).

### 8. Revert Test Files

Update test files to use Socket.io mocks instead of PartyKit:

**Files to revert:**
- `src/lib/socket/client.test.ts`
- `src/lib/socket/server.test.ts`
- `src/components/director/casting-couch.test.tsx`
- `src/components/teleprompter/teleprompter.test.tsx`
- `src/components/ui/connection-status.test.tsx`
- Other component tests that mock the real-time client

### 9. Remove GitHub Actions Workflow

Remove or disable the PartyKit deployment workflow:

```bash
rm .github/workflows/deploy-partykit.yml
```

Or disable it by removing the workflow trigger.

### 10. Remove PartyKit Server

The PartyKit server file `parties/session.ts` can remain for reference but won't be used. Consider moving it to a backup location or commenting it out.

### 11. Rebuild and Test

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the custom server:
   ```bash
   npm run dev:server
   ```

3. In another terminal, start the Next.js app:
   ```bash
   npm run dev
   ```

4. Test all real-time features:
   - Session join/leave
   - VibeContext synchronization
   - Script updates
   - Performance progress synchronization
   - Wrap party voting
   - Reconnection and state recovery

### 12. Deployment

**For Vercel:**
- Remove `NEXT_PUBLIC_PARTYKIT_HOST` from Vercel environment variables
- Deploy the Next.js app to Vercel (Socket.io will not work on Vercel serverless - requires custom server or separate Socket.io server)

**For other platforms:**
- Deploy with custom server support (e.g., Railway, Render, DigitalOcean App Platform)
- Ensure WebSocket support is enabled
- Configure Socket.io server URL environment variable

## Important Notes

1. **Vercel Limitation:** Socket.io with custom server does NOT work on Vercel. For Vercel deployment, you must use PartyKit or a separate Socket.io server.

2. **Separate Server Option:** If rolling back but still using Vercel, deploy Socket.io server separately (e.g., Railway, Render) and point the client to that server URL.

3. **Testing:** Thoroughly test all real-time features after rollback, especially:
   - Multi-device synchronization
   - Reconnection handling
   - State recovery
   - Session expiration (24 hours)

4. **Documentation:** Update README.md and other documentation to reflect Socket.io usage instead of PartyKit.

## Verifying Rollback

Run the following checks to verify successful rollback:

1. ✅ Custom server starts without errors
2. ✅ Next.js app connects to Socket.io server
3. ✅ Session join/leave works
4. ✅ VibeContext changes synchronize across devices (<500ms)
5. ✅ Script updates synchronize across devices (<500ms)
6. ✅ Performance progress synchronizes across devices (<500ms)
7. ✅ Wrap party voting synchronizes across devices
8. ✅ Reconnection restores session state
9. ✅ Connection status indicator shows correct status
10. ✅ All tests pass

## Rollback Timeline

- **Immediate:** Can rollback at any time if critical issues are found
- **Recommended:** Keep Socket.io code in backup branch until PartyKit migration is fully verified in production
- **Safe to remove:** Only remove Socket.io code and PartyKit rollback docs after 30+ days of stable PartyKit production usage

## Support

If rollback is needed due to issues:
1. Document the issue in a GitHub issue
2. Tag it with `rollback` and `partykit-migration`
3. Consider creating a hotfix branch for immediate rollback
4. Investigate PartyKit issues separately to determine if fix is possible
