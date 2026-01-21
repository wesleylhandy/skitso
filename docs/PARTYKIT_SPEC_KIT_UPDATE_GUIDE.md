# Spec-Kit Update Guide: PartyKit Migration

This guide explains how to update the spec-kit documentation (spec.md, plan.md, tasks.md) to incorporate the PartyKit migration analysis.

## Overview

The PartyKit migration is an **architectural change** that affects:
- **Specification**: Update technical assumptions and dependencies
- **Plan**: Update architecture decisions and implementation approach
- **Tasks**: Add migration tasks and update Phase 6 (Synchronization)

---

## 1. Update `spec.md`

### Section: Assumptions (Line ~720)

**Current:**
```markdown
7. **Synchronization:**
   - Real-time synchronization uses polling or WebSocket technology
   - Network interruptions are infrequent and recoverable
```

**Update to:**
```markdown
7. **Synchronization:**
   - Real-time synchronization uses PartyKit (WebSocket-based, Vercel-compatible)
   - Network interruptions are infrequent and recoverable
   - PartyKit provides automatic reconnection and state recovery
   - Session state can use PartyKit storage (24h) or external database for persistence
```

### Section: Dependencies (Line ~731)

**Current:**
```markdown
### External Services
- **AI Generation Service:** ...
- **Video Chat Service (Premium):** ...
- **Storage Service (Premium):** ...
```

**Add:**
```markdown
### External Services
- **AI Generation Service:** ...
- **Real-Time Communication Service:** PartyKit (WebSocket server, Vercel-compatible)
- **Video Chat Service (Premium):** ...
- **Storage Service (Premium):** ...
- **Session Storage (Optional):** External database (PostgreSQL/Redis) if persistence beyond 24h needed
```

### Section: Open Questions (Line ~746)

**Add new resolved question:**
```markdown
11. **Real-Time Synchronization Platform:** ✅ RESOLVED - Using PartyKit for Vercel-compatible WebSocket support. 
    - Decision: Migrate from Socket.io to PartyKit
    - Rationale: Vercel doesn't support custom servers or WebSockets; PartyKit provides free tier with full WebSocket support
    - Migration analysis: See `docs/PARTYKIT_MIGRATION_ANALYSIS.md`
    - Cost: Free tier covers MVP needs (10 projects, 24h storage)
```

---

## 2. Update `plan.md`

### Section: Architecture Decisions (Line ~90)

**Current:**
```markdown
2. **Synchronization: Server-Authoritative with Optimistic Updates**
   - Server acts as single source of truth for session state
   - Local UI updates occur immediately for responsive UX
   - Server reconciles conflicts automatically
   - Socket.io for real-time updates (<500ms latency) with automatic polling fallback
```

**Update to:**
```markdown
2. **Synchronization: Server-Authoritative with Optimistic Updates**
   - Server acts as single source of truth for session state
   - Local UI updates occur immediately for responsive UX
   - Server reconciles conflicts automatically
   - PartyKit for real-time updates (<500ms latency) - Vercel-compatible WebSocket solution
   - PartyKit server handles session rooms (parties) and event broadcasting
   - Session state stored in PartyKit storage (24h) or external database for persistence
   - Automatic reconnection and state recovery handled by PartyKit client
```

### Section: Implementation Steps (Line ~231)

**Add new phase after Phase 6 (User Story 4 - Multi-Device Synchronization):**

```markdown
### Phase 6a: PartyKit Migration

**Goal:** Migrate from Socket.io to PartyKit for Vercel-compatible deployment

**Prerequisites:** Phase 6 (Synchronization) complete

**Migration Steps:**

1. **PartyKit Setup**
   - [ ] Install PartyKit dependencies (@partykit/react, partykit)
   - [ ] Create PartyKit project and configure partykit.json
   - [ ] Set up environment variables (NEXT_PUBLIC_PARTYKIT_HOST, PARTYKIT_TOKEN)
   - [ ] Deploy PartyKit server to Cloudflare Workers

2. **Server Migration**
   - [ ] Create parties/session.ts PartyKit server file
   - [ ] Port event handlers from src/lib/socket/server.ts to PartyKit
   - [ ] Implement participant tracking using PartyKit connections
   - [ ] Set up session storage (PartyKit storage or external database)
   - [ ] Implement 24-hour session expiration logic

3. **Client Migration**
   - [ ] Create src/lib/partykit/client.ts wrapper
   - [ ] Replace Socket.io client calls in all components
   - [ ] Update connection status tracking
   - [ ] Test reconnection and state recovery

4. **Infrastructure Changes**
   - [ ] Remove custom server (server.ts) or keep for local dev only
   - [ ] Update package.json scripts
   - [ ] Update deployment documentation
   - [ ] Remove Socket.io dependencies

5. **Testing & Deployment**
   - [ ] Update all socket-related tests
   - [ ] End-to-end testing of migration
   - [ ] Deploy PartyKit server
   - [ ] Update Vercel deployment configuration
   - [ ] Verify multi-device synchronization works

**Acceptance Criteria:**
- [ ] All Socket.io features work with PartyKit
- [ ] Multi-device synchronization maintains <500ms latency
- [ ] Session persistence works correctly (24h expiration)
- [ ] Reconnection handles gracefully
- [ ] Deployment to Vercel successful
- [ ] No increase in error rates

**Reference:** See `docs/PARTYKIT_MIGRATION_ANALYSIS.md` for detailed migration plan
```

### Section: Risks and Mitigations (Line ~419)

**Add:**
```markdown
- **Risk:** PartyKit migration introduces bugs or performance issues
  - **Mitigation:** Complete migration in development environment first, comprehensive testing before production, keep Socket.io code in separate branch for rollback

- **Risk:** PartyKit storage limitations (24h expiration) conflict with session persistence needs
  - **Mitigation:** Use external database (PostgreSQL/Redis) for persistent session storage if sessions need to last longer than 24h, PartyKit storage for volatile session state
```

---

## 3. Update `tasks.md`

### Add New Phase: Phase 6a - PartyKit Migration

**Insert after Phase 6 (before Phase 7):**

```markdown
## Phase 6a: PartyKit Migration

**Goal:** Migrate from Socket.io to PartyKit for Vercel-compatible real-time synchronization

**Independent Test Criteria:**
- PartyKit server deployed and accessible
- All Socket.io features work with PartyKit
- Multi-device synchronization maintains <500ms latency
- Session persistence works correctly
- Reconnection and state recovery work correctly
- Vercel deployment successful

**Dependencies:** Phase 6 complete (can be done after Phase 7 if needed)

### Tasks

- [ ] T265 [MIGRATION] Install PartyKit dependencies (@partykit/react, partykit) in package.json
- [ ] T266 [MIGRATION] Create PartyKit project configuration in partykit.json
- [ ] T267 [MIGRATION] Set up environment variables (NEXT_PUBLIC_PARTYKIT_HOST, PARTYKIT_TOKEN) in .env.local
- [ ] T268 [MIGRATION] Create PartyKit server file in parties/session.ts
- [ ] T269 [MIGRATION] Port session join/leave handlers from src/lib/socket/server.ts to parties/session.ts
- [ ] T270 [MIGRATION] Port VibeContext change handler to PartyKit in parties/session.ts
- [ ] T271 [MIGRATION] Port script update handler to PartyKit in parties/session.ts
- [ ] T272 [MIGRATION] Port performance progress handler to PartyKit in parties/session.ts
- [ ] T273 [MIGRATION] Port wrap party vote handler to PartyKit in parties/session.ts
- [ ] T274 [MIGRATION] Port performance start handler to PartyKit in parties/session.ts
- [ ] T275 [MIGRATION] Implement participant tracking using PartyKit connections in parties/session.ts
- [ ] T276 [MIGRATION] Set up session storage (PartyKit storage or external database) in parties/session.ts
- [ ] T277 [MIGRATION] Implement 24-hour session expiration logic in parties/session.ts
- [ ] T278 [MIGRATION] Create PartyKit client wrapper in src/lib/partykit/client.ts
- [ ] T279 [MIGRATION] Replace Socket.io client initialization with PartyKit in src/lib/partykit/client.ts
- [ ] T280 [MIGRATION] Replace socket.on() calls with PartyKit message listeners in src/lib/partykit/client.ts
- [ ] T281 [MIGRATION] Replace socket.emit() calls with PartyKit send() in src/lib/partykit/client.ts
- [ ] T282 [MIGRATION] Update connection status tracking for PartyKit in src/lib/partykit/client.ts
- [ ] T283 [MIGRATION] Update CastingCouch component to use PartyKit client in src/components/director/casting-couch.tsx
- [ ] T284 [MIGRATION] Update Teleprompter component to use PartyKit client in src/components/teleprompter/teleprompter.tsx
- [ ] T285 [MIGRATION] Update VotingInterface component to use PartyKit client in src/components/wrap-party/voting-interface.tsx
- [ ] T286 [MIGRATION] Update SessionJoinForm component to use PartyKit client in src/components/actor/session-join-form.tsx
- [ ] T287 [MIGRATION] Update session join page to use PartyKit client in src/app/join/[sessionCode]/page.tsx
- [ ] T288 [MIGRATION] Update ResetSessionButton to use PartyKit client in src/components/director/reset-session-button.tsx
- [ ] T289 [MIGRATION] Remove or update custom server (server.ts) - keep for local dev only if needed
- [ ] T290 [MIGRATION] Update package.json scripts (remove dev:server or update) in package.json
- [ ] T291 [MIGRATION] Remove Socket.io dependencies (socket.io, socket.io-client) from package.json
- [ ] T292 [MIGRATION] Update socket-related tests to use PartyKit mocks in src/lib/socket/*.test.ts
- [ ] T293 [MIGRATION] Update component tests that mock Socket.io in src/components/**/*.test.tsx
- [ ] T294 [MIGRATION] Test session join/leave flow with PartyKit
- [ ] T295 [MIGRATION] Test VibeContext synchronization with PartyKit
- [ ] T296 [MIGRATION] Test script update synchronization with PartyKit
- [ ] T297 [MIGRATION] Test performance progress synchronization with PartyKit
- [ ] T298 [MIGRATION] Test wrap party vote synchronization with PartyKit
- [ ] T299 [MIGRATION] Test reconnection and state recovery with PartyKit
- [ ] T300 [MIGRATION] Deploy PartyKit server to Cloudflare Workers
- [ ] T301 [MIGRATION] Update Vercel deployment configuration for PartyKit
- [ ] T302 [MIGRATION] Verify end-to-end multi-device synchronization with PartyKit
- [ ] T303 [MIGRATION] Performance test: Verify <500ms latency maintained with PartyKit
- [ ] T304 [MIGRATION] Clean up old Socket.io files (src/lib/socket/server.ts, src/lib/socket/client.ts, src/lib/socket/session-store.ts) after migration verified
```

### Update Task Summary

**In Phase 6a section, update totals:**
```markdown
**Total Tasks:** 304 (was 231, added 73 migration tasks)
```

---

## 4. Optional: Update `research.md`

If you have a `research.md` file, add:

```markdown
## Real-Time Synchronization Platform Selection

**Decision:** Use PartyKit for real-time WebSocket communication

**Rationale:**
- Vercel doesn't support custom servers or native WebSocket connections
- PartyKit provides Vercel-compatible WebSocket support via Cloudflare Workers
- Free tier covers MVP needs (10 projects, 24h storage)
- Similar API to Socket.io (easier migration)
- Automatic reconnection and state management

**Alternatives Considered:**
1. Socket.io + Separate Server (Railway/Render) - Requires managing two deployments
2. Server-Sent Events (SSE) - One-way communication, limited functionality
3. Supabase Realtime - Requires PostgreSQL, different architecture
4. Pusher/Ably - More expensive, vendor lock-in

**Implementation Details:**
- See `docs/PARTYKIT_MIGRATION_ANALYSIS.md` for complete migration plan
- Migration estimated at 2-3 days
- No data loss expected (sessions are ephemeral)

**Status:** ✅ RESOLVED - Migration planned for Phase 6a
```

---

## 5. Execution Order

**Recommended Update Sequence:**

1. **Update `spec.md`** first (assumptions, dependencies, open questions)
2. **Update `plan.md`** second (architecture decisions, implementation steps, risks)
3. **Update `tasks.md`** last (add migration phase, update task counts)

**Why this order:**
- Spec defines the "what" and "why"
- Plan defines the "how"
- Tasks define the actionable steps

---

## 6. Validation Checklist

After updating all files, verify:

- [ ] `spec.md` mentions PartyKit in assumptions and dependencies
- [ ] `spec.md` has resolved question about real-time platform
- [ ] `plan.md` architecture decision updated to PartyKit
- [ ] `plan.md` has Phase 6a migration section
- [ ] `tasks.md` has Phase 6a with all migration tasks
- [ ] Task IDs are sequential (continue from existing tasks)
- [ ] All migration tasks have file paths specified
- [ ] Test tasks included for migration verification
- [ ] Task summary updated with new totals

---

## 7. Next Steps

After updating spec-kit files:

1. **Review Changes**: Have team review updated spec/plan/tasks
2. **Plan Migration**: Schedule Phase 6a migration (recommended after Phase 6 or Phase 7)
3. **Set Up PartyKit**: Create PartyKit account and project
4. **Begin Migration**: Follow tasks in Phase 6a sequentially
5. **Test Thoroughly**: Verify all real-time features work before removing Socket.io

---

## References

- Full Migration Analysis: `docs/PARTYKIT_MIGRATION_ANALYSIS.md`
- PartyKit Documentation: https://docs.partykit.io
- PartyKit + Next.js Guide: https://docs.partykit.io/tutorials/add-partykit-to-a-nextjs-app
