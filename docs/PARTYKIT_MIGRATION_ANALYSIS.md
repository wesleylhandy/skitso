# PartyKit Migration Analysis

## Executive Summary

This document analyzes the migration from Socket.io to PartyKit for real-time session synchronization in the Skitso platform. PartyKit provides a Vercel-compatible solution for WebSocket-based real-time communication, eliminating the need for a separate Socket.io server.

**Key Findings:**
- ✅ **Feasible**: PartyKit supports all current Socket.io features
- ✅ **Cost-Effective**: Free tier covers MVP needs
- ✅ **Vercel-Compatible**: Works natively with Vercel deployments
- ⚠️ **Moderate Effort**: Requires refactoring server and client code
- ⏱️ **Estimated Time**: 2-3 days for complete migration

---

## Current Architecture

### Socket.io Implementation

**Server-Side (`src/lib/socket/server.ts`):**
- Custom HTTP server with Socket.io integration
- Session room management (join/leave)
- Event broadcasting (vibe changes, script updates, performance progress, votes)
- Participant tracking with roles (director/actor)
- State recovery on reconnection
- In-memory session store (`socketSessionStore`)

**Client-Side (`src/lib/socket/client.ts`):**
- Socket.io client initialization
- Connection management with exponential backoff
- Event listeners for all real-time updates
- Session join/leave functions
- Event emission functions

**Session Store (`src/lib/socket/session-store.ts`):**
- In-memory `Map` for session data
- Participant management
- Session lifecycle (create, update, cleanup)
- 24-hour expiration logic

**Custom Server (`server.ts`):**
- Creates HTTP server with Next.js handler
- Initializes Socket.io server
- Required for development (doesn't work on Vercel)

**Component Usage:**
- `CastingCouch`: Session join, participant tracking, vibe sync, performance start
- `Teleprompter`: Performance progress synchronization
- `VotingInterface`: Wrap party vote broadcasting
- `SessionJoinForm`: Actor session joining
- `ResetSessionButton`: Session cleanup

---

## PartyKit Architecture

### Key Concepts

**Parties (Rooms):**
- Similar to Socket.io rooms
- Each session = one Party
- Party ID = session code
- Automatic lifecycle management

**Server Logic:**
- PartyKit server runs on Cloudflare Workers
- Server-side TypeScript code in `parties/` directory
- Handles connections, events, and state
- Can use PartyKit storage or external database

**Client Connection:**
- Uses `@partykit/react` or `partykit` client
- Connects to PartyKit-hosted server
- Similar event-based API to Socket.io

**State Management:**
- PartyKit provides `party.storage` (in-memory, per-party)
- Can use external storage (Redis, database) for persistence
- Supports Hibernation API for cost optimization

---

## Feature Mapping

| Socket.io Feature | PartyKit Equivalent | Migration Complexity |
|-------------------|---------------------|---------------------|
| **Rooms** | Parties | ✅ Direct mapping |
| **Events (emit/on)** | `party.broadcast()` / `connection.send()` | ✅ Similar API |
| **Connection Management** | Automatic | ✅ Simpler |
| **Reconnection** | Built-in | ✅ Automatic |
| **State Recovery** | `party.storage` or external DB | ⚠️ Needs refactor |
| **Participant Tracking** | `party.getConnections()` | ✅ Similar |
| **Broadcasting** | `party.broadcast()` | ✅ Direct replacement |
| **Custom Server** | Not needed | ✅ Removed |

---

## Migration Requirements

### 1. Server-Side Changes

#### Create PartyKit Server File

**New File: `parties/session.ts`**

```typescript
import type { PartyKitServer } from "partykit/server";

export default {
  // Handle connection
  onConnect(connection, room) {
    console.log(`Connection ${connection.id} joined party ${room.id}`);
    
    // Send current party state to new connection
    const state = room.storage.get("sessionState");
    if (state) {
      connection.send(JSON.stringify({ type: "state:recovered", ...state }));
    }
  },

  // Handle messages
  onMessage(message, connection, room) {
    const data = JSON.parse(message as string);
    
    switch (data.type) {
      case "session:join":
        handleSessionJoin(data, connection, room);
        break;
      case "session:leave":
        handleSessionLeave(data, connection, room);
        break;
      case "vibe:change":
        handleVibeChange(data, room);
        break;
      case "script:update":
        handleScriptUpdate(data, room);
        break;
      case "performance:advance":
        handlePerformanceAdvance(data, room);
        break;
      case "performance:start":
        handlePerformanceStart(data, connection, room);
        break;
      case "wrap-party:vote":
        handleWrapPartyVote(data, room);
        break;
      case "wrap-party:update":
        handleWrapPartyUpdate(data, room);
        break;
    }
  },

  // Handle disconnection
  onClose(connection, room) {
    console.log(`Connection ${connection.id} left party ${room.id}`);
    // Cleanup participant tracking
    cleanupParticipant(connection.id, room);
  },
} satisfies PartyKitServer;
```

**Migration Tasks:**
- [ ] Create `parties/session.ts` with all event handlers
- [ ] Port session store logic to PartyKit storage or external DB
- [ ] Implement participant tracking using `room.getConnections()`
- [ ] Add state persistence (PartyKit storage or Redis)
- [ ] Handle 24-hour session expiration

**Estimated Effort:** 1 day

---

### 2. Client-Side Changes

#### Replace Socket.io Client

**New File: `src/lib/partykit/client.ts`**

```typescript
import PartySocket from "partysocket";

let partySocket: PartySocket | null = null;

export function initializePartyClient(sessionId: string): PartySocket {
  if (partySocket?.room === sessionId && partySocket?.isConnected) {
    return partySocket;
  }

  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST!;
  
  partySocket = new PartySocket({
    host,
    room: sessionId,
    party: "session",
  });

  partySocket.addEventListener("open", () => {
    console.log("PartyKit connected");
  });

  partySocket.addEventListener("close", () => {
    console.log("PartyKit disconnected");
  });

  return partySocket;
}

// Event listeners (similar to Socket.io)
export function onPartyMessage(
  callback: (data: any) => void
): () => void {
  if (!partySocket) return () => {};
  
  const handler = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    callback(data);
  };
  
  partySocket.addEventListener("message", handler);
  
  return () => {
    partySocket?.removeEventListener("message", handler);
  };
}

// Event emitters
export function emitPartyEvent(type: string, data: any): void {
  if (!partySocket?.isConnected) {
    console.warn("PartyKit not connected");
    return;
  }
  
  partySocket.send(JSON.stringify({ type, ...data }));
}
```

**Migration Tasks:**
- [ ] Create new PartyKit client wrapper
- [ ] Replace all `initializeSocketClient()` calls
- [ ] Replace all `socket.on()` with `onPartyMessage()`
- [ ] Replace all `socket.emit()` with `emitPartyEvent()`
- [ ] Update connection status tracking
- [ ] Update reconnection logic (PartyKit handles automatically)

**Files to Update:**
- `src/lib/socket/client.ts` → `src/lib/partykit/client.ts` (new)
- `src/components/director/casting-couch.tsx`
- `src/components/teleprompter/teleprompter.tsx`
- `src/components/wrap-party/voting-interface.tsx`
- `src/components/actor/session-join-form.tsx`
- `src/app/join/[sessionCode]/page.tsx`
- `src/components/director/reset-session-button.tsx`

**Estimated Effort:** 1 day

---

### 3. Session Store Migration

#### Option A: PartyKit Storage (In-Memory)

**Pros:**
- Simple, no external dependencies
- Fast access
- Automatic cleanup when party closes

**Cons:**
- Lost on party restart
- Not shared across party instances (if scaled)
- Limited to party lifecycle

**Implementation:**
```typescript
// In party server
room.storage.put("sessionState", {
  sessionId: room.id,
  vibeContext: data.vibeContext,
  participants: participantsMap,
  status: "casting",
  lastActivity: Date.now(),
});
```

#### Option B: External Database (Recommended)

**Pros:**
- Persistent across restarts
- Shared across instances
- Can query sessions
- Better for production

**Cons:**
- Additional dependency
- Slightly higher latency
- More complex setup

**Implementation:**
- Use existing database (if available) or add Redis/PostgreSQL
- Store session state in database
- PartyKit server reads/writes to database
- Keep PartyKit storage for temporary/volatile data

**Migration Tasks:**
- [ ] Decide on storage strategy (PartyKit storage vs external DB)
- [ ] If external: Set up database/Redis connection
- [ ] Port session store functions to PartyKit server
- [ ] Implement 24-hour expiration (cron job or scheduled cleanup)
- [ ] Update session queries to use new storage

**Estimated Effort:** 0.5-1 day (depending on storage choice)

---

### 4. Infrastructure Changes

#### Remove Custom Server

**Delete/Modify:**
- `server.ts` - No longer needed
- `package.json` scripts - Remove `dev:server`
- `src/app/api/socket/route.ts` - Can be removed or kept as health check

#### Add PartyKit Configuration

**New File: `partykit.json`**
```json
{
  "name": "skitso-session-server",
  "main": "parties/session.ts",
  "compatibilityDate": "2024-01-01",
  "vars": {
    "DATABASE_URL": "@database-url",
    "REDIS_URL": "@redis-url"
  }
}
```

**Environment Variables:**
- `NEXT_PUBLIC_PARTYKIT_HOST` - PartyKit server URL
- `PARTYKIT_TOKEN` - For deployment (CI/CD)

**Migration Tasks:**
- [ ] Remove `server.ts`
- [ ] Update `package.json` scripts
- [ ] Create `partykit.json` config
- [ ] Set up environment variables
- [ ] Update deployment documentation

**Estimated Effort:** 0.5 day

---

### 5. Testing Updates

**Test Files to Update:**
- `src/lib/socket/client.test.ts` → `src/lib/partykit/client.test.ts`
- `src/lib/socket/server.test.ts` → `parties/session.test.ts`
- `src/lib/socket/session-store.test.ts` → Update for new storage
- `src/components/teleprompter/teleprompter.test.tsx` - Update mocks

**Migration Tasks:**
- [ ] Update all socket-related tests
- [ ] Mock PartyKit client instead of Socket.io
- [ ] Test party server logic
- [ ] Integration tests for real-time features

**Estimated Effort:** 0.5 day

---

## Migration Plan

### Phase 1: Setup (Day 1 Morning)
1. Install PartyKit dependencies
2. Set up PartyKit project
3. Create basic party server structure
4. Configure environment variables

### Phase 2: Server Migration (Day 1 Afternoon)
1. Port event handlers to PartyKit
2. Implement participant tracking
3. Set up storage (PartyKit or external)
4. Test server-side logic

### Phase 3: Client Migration (Day 2)
1. Create PartyKit client wrapper
2. Update all components
3. Replace Socket.io calls
4. Test client connections

### Phase 4: Integration & Testing (Day 2-3)
1. End-to-end testing
2. Fix integration issues
3. Performance testing
4. Update documentation

### Phase 5: Deployment (Day 3)
1. Deploy PartyKit server
2. Update Vercel deployment
3. Remove custom server
4. Monitor and verify

---

## Code Changes Summary

### Files to Create
- `parties/session.ts` - PartyKit server
- `src/lib/partykit/client.ts` - PartyKit client wrapper
- `partykit.json` - PartyKit configuration
- `.env.example` - Updated with PartyKit vars

### Files to Modify
- `src/components/director/casting-couch.tsx`
- `src/components/teleprompter/teleprompter.tsx`
- `src/components/wrap-party/voting-interface.tsx`
- `src/components/actor/session-join-form.tsx`
- `src/app/join/[sessionCode]/page.tsx`
- `src/components/director/reset-session-button.tsx`
- `package.json` - Add PartyKit, remove Socket.io
- All test files

### Files to Delete
- `server.ts` - Custom server (or keep for local dev only)
- `src/lib/socket/server.ts` - Replaced by PartyKit server
- `src/lib/socket/client.ts` - Replaced by PartyKit client
- `src/lib/socket/session-store.ts` - Logic moved to PartyKit server
- `src/app/api/socket/route.ts` - Optional (can keep as health check)

---

## Cost Comparison

### Current (Socket.io + Separate Server)
- **Vercel**: Free tier or $20/month
- **Socket Server** (Railway/Render): $5-10/month
- **Redis** (Upstash): $0-5/month
- **Total**: $5-35/month

### After Migration (PartyKit)
- **Vercel**: Free tier or $20/month
- **PartyKit**: Free tier (10 projects, 24h storage)
- **External Storage** (if needed): $0-5/month
- **Total**: $0-25/month

**Savings**: $5-10/month, plus simpler infrastructure

---

## Risks & Considerations

### Risks
1. **Learning Curve**: Team needs to learn PartyKit API
2. **Storage Limitations**: PartyKit storage clears every 24h (need external DB for persistence)
3. **Vendor Lock-in**: PartyKit is a specific platform (though open-source)
4. **Scaling**: Need to verify PartyKit handles expected load

### Mitigations
1. PartyKit API is similar to Socket.io (easier migration)
2. Use external database for persistent state
3. PartyKit is open-source (can self-host if needed)
4. Test with expected concurrent sessions before production

### Considerations
- **State Persistence**: Decide early on storage strategy
- **Session Expiration**: Implement cleanup logic
- **Error Handling**: PartyKit has different error patterns
- **Development Workflow**: Need to run PartyKit dev server alongside Next.js

---

## Testing Strategy

### Unit Tests
- PartyKit client wrapper functions
- Party server event handlers
- Storage operations

### Integration Tests
- Session join/leave flow
- Event broadcasting
- State synchronization
- Reconnection handling

### E2E Tests
- Complete session flow (Director creates → Actors join → Performance → Wrap Party)
- Multi-device synchronization
- Network interruption recovery

---

## Rollback Plan

If migration fails:
1. Keep Socket.io code in separate branch
2. Can revert to Socket.io + separate server
3. No data loss (sessions are ephemeral)

---

## Success Criteria

✅ All Socket.io features work with PartyKit
✅ Multi-device synchronization < 500ms latency
✅ Session persistence works correctly
✅ Reconnection handles gracefully
✅ No increase in error rates
✅ Cost reduction achieved
✅ Deployment to Vercel successful

---

## Next Steps

1. **Decision**: Approve migration to PartyKit
2. **Setup**: Create PartyKit account and project
3. **Prototype**: Build minimal party server to test
4. **Plan**: Finalize migration timeline
5. **Execute**: Follow migration plan above

---

## Questions to Resolve

1. **Storage**: Use PartyKit storage (24h) or external database?
2. **Persistence**: Do we need sessions to persist beyond 24h?
3. **Scaling**: Expected concurrent sessions at launch?
4. **Timeline**: When do we need this deployed?

---

## References

- [PartyKit Documentation](https://docs.partykit.io)
- [PartyKit + Next.js Guide](https://docs.partykit.io/tutorials/add-partykit-to-a-nextjs-app)
- [PartyKit Pricing](https://www.partykit.io/pricing)
- [Socket.io to PartyKit Migration Guide](https://docs.partykit.io/guides/migrating-from-socket-io)
