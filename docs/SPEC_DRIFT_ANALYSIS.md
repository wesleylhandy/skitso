# Specification Drift Analysis Report

**Generated:** 2026-01-27  
**Purpose:** Document changes made beyond the defined spec and analyze test failures to identify requirement changes vs. drift

## Executive Summary

- **Total Tests:** 273
- **Passing:** 240 (88%)
- **Failing:** 33 (12%)
- **Test Files:** 43 total (9 failed, 34 passed)

### Key Findings

1. **PartyKit Migration Not Implemented**: Spec requires PartyKit (Phase 6a), but code still uses Socket.io
2. **React 19/Next.js 15+ Compatibility Issues**: `use()` hook implementation causing test failures
3. **Test Infrastructure Gaps**: Missing mocks for Next.js router and Socket.io server
4. **API Route Behavior Mismatches**: Status code expectations don't match implementation

---

## Changes Beyond Spec (From .specstory)

### 1. Next.js 15+ `params` Promise Change
**File:** `src/app/join/[sessionCode]/page.tsx`  
**Change:** Updated to use `React.use()` to unwrap `params` Promise  
**Reason:** Next.js 15+ breaking change - `params` is now a Promise  
**Status:** ✅ Correct implementation, but tests need updating  
**Spec Reference:** Not in spec (framework upgrade requirement)

### 2. Session Loading via REST + Socket Hybrid
**File:** `src/app/join/[sessionCode]/page.tsx`  
**Change:** Implemented REST API fallback before Socket connection  
**Reason:** User reported "session not found" - needed server-side session lookup  
**Status:** ⚠️ Implementation detail not in spec, but reasonable  
**Spec Reference:** FR-5 mentions synchronization, but doesn't specify REST fallback

### 3. Socket.io Still in Use (PartyKit Migration Pending)
**Files:** All `src/lib/socket/*` files  
**Change:** Still using Socket.io instead of PartyKit  
**Reason:** Phase 6a (PartyKit migration) not yet implemented  
**Status:** ❌ **DRIFT** - Spec explicitly requires PartyKit migration  
**Spec Reference:** 
- `spec.md` line 281: "Implemented using PartyKit for Vercel-compatible WebSocket support"
- `tasks.md` Phase 6a: 42 migration tasks (all marked `[ ]` - not done)

---

## Test Failure Analysis

### Category 1: Framework Compatibility (13 failures)

#### VibeSelector Tests (13 failures)
**Files:** `src/components/vibes/vibe-selector.test.tsx`

**Root Cause:** Next.js `useRouter()` requires App Router context in tests

**Failures:**
- All 13 tests in vibe-selector.test.tsx fail with: `Error: invariant expected app router to be mounted`

**Analysis:**
- **Type:** Test infrastructure gap (not spec drift)
- **Fix Required:** Mock Next.js router in test setup
- **Impact:** Medium - Component works in app, tests just need proper mocking

**Example Error:**
```
Error: invariant expected app router to be mounted
 ❯ useRouter node_modules/next/dist/client/components/navigation.js:137:37
 ❯ VibeSelector src/components/vibes/vibe-selector.tsx:30:18
```

---

### Category 2: React 19 `use()` Hook (6 failures)

#### SessionJoinPage Tests (6 failures)
**File:** `src/app/join/[sessionCode]/page.test.tsx`

**Root Cause:** Tests not properly handling `use(params)` Promise unwrapping

**Failures:**
- `should extract session code from URL params`
- `should load session data on mount`
- `should sync VibeContext from session`
- `should update vibeAtom with Director's selected vibe on join (T087)`
- `should sync VibeContext immediately when session loads (T087 - timing)`
- `should have a back button that navigates to root`

**Analysis:**
- **Type:** Test needs updating for React 19/Next.js 15+ changes
- **Fix Required:** Update test to properly mock `params` as Promise
- **Impact:** Medium - Implementation is correct, tests need modernization

**Example Error:**
```
Error: An unsupported type was passed to use(): [object Object]
 ❯ Object.use node_modules/react-dom/cjs/react-dom-client.development.js:7890:13
 ❯ SessionJoinPage src/app/join/[sessionCode]/page.tsx:32:27
     32|   const { sessionCode } = use(params);
```

---

### Category 3: API Route Status Code Mismatches (3 failures)

#### Session API Route Tests (3 failures)
**File:** `src/app/api/sessions/[sessionId]/route.test.ts`

**Root Cause:** Implementation returns different status codes than tests expect

**Failures:**
1. `should return 404 for non-existent session`
   - Expected: 404
   - Actual: 400 (validation error for invalid session code format)
   - **Analysis:** Implementation validates format first, then checks existence
   - **Type:** Implementation detail (not spec drift)
   - **Fix:** Test should use valid format session code, or implementation should check existence before format validation

2. `should return 410 for expired session`
   - Expected: 410
   - Actual: 404 (session not found in in-memory store)
   - **Analysis:** Test doesn't properly set up expired session in store
   - **Type:** Test setup issue (not spec drift)
   - **Fix:** Test needs to create session in store with expired timestamp

3. `should return session data for valid session`
   - Expected: 200
   - Actual: 404 (session not found in in-memory store)
   - **Analysis:** Test doesn't properly set up session in store
   - **Type:** Test setup issue (not spec drift)
   - **Fix:** Test needs to create session in store before making request

**Analysis:**
- **Type:** Test setup gaps (not spec drift)
- **Fix Required:** Properly initialize session store in tests
- **Impact:** Low - Implementation logic is correct, tests need better setup

---

### Category 4: Socket.io Connection Issues (11 failures)

#### Synchronization Tests (11 failures)
**File:** `src/lib/socket/synchronization.test.ts`

**Root Cause:** Tests try to connect to Socket.io server on localhost:3000, but server isn't running in test environment

**Failures:**
- `should broadcast VibeContext changes within 500ms`
- `should broadcast script updates within 500ms`
- `should broadcast performance progress updates within 500ms` (2 instances)
- `should recover session state after reconnection` (2 instances)
- `should maintain session state during reconnection` (2 instances)
- `should recover participant list after reconnection` (2 instances)

**Analysis:**
- **Type:** Test infrastructure gap (not spec drift)
- **Fix Required:** Mock Socket.io server or start test server in test setup
- **Impact:** Medium - Tests need proper Socket.io server mocking
- **Note:** These tests are for Socket.io, but spec requires PartyKit migration

**Example Error:**
```
Socket.io connection error: TransportError: websocket error
Error: connect ECONNREFUSED 127.0.0.1:3000
```

---

## Specification Drift Summary

### Critical Drift (Must Fix)

1. **PartyKit Migration Not Implemented** ⚠️
   - **Spec Requirement:** Phase 6a - Migrate from Socket.io to PartyKit
   - **Current State:** Still using Socket.io
   - **Impact:** Cannot deploy to Vercel (Vercel doesn't support Socket.io)
   - **Tasks:** 42 tasks in Phase 6a all uncompleted
   - **Files Affected:** All `src/lib/socket/*` files

### Acceptable Changes (Not Drift)

1. **React 19 `use()` Hook** ✅
   - Framework requirement, not spec drift
   - Implementation is correct
   - Tests need updating

2. **REST API Fallback for Session Loading** ✅
   - Reasonable implementation detail
   - Improves reliability
   - Not explicitly in spec, but doesn't conflict

3. **Test Infrastructure Gaps** ✅
   - Missing mocks for Next.js router
   - Missing Socket.io server in test environment
   - Not spec drift, just test setup issues

---

## Recommendations

### Priority 1: Complete PartyKit Migration
**Why:** Blocks Vercel deployment, explicitly required by spec  
**Tasks:** Complete Phase 6a (42 tasks)  
**Estimated Effort:** High (major refactor)

### Priority 2: Fix Test Infrastructure
**Why:** 30/33 failures are test setup issues, not implementation bugs  
**Tasks:**
1. Mock Next.js router in test setup
2. Mock Socket.io server or use test server
3. Update tests for React 19 `use()` hook
4. Fix session store initialization in API route tests

**Estimated Effort:** Medium (test infrastructure work)

### Priority 3: Update Spec Documentation
**Why:** Document implementation decisions made during development  
**Tasks:**
1. Add REST API fallback pattern to spec
2. Document React 19 compatibility requirements
3. Update test requirements section

**Estimated Effort:** Low (documentation)

---

## Test Failure Breakdown by Category

| Category | Count | Type | Fix Complexity |
|----------|-------|------|----------------|
| Framework Compatibility | 13 | Test Infrastructure | Medium |
| React 19 `use()` Hook | 6 | Test Updates | Medium |
| API Route Status Codes | 3 | Test Setup | Low |
| Socket.io Connection | 11 | Test Infrastructure | Medium |
| **Total** | **33** | | |

---

## Conclusion

**Most test failures (30/33) are due to test infrastructure gaps, not specification drift.**

The **critical issue** is the missing PartyKit migration, which is explicitly required by the spec but not yet implemented. This blocks Vercel deployment.

**Action Items:**
1. ✅ Complete PartyKit migration (Phase 6a)
2. ✅ Fix test infrastructure (mocks, setup)
3. ✅ Update tests for React 19/Next.js 15+ compatibility
4. ✅ Document implementation decisions in spec

---

## Appendix: Files Requiring Updates

### Implementation Files (PartyKit Migration)
- `src/lib/socket/client.ts` → Migrate to `src/lib/partykit/client.ts`
- `src/lib/socket/server.ts` → Migrate to `parties/session.ts`
- All components using Socket.io client

### Test Files (Infrastructure Fixes)
- `src/test/setup.ts` - Add Next.js router mock
- `src/components/vibes/vibe-selector.test.tsx` - Mock router
- `src/app/join/[sessionCode]/page.test.tsx` - Update for `use()` hook
- `src/app/api/sessions/[sessionId]/route.test.ts` - Fix session store setup
- `src/lib/socket/synchronization.test.ts` - Mock Socket.io server

### Documentation Files
- `specs/001-skitso-platform/spec.md` - Document REST API fallback
- `specs/001-skitso-platform/tasks.md` - Mark Phase 6a tasks as in-progress
