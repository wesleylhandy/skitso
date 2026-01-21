# Tasks: Skitso Platform

**Feature:** Skitso - AI-Assisted Collaborative Performance Platform  
**Branch:** 001-skitso-platform  
**Generated:** 2025-01-27

## Overview

This document contains actionable, dependency-ordered tasks for implementing the Skitso platform. Tasks are organized by user story to enable independent implementation and testing. Each task includes specific file paths and can be completed by an LLM without additional context.

## Implementation Strategy

**MVP Scope:** User Stories 1-5 (Director selects vibe, configures session, Actor joins, synchronization, teleprompter)  
**Post-MVP:** User Stories 6-7 (Wrap Party, Premium features)

**Delivery Approach:**
- Incremental delivery: Each user story phase is independently testable
- Parallel execution: Tasks marked [P] can be worked on in parallel
- MVP first: Focus on core collaborative performance flow
- Progressive enhancement: Browser storage first, backend sync later

## Dependencies

**Story Completion Order:**
1. Phase 1: Setup (blocks all)
2. Phase 2: Foundational (VibeContext system - blocks all user stories)
3. Phase 3: US1 - Director Selects VibeContext (blocks US2)
4. Phase 4: US2 - Director Configures Session (blocks US3, US4)
5. Phase 5: US3 - Actor Joins Session (blocks US4, US5)
6. Phase 6: US4 - Multi-Device Synchronization (blocks US5)
7. Phase 6a: PartyKit Migration (recommended after Phase 6 or Phase 7, enables Vercel deployment)
8. Phase 7: US5 - Teleprompter Performance (blocks US6)
9. Phase 8: US6 - Wrap Party (independent)
10. Phase 9: US7 - Premium Features (independent, post-MVP)

## Phase 1: Setup

**Goal:** Initialize project structure, install dependencies, configure development environment

**Independent Test Criteria:**
- Project builds without errors
- TypeScript strict mode enabled
- All dependencies installed
- Directory structure matches constitution

### Tasks

- [X] T001 Create Next.js 16+ project with App Router in project root
- [X] T002 Configure TypeScript strict mode in tsconfig.json
- [X] T003 Install core dependencies: jotai, jotai-utils, openai, zod, socket.io, socket.io-client in package.json
- [X] T004 Install development dependencies: @types/node, @types/react, typescript, tailwindcss, postcss, autoprefixer in package.json
- [X] T005 Configure Tailwind CSS v4 with CSS Variables support in tailwind.config.js
- [X] T006 Create directory structure: src/app, src/components/ui, src/components/vibes, src/components/director, src/components/teleprompter, src/state, src/lib/openai, src/lib/socket, src/lib/hooks, src/styles
- [X] T007 Create .env.local template with OPENAI_API_KEY and NEXT_PUBLIC_APP_URL placeholders
- [X] T008 Configure Next.js app router layout in src/app/layout.tsx
- [X] T009 Set up global CSS file in src/styles/globals.css with base Tailwind imports

## Phase 2: Foundational - VibeContext System

**Goal:** Implement core VibeContext infrastructure that all features depend on

**Independent Test Criteria:**
- VibeContext types defined and exported
- vibeAtom persists to localStorage
- CSS variables defined for all five vibes (including layout patterns)
- Text registry created for all five vibes with all UI labels
- SVG logo definitions created for all five vibes
- ThemeProvider applies data-theme attribute and switches text registry atomically
- Theme switching completes in <100ms (including text and logo changes, per constitution Principle 5)

**Blocks:** All user story phases

### Tasks

- [X] T010 [P] Define VibeType enum and VibeContext interface in src/state/types/vibe.ts
- [X] T011 [P] Create VibeContext configuration objects for all five vibes in src/state/config/vibe-configs.ts
- [X] T011a [P] Create centralized text registry per VibeContext (all UI labels, button text, placeholders, section titles, messages) in src/state/config/vibe-text-registry.ts
- [X] T011b [P] Define SVG logo per VibeContext with theme-specific typography styling in src/components/vibes/logos/vibe-logo.tsx
- [X] T011c [P] Implement logo animation system (glitch effects, pulsing, scanlines) with optional activation in src/components/vibes/logos/logo-animations.ts
- [X] T012 Create vibeAtom with atomWithStorage in src/state/atoms/vibe-atom.ts
- [X] T013 [P] Define CSS variables for VIRAL_NEON vibe (including layout patterns: card styles, spacing, component arrangements) in src/styles/globals.css
- [X] T014 [P] Define CSS variables for INDIE_A24 vibe (including layout patterns) in src/styles/globals.css
- [X] T015 [P] Define CSS variables for SITCOM_STUDIO vibe (including layout patterns) in src/styles/globals.css
- [X] T016 [P] Define CSS variables for BRAINROT_THEATER vibe (including layout patterns) in src/styles/globals.css
- [X] T017 [P] Define CSS variables for QUIET_STUDIO vibe (including layout patterns) in src/styles/globals.css
- [X] T018 Create ThemeProvider component that subscribes to vibeAtom, applies data-theme attribute, and switches text registry atomically in src/components/vibes/theme-provider.tsx
- [X] T018a Update ThemeProvider to handle logo display and animations in src/components/vibes/theme-provider.tsx
- [X] T019 Create useVibe hook for accessing current vibe config (including text registry access) in src/lib/hooks/use-vibe.ts
- [X] T020 Integrate ThemeProvider into root layout in src/app/layout.tsx
- [X] T021 Test theme switching performance including text registry and logo changes (must complete in <100ms per constitution Principle 5)

## Phase 3: User Story 1 - Director Selects VibeContext

**Goal:** Director can select from five production styles and see instant visual transformation

**User Story:** As a Director, I want to select a production style (VibeContext) that transforms the entire app's aesthetic, so that I can create an immersive, cohesive performance experience.

**Independent Test Criteria:**
- Five vibe cards displayed on vibe selection page
- Clicking a vibe updates vibeAtom and triggers visual transformation
- Visual transformation completes in <1 second
- All UI elements (colors, fonts, buttons) adapt to selected vibe
- Selection persists across browser refresh

**Dependencies:** Phase 2 complete

### Tasks

- [X] T022 [US1] Create vibe selection page route in src/app/vibe-selection/page.tsx
- [X] T023 [US1] [P] Create VibeCard component for displaying vibe preview in src/components/vibes/vibe-card.tsx
- [X] T024 [US1] [P] Create VibeSelector component with five vibe cards in src/components/vibes/vibe-selector.tsx
- [X] T025 [US1] Implement vibe selection handler that updates vibeAtom in src/components/vibes/vibe-selector.tsx
- [X] T026 [US1] Add vibe preview images/assets to public/vibes/ directory
- [X] T027 [US1] Style VibeSelector to match each vibe's aesthetic (use CSS variables)
- [X] T028 [US1] Add keyboard navigation support to VibeSelector in src/components/vibes/vibe-selector.tsx
- [X] T029 [US1] Add screen reader support with ARIA labels in src/components/vibes/vibe-selector.tsx
- [X] T030 [US1] Add transition animation for vibe selection (500ms cross-dissolve) in src/components/vibes/vibe-selector.tsx
- [X] T031 [US1] Test vibe selection and visual transformation (<100ms requirement per constitution Principle 5)

## Phase 4: User Story 2 - Director Configures Session

**Goal:** Director can configure skit parameters and generate script/characters via AI

**User Story:** As a Director, I want to configure skit parameters (theme, tone, participants, chaos level), so that the AI generates contextually-appropriate scripts and characters.

**Independent Test Criteria:**
- Director can input theme (10-200 chars), tone, participant count (2-10), chaos level (1-10)
- Form validates inputs before submission
- AI generation completes within 30 seconds
- Generated content matches selected VibeContext style
- Session code (8-10 chars alphanumeric) and shareable link generated
- Configuration persists in browser storage

**Dependencies:** Phase 3 complete

### Tasks

- [X] T032 [US2] Create Director's Desk page route in src/app/director-desk/page.tsx
- [X] T033 [US2] [P] Create DirectorConfigForm component in src/components/director/director-config-form.tsx
- [X] T033a [US2] [P] Apply theme-specific layout patterns (card styles, spacing, component arrangements from VibeContext) in src/components/director/director-config-form.tsx
- [X] T033b [US2] [P] Use theme-specific section titles from text registry (e.g., "The Vibe" vs "Genre Selection") in src/components/director/director-config-form.tsx
- [X] T033c [US2] [P] Use theme-specific button labels and placeholder text from text registry in src/components/director/director-config-form.tsx
- [X] T033d [US2] [P] Apply theme-specific visual effects (glows, borders, shadows) from VibeContext config in src/components/director/director-config-form.tsx
- [X] T034 [US2] [P] Implement theme input field (10-200 chars) in src/components/director/director-config-form.tsx
- [X] T035 [US2] [P] Implement tone preference dropdown in src/components/director/director-config-form.tsx
- [X] T036 [US2] [P] Implement participant count input (2-10 range) in src/components/director/director-config-form.tsx
- [X] T037 [US2] [P] Implement chaos level slider (1-10) in src/components/director/director-config-form.tsx
- [ ] T038 [US2] [P] Add optional character pre-definition interface in src/components/director/director-config-form.tsx
- [X] T039 [US2] Create Zod validation schema for configuration in src/lib/validation/session-config-schema.ts
- [X] T040 [US2] Implement form validation using Zod schema in src/components/director/director-config-form.tsx
- [X] T041 [US2] Style form to match active VibeContext (use CSS variables) in src/components/director/director-config-form.tsx
- [X] T042 [US2] Create OpenAI API client wrapper in src/lib/openai/client.ts
- [X] T043 [US2] Create slang registry data structure for VIRAL_NEON vibe in src/lib/data/slang-registry.ts
- [X] T044 [US2] Create character generation prompt template with VibeContext in src/lib/openai/prompts/character-prompt.ts (reference: specs/001-skitso-platform/prompts/character-generation-prompt.md)
- [X] T045 [US2] Create script generation prompt template with VibeContext in src/lib/openai/prompts/script-prompt.ts (reference: specs/001-skitso-platform/prompts/script-generation-prompt.md)
- [X] T046 [US2] Create character image generation prompt template with VibeContext in src/lib/openai/prompts/image-prompt.ts (reference: specs/001-skitso-platform/prompts/character-image-generation-prompt.md)
- [X] T047 [US2] Create API route for character generation in src/app/api/openai/characters/route.ts
- [X] T048 [US2] Create API route for script generation in src/app/api/openai/script/route.ts
- [X] T049 [US2] Create API route for character image generation in src/app/api/openai/character-image/route.ts
- [X] T050 [US2] Implement retry logic with simplified prompts on failure in src/app/api/openai/characters/route.ts
- [X] T051 [US2] Implement retry logic with simplified prompts on failure in src/app/api/openai/script/route.ts
- [X] T052 [US2] Add Zod response validation for character generation in src/app/api/openai/characters/route.ts
- [X] T053 [US2] Add Zod response validation for script generation in src/app/api/openai/script/route.ts
- [X] T054 [US2] Implement rate limiting for OpenAI API (10 requests/user/hour) in src/lib/openai/rate-limiter.ts
- [X] T055 [US2] Integrate rate limiting middleware into OpenAI API routes in src/app/api/openai/characters/route.ts
- [X] T056 [US2] Integrate rate limiting middleware into OpenAI API routes in src/app/api/openai/script/route.ts
- [X] T057 [US2] Create vibe-appropriate error messages component in src/components/ui/error-message.tsx
- [X] T058 [US2] Add loading states for AI generation in src/components/director/director-config-form.tsx
- [X] T059 [US2] Create session code generation utility (8-10 chars alphanumeric, cryptographically secure) in src/lib/utils/session-code.ts
- [X] T060 [US2] Implement session code security validation (128-bit entropy check) in src/lib/utils/session-code.ts
- [X] T061 [US2] Create sessionCodeAtom with atomWithStorage in src/state/atoms/session-atom.ts
- [X] T062 [US2] Create sessionStateAtom with atomWithStorage in src/state/atoms/session-state-atom.ts
- [X] T063 [US2] Generate shareable link format (https://skitso.app/join/{code}) in src/lib/utils/session-code.ts
- [X] T064 [US2] Create session sharing UI component in src/components/director/session-share.tsx
- [X] T065 [US2] Create castAtom with atomWithStorage for storing generated characters in src/state/atoms/cast-atom.ts
- [X] T066 [US2] Create currentScriptAtom with atomWithStorage for storing generated script in src/state/atoms/script-atom.ts
- [X] T067 [US2] Create chaosLevelAtom with atomWithStorage in src/state/atoms/chaos-atom.ts
- [X] T068 [US2] Store generated characters in castAtom after AI generation in src/components/director/director-config-form.tsx
- [X] T069 [US2] Store generated script in currentScriptAtom after AI generation in src/components/director/director-config-form.tsx
- [X] T070 [US2] Test AI generation completion time (<30 seconds requirement)
- [X] T071 [US2] Test generated content matches selected VibeContext style
- [X] T071a [US2] Test theme-specific layout patterns, section titles, and button labels display correctly in Director's Desk

## Phase 5: User Story 3 - Actor Joins Session

**Goal:** Actor can join session using code/link and receive character assignment

**User Story:** As an Actor, I want to join a session using a code or link, so that I can participate in a collaborative performance. I want my device to automatically sync to the Director's VibeContext and receive a character assignment immediately upon joining.

**Independent Test Criteria:**
- Actor can enter session code or use shareable link
- Actor's device syncs to Director's VibeContext immediately
- Character assignment occurs within 5 seconds of joining
- Character visual representation displayed
- Join process completes in under 30 seconds

**Dependencies:** Phase 4 complete

### Tasks

- [X] T072 [US3] Create session join page route in src/app/join/[sessionCode]/page.tsx
- [X] T073 [US3] Create session join form component in src/components/actor/session-join-form.tsx
- [X] T074 [US3] Implement session code input field in src/components/actor/session-join-form.tsx
- [X] T075 [US3] Implement shareable link handling (extract code from URL) in src/app/join/[sessionCode]/page.tsx
- [X] T076 [US3] Create session lookup API route in src/app/api/sessions/[sessionId]/route.ts
- [X] T077 [US3] Implement session validation (check if exists, not expired) in src/app/api/sessions/[sessionId]/route.ts
- [X] T078 [US3] Create participantAtom with atomWithStorage in src/state/atoms/participant-atom.ts
- [X] T079 [US3] Implement automatic character assignment on join (if not pre-defined) in src/app/api/sessions/[sessionId]/join/route.ts
- [X] T080 [US3] Create character assignment API route in src/app/api/sessions/[sessionId]/join/route.ts
- [X] T081 [US3] Store participant data in participantAtom after join in src/components/actor/session-join-form.tsx
- [X] T082 [US3] Sync VibeContext from session to Actor's device in src/app/join/[sessionCode]/page.tsx
- [X] T083 [US3] Update vibeAtom with Director's selected vibe on join in src/app/join/[sessionCode]/page.tsx
- [X] T084 [US3] Create character display component showing name, archetype, visual representation in src/components/actor/character-card.tsx
- [X] T085 [US3] Display assigned character immediately after join in src/components/actor/session-join-form.tsx
- [X] T086 [US3] Test character assignment timing (<5 seconds requirement)
- [X] T087 [US3] Test VibeContext synchronization on join

## Phase 6: User Story 4 - Multi-Device Synchronization

**Goal:** All devices synchronize session state in real-time using Socket.io

**User Story:** As a Director/Actor, I want all devices to synchronize session state in real-time, so that all participants see the same VibeContext, script updates, and performance progress.

**Independent Test Criteria:**
- Socket.io connection established on session join
- VibeContext changes broadcast to all participants within 500ms
- Script updates synchronize across devices within 500ms
- Connection status visible to all participants
- Reconnection restores synchronized state

**Dependencies:** Phase 5 complete

### Tasks

- [X] T088 [US4] Install Socket.io server and client dependencies (socket.io, socket.io-client) in package.json (if not already installed)
- [X] T089 [US4] Create Socket.io server initialization in src/lib/socket/server.ts
- [X] T090 [US4] Create Socket.io client initialization in src/lib/socket/client.ts
- [X] T091 [US4] Create Socket.io API route handler in src/app/api/socket/route.ts
- [X] T092 [US4] Implement session room management (socket.join(sessionId)) in src/lib/socket/server.ts
- [X] T093 [US4] Create CastingCouch component in src/components/director/casting-couch.tsx
- [X] T094 [US4] Implement VibeContext synchronization event (broadcast to room) in src/lib/socket/server.ts
- [X] T095 [US4] Implement script update synchronization event in src/lib/socket/server.ts
- [X] T096 [US4] Implement performance progress synchronization event in src/lib/socket/server.ts
- [X] T097 [US4] Create session state management on server (in-memory store) in src/lib/socket/session-store.ts
- [X] T098 [US4] Implement optimistic updates (local UI updates immediately) in src/lib/socket/client.ts
- [X] T099 [US4] Implement server conflict resolution logic in src/lib/socket/server.ts
- [X] T100 [US4] Implement automatic reconnection with exponential backoff in src/lib/socket/client.ts
- [X] T101 [US4] Implement reconnection state recovery in src/lib/socket/client.ts
- [X] T102 [US4] Create connection status indicator component in src/components/ui/connection-status.tsx
- [X] T103 [US4] Display connection status to all participants in src/components/director/casting-couch.tsx
- [X] T104 [US4] Display connection status to all participants in src/components/actor/session-join-form.tsx
- [X] T105 [US4] Implement participant list with connection status in src/components/director/casting-couch.tsx
- [X] T106 [US4] Implement character assignment display (immediate on join) in src/components/director/casting-couch.tsx
- [X] T107 [US4] Create Director character override interface in src/components/director/casting-couch.tsx
- [X] T108 [US4] Implement Start Performance button (Director only) in src/components/director/casting-couch.tsx
- [X] T108a [US4] Create CharacterDossier component (detailed character view screen) in src/components/actor/character-dossier.tsx
- [X] T108b [US4] Implement Character Dossier display of full character information (name, archetype, traits, visual representation) in src/components/actor/character-dossier.tsx
- [X] T108c [US4] Implement hidden motivation display (visible only to assigned Actor) in src/components/actor/character-dossier.tsx
- [X] T108d [US4] Apply theme-specific layout and styling from VibeContext to Character Dossier in src/components/actor/character-dossier.tsx
- [X] T108e [US4] Use theme-specific text labels from text registry in Character Dossier in src/components/actor/character-dossier.tsx
- [X] T108f [US4] Implement navigation from Casting Couch to Character Dossier (via character card click or button) in src/components/director/casting-couch.tsx
- [X] T108g [US4] Implement navigation back to Casting Couch from Character Dossier in src/components/actor/character-dossier.tsx
- [X] T108h [US4] Ensure Character Dossier available throughout Casting Couch phase in src/components/actor/character-dossier.tsx
- [X] T109 [US4] Test synchronization latency (<500ms requirement)
- [X] T110 [US4] Test reconnection and state recovery

## Phase 6a: PartyKit Migration

**Goal:** Migrate from Socket.io to PartyKit for Vercel-compatible real-time synchronization

**Independent Test Criteria:**
- PartyKit server deployed and accessible (manual deployment successful)
- GitHub Actions CI/CD workflow configured and tested (automated deployment works)
- PartyKit token generated and stored securely in GitHub secrets
- All Socket.io features work with PartyKit
- Multi-device synchronization maintains <500ms latency
- Session persistence works correctly using PartyKit storage (24h expiration)
- Reconnection and state recovery work correctly
- Vercel deployment configuration updated with PartyKit host URL
- Vercel deployment successful

**Dependencies:** Phase 6 complete (can be done after Phase 7 if needed)

**Note:** This migration updates Socket.io implementations in completed tasks:
- T125/T126 (script advancement sync) → Migrated to T271/T272 (PartyKit)
- T142 (vote sync) → Migrated to T273 (PartyKit)
- All other Socket.io references in Phase 6, 7, 8 → Updated in corresponding Phase 6a tasks

### Tasks

- [X] T265 [MIGRATION] Install PartyKit dependencies (@partykit/react, partykit) in package.json
- [X] T266 [MIGRATION] Create PartyKit project configuration in partykit.json
- [X] T266a [MIGRATION] Set up local PartyKit development server: Install concurrently package (`npm install --save-dev concurrently`), add `"dev:partykit": "partykit dev"` script to package.json, and optionally add `"dev:all": "concurrently \"npm run dev\" \"npm run dev:partykit\""` for running both Next.js and PartyKit dev servers simultaneously
- [X] T267 [MIGRATION] Set up environment variables in .env.local: NEXT_PUBLIC_PARTYKIT_HOST (PartyKit server URL, e.g., https://skitso.[username].partykit.dev) and PARTYKIT_TOKEN (Note: PARTYKIT_TOKEN only needed for CI/CD automation, not local dev)
- [X] T267a [MIGRATION] Update .env.example template with PartyKit variables: Add NEXT_PUBLIC_PARTYKIT_HOST (commented with example URL) and PARTYKIT_TOKEN (commented, note: CI/CD only) in .env.example
- [X] T268 [MIGRATION] Create PartyKit server file in parties/session.ts
- [X] T269 [MIGRATION] Port session join/leave handlers from src/lib/socket/server.ts to parties/session.ts
- [X] T270 [MIGRATION] Port VibeContext change handler to PartyKit in parties/session.ts
- [X] T271 [MIGRATION] Port script update handler to PartyKit in parties/session.ts
- [X] T272 [MIGRATION] Port performance progress handler to PartyKit in parties/session.ts
- [X] T273 [MIGRATION] Port wrap party vote handler to PartyKit in parties/session.ts
- [X] T274 [MIGRATION] Port performance start handler to PartyKit in parties/session.ts
- [X] T275 [MIGRATION] Implement participant tracking using PartyKit connections in parties/session.ts
- [X] T276 [MIGRATION] Set up PartyKit storage for session state (24h expiration matches FR-9 requirement) in parties/session.ts
- [X] T277 [MIGRATION] Implement 24-hour session expiration logic in parties/session.ts
- [X] T278 [MIGRATION] Create PartyKit client wrapper in src/lib/partykit/client.ts
- [X] T279 [MIGRATION] Replace Socket.io client initialization with PartyKit in src/lib/partykit/client.ts
- [X] T280 [MIGRATION] Replace socket.on() calls with PartyKit message listeners in src/lib/partykit/client.ts
- [X] T281 [MIGRATION] Replace socket.emit() calls with PartyKit send() in src/lib/partykit/client.ts
- [X] T282 [MIGRATION] Update connection status tracking for PartyKit: Map Socket.io events (connect/disconnect/reconnect) to PartyKit events (open/close/error) in src/components/ui/connection-status.tsx and src/lib/partykit/client.ts
- [X] T283 [MIGRATION] Update CastingCouch component to use PartyKit client in src/components/director/casting-couch.tsx
- [X] T284 [MIGRATION] Update Teleprompter component to use PartyKit client in src/components/teleprompter/teleprompter.tsx
- [X] T285 [MIGRATION] Update VotingInterface component to use PartyKit client in src/components/wrap-party/voting-interface.tsx
- [X] T286 [MIGRATION] Update SessionJoinForm component to use PartyKit client in src/components/actor/session-join-form.tsx
- [X] T287 [MIGRATION] Update session join page to use PartyKit client in src/app/join/[sessionCode]/page.tsx
- [X] T288 [MIGRATION] Update ResetSessionButton to use PartyKit client in src/components/director/reset-session-button.tsx
- [X] T289 [MIGRATION] Remove or update custom server (server.ts): Keep server.ts only during migration transition period if running Socket.io and PartyKit in parallel for testing. Remove after migration verified and all Socket.io code is cleaned up.
- [X] T290 [MIGRATION] Update package.json scripts (remove dev:server or update) in package.json
- [X] T291 [MIGRATION] Remove Socket.io dependencies (socket.io, socket.io-client) from package.json
- [X] T292 [MIGRATION] Update socket-related tests to use PartyKit mocks in src/lib/socket/*.test.ts (Note: synchronization.test.ts needs full rewrite for PartyKit integration testing)
- [X] T293 [MIGRATION] Update component tests that mock Socket.io in src/components/**/*.test.tsx
- [X] T294 [MIGRATION] Test session join/leave flow with PartyKit
- [X] T295 [MIGRATION] Test VibeContext synchronization with PartyKit
- [X] T296 [MIGRATION] Test script update synchronization with PartyKit
- [X] T297 [MIGRATION] Test performance progress synchronization with PartyKit
- [X] T298 [MIGRATION] Test wrap party vote synchronization with PartyKit
- [X] T299 [MIGRATION] Test reconnection and state recovery with PartyKit: Test network interruption (disable/enable network), server restart scenarios, token expiration handling, and multiple rapid reconnections to ensure state recovery works correctly
- [X] T300 [MIGRATION] Perform initial manual deployment of PartyKit server using `npx partykit deploy` to PartyKit managed platform (partykit.dev) - no Cloudflare account required
- [X] T300a [MIGRATION] Verify manual deployment successful and note the PartyKit host URL (e.g., https://skitso.[username].partykit.dev) for Vercel configuration
- [X] T301 [MIGRATION] Update Vercel deployment configuration: Add NEXT_PUBLIC_PARTYKIT_HOST environment variable in Vercel dashboard with PartyKit host URL value
- [ ] T301a [MIGRATION] Verify Vercel can connect to PartyKit server after NEXT_PUBLIC_PARTYKIT_HOST is configured
- [ ] T302 [MIGRATION] Verify end-to-end multi-device synchronization with PartyKit
- [X] T303 [MIGRATION] Performance test: Verify <500ms latency maintained with PartyKit (per Constitution Principle 2 requirement)
- [X] T304 [MIGRATION] Clean up old Socket.io files (src/lib/socket/server.ts, src/lib/socket/client.ts, src/lib/socket/session-store.ts) after migration verified
- [X] T304a [MIGRATION] Document rollback procedure: Create rollback documentation in docs/PARTYKIT_ROLLBACK.md with steps to revert to Socket.io (restore server.ts, update components, redeploy) and keep Socket.io code in separate branch until migration verified
- [X] T305 [MIGRATION] Generate PartyKit access token using `npx partykit token generate` locally (opens browser for GitHub authentication, saves PARTYKIT_LOGIN and PARTYKIT_TOKEN values) - Note: Can be done at any time before CI/CD setup (T306-T307)
- [X] T306 [MIGRATION] Create GitHub Actions workflow file (.github/workflows/deploy-partykit.yml) with: trigger on push to main branch, checkout code, set up Node.js, run `npx partykit deploy` using secrets
- [X] T307 [MIGRATION] Configure GitHub repository secrets in GitHub Settings → Secrets and variables → Actions: Add PARTYKIT_LOGIN (GitHub username from token generation) and PARTYKIT_TOKEN (generated token value) - never commit these to source control
- [ ] T307a [MIGRATION] Test GitHub Actions workflow by pushing to main branch and verify automated PartyKit deployment works correctly
- [X] T308 [MIGRATION] Document PartyKit deployment workflow in README.md or quickstart.md: Include manual deployment steps, CI/CD automation setup instructions, environment variable configuration guide, and troubleshooting common issues
- [X] T308a [MIGRATION] [OPTIONAL] Set up PartyKit monitoring and observability: Configure logging and error tracking for PartyKit server (optional: integrate with existing monitoring solution like Sentry or DataDog) in parties/session.ts

## Phase 7: User Story 5 - Teleprompter Performance

**Goal:** Participants see synchronized teleprompter with shared script advancement control

**User Story:** As an Actor, I want to see a synchronized teleprompter with my lines highlighted, so that I can perform my part accurately. As a Director, I want to control script advancement, so that I can manage pacing and timing.

**Independent Test Criteria:**
- Teleprompter displays script with character assignments
- Current line highlighted using vibe-appropriate styling
- Script advancement synchronized across devices within 500ms
- Both Director and Actors can advance (Director has override)
- Scrolling behavior matches vibe (smooth for Indie, snappy for Viral)

**Dependencies:** Phase 6 complete

### Tasks

- [X] T111 [US5] Create The Stage page route in src/app/stage/[sessionCode]/page.tsx
- [X] T112 [US5] Create Teleprompter component (code-split with dynamic()) in src/components/teleprompter/teleprompter.tsx
- [X] T113 [US5] Implement script display with character assignments in src/components/teleprompter/teleprompter.tsx
- [X] T114 [US5] Implement current line highlighting using vibe primary color in src/components/teleprompter/teleprompter.tsx
- [X] T115 [US5] Implement upcoming lines display (2-3 lines ahead) in src/components/teleprompter/teleprompter.tsx
- [X] T116 [US5] Implement completed lines dimming in src/components/teleprompter/teleprompter.tsx
- [X] T117 [US5] Implement vibe-appropriate scrolling behavior (smooth/snappy) in src/components/teleprompter/teleprompter.tsx
- [X] T118 [US5] Distinguish stage directions from dialogue in src/components/teleprompter/teleprompter.tsx
- [X] T119 [US5] Distinguish sound cues from dialogue in src/components/teleprompter/teleprompter.tsx
- [X] T120 [US5] Add timing indicators (countdown, visual cues) in src/components/teleprompter/teleprompter.tsx
- [X] T121 [US5] Create script advancement control component in src/components/teleprompter/advance-control.tsx
- [X] T122 [US5] Implement shared control (Director and Actors can advance) in src/components/teleprompter/advance-control.tsx
- [X] T123 [US5] Implement Director override authority in src/components/teleprompter/advance-control.tsx
- [X] T124 [US5] Create performanceProgressAtom with atomWithStorage in src/state/atoms/performance-atom.ts
- [X] T125 [US5] Implement script advancement synchronization via Socket.io in src/lib/socket/server.ts
- [X] T126 [US5] Broadcast script advancement to all participants in room in src/lib/socket/server.ts
- [X] T127 [US5] Update performanceProgressAtom on advancement in src/components/teleprompter/teleprompter.tsx
- [X] T128 [US5] Style Teleprompter to match active VibeContext in src/components/teleprompter/teleprompter.tsx
- [X] T129 [US5] Add keyboard navigation for script advancement in src/components/teleprompter/teleprompter.tsx
- [X] T130 [US5] Test script advancement synchronization (<500ms requirement)
- [X] T131 [US5] Test Director override functionality

## Phase 8: User Story 6 - Wrap Party

**Goal:** Participants can vote, share, and celebrate after performance

**User Story:** As a Participant, I want to vote and share the performance after completion, so that I can validate and celebrate the experience.

**Independent Test Criteria:**
- Wrap Party screen appears after performance completion
- Participants can vote on quality, favorite moments, best actor, funniest moment
- Voting interface matches VibeContext (e.g., "Ate" medals for Viral)
- Results display in real-time
- Social sharing (Twitter, Instagram, TikTok) works
- Session data persists for 24 hours

**Dependencies:** Phase 7 complete

### Tasks

- [X] T132 [US6] Create Wrap Party page route in src/app/wrap-party/[sessionCode]/page.tsx
- [X] T133 [US6] Create WrapParty component in src/components/wrap-party/wrap-party.tsx
- [X] T134 [US6] Implement voting interface component in src/components/wrap-party/voting-interface.tsx
- [X] T135 [US6] Implement overall quality voting (1-5 stars) in src/components/wrap-party/voting-interface.tsx
- [X] T136 [US6] Implement favorite moment voting in src/components/wrap-party/voting-interface.tsx
- [X] T137 [US6] Implement best actor voting in src/components/wrap-party/voting-interface.tsx
- [X] T138 [US6] Implement funniest moment voting in src/components/wrap-party/voting-interface.tsx
- [X] T139 [US6] Style voting buttons/awards to match VibeContext in src/components/wrap-party/voting-interface.tsx
- [X] T140 [US6] Create wrapPartyDataAtom with atomWithStorage in src/state/atoms/wrap-party-atom.ts
- [X] T141 [US6] Implement real-time vote results display in src/components/wrap-party/voting-interface.tsx
- [X] T142 [US6] Synchronize votes across devices via Socket.io in src/lib/socket/server.ts
- [X] T143 [US6] Create social sharing component in src/components/wrap-party/social-share.tsx
- [X] T144 [US6] Implement Twitter sharing link in src/components/wrap-party/social-share.tsx
- [X] T145 [US6] Implement Instagram sharing link in src/components/wrap-party/social-share.tsx
- [X] T146 [US6] Implement TikTok sharing link in src/components/wrap-party/social-share.tsx
- [X] T147 [US6] Create shareable summary card generator in src/lib/utils/summary-card.ts
- [X] T148 [US6] Implement session data persistence (24 hours) in src/lib/utils/session-persistence.ts
- [ ] T149 [US6] Test voting and real-time results display
- [ ] T150 [US6] Test social sharing functionality

## Phase 9: User Story 7 - Premium Features (Post-MVP)

**Goal:** Premium users can enable video chat and record performances

**User Story:** As a Premium User, I want to enable video chat and record performances, so that I can see participants remotely and share recordings on social media.

**Independent Test Criteria:**
- Video chat connects all participants within 10 seconds
- Recording captures video, audio, script synchronization
- Recording file available within 1 minute of completion
- Sharing links work and are accessible

**Dependencies:** Phase 8 complete (can be developed in parallel)

### Tasks

- [ ] T151 [US7] Research video chat service options (WebRTC, third-party) and document decision
- [ ] T152 [US7] Implement video chat enable/disable toggle in src/components/premium/video-chat-toggle.tsx
- [ ] T153 [US7] Create video chat interface component in src/components/premium/video-chat.tsx
- [ ] T154 [US7] Implement video feed layout (grid, spotlight) in src/components/premium/video-chat.tsx
- [ ] T155 [US7] Implement mute/unmute audio controls in src/components/premium/video-chat.tsx
- [ ] T156 [US7] Implement mute/unmute video controls in src/components/premium/video-chat.tsx
- [ ] T157 [US7] Implement audio-only fallback for unsupported devices in src/components/premium/video-chat.tsx
- [ ] T158 [US7] Style video chat to match VibeContext in src/components/premium/video-chat.tsx
- [ ] T159 [US7] Research recording service options and document decision
- [ ] T160 [US7] Implement recording enable/disable toggle in src/components/premium/recording-toggle.tsx
- [ ] T161 [US7] Implement recording capture (video, audio, script sync) in src/lib/recording/capture.ts
- [ ] T162 [US7] Create recording generation API route in src/app/api/recordings/route.ts
- [ ] T163 [US7] Implement recording file generation (within 1 minute) in src/app/api/recordings/route.ts
- [ ] T164 [US7] Create recording playback interface in src/components/premium/recording-player.tsx
- [ ] T165 [US7] Implement recording editing (trim, enhance, effects) in src/components/premium/recording-editor.tsx
- [ ] T166 [US7] Implement recording sharing functionality in src/components/premium/recording-share.tsx
- [ ] T167 [US7] Implement storage limits (10 recordings, 1GB) in src/lib/recording/storage.ts
- [ ] T168 [US7] Test video chat connection time (<10 seconds requirement)
- [ ] T169 [US7] Test recording generation time (<1 minute requirement)

## Phase 10: Polish & Cross-Cutting Concerns

**Goal:** Accessibility, performance optimization, error handling, and final polish

**Independent Test Criteria:**
- WCAG 2.1 AA compliance verified
- Performance targets met (<3s load, <200KB initial JS)
- Scalability requirements verified (1,000 concurrent sessions, 100 AI requests, 10,000 active sessions)
- Security audit completed with no critical vulnerabilities
- Rate limiting and input validation tested
- Browser compatibility verified (last 2 versions of major browsers)
- Error handling covers all edge cases
- All edge cases from spec handled

**Dependencies:** Phases 1-8 complete (MVP user story phases)  
**Note:** Phase 10 polishes MVP features and does not require Phase 9 (Premium Features). Phase 9 can be developed in parallel or after Phase 10.

### Tasks

- [ ] T170 Add keyboard navigation to all interactive elements across all components
- [ ] T171 Add screen reader support (ARIA labels) to all components
- [ ] T172 Verify color contrast meets WCAG 2.1 AA (4.5:1 normal, 3:1 large) for all vibes
- [ ] T173 Ensure all touch targets are minimum 44x44px
- [ ] T174 Add focus indicators to all interactive elements
- [ ] T175 Add alternative text to all images (including generated character images)
- [ ] T176 Implement reduced motion preferences support in src/components/vibes/theme-provider.tsx
- [ ] T177 Optimize bundle size (code splitting for Teleprompter, AI generation UI) in next.config.js
- [ ] T178 Implement lazy loading for below-fold content
- [ ] T179 Add performance monitoring (Core Web Vitals) in src/lib/monitoring/performance.ts
- [ ] T180 Implement metrics collection for script generation time, sync latency, theme switch time in src/lib/monitoring/metrics.ts
- [ ] T181 Implement session count monitoring for scalability tracking in src/lib/monitoring/session-metrics.ts
- [ ] T181a [P] Create load testing suite for 1,000 concurrent sessions in tests/load/scalability.test.ts
- [ ] T181b [P] Implement load testing for AI generation queue (100 concurrent requests) in tests/load/ai-queue.test.ts
- [ ] T181c [P] Create session storage scaling test (10,000 active sessions) in tests/load/session-storage.test.ts
- [ ] T181d [P] Implement performance monitoring under load (verify NFR-1 targets maintained) in tests/load/performance-under-load.test.ts
- [ ] T181e [P] Create AI queue management system for handling 100 concurrent requests in src/lib/openai/queue-manager.ts
- [ ] T181f [P] Implement queue prioritization and throttling for AI generation requests in src/lib/openai/queue-manager.ts
- [ ] T181g [P] Add session storage optimization for 10,000+ active sessions in src/lib/utils/session-storage.ts
- [ ] T182 Implement comprehensive error boundaries in src/components/error-boundary.tsx
- [ ] T183 Add error handling for network interruptions in all API calls
- [ ] T184 Add error handling for browser storage limits in src/state/atoms/*.ts
- [ ] T185 Implement session expiration handling (24 hours) in src/lib/utils/session-persistence.ts
- [ ] T186 Implement session cleanup cron job or background task for expired sessions in src/lib/utils/session-cleanup.ts
- [ ] T187 Handle edge case: User closes browser before participants join (session persistence)
- [ ] T188 Handle edge case: User selects different vibe after starting configuration (reset/warn)
- [ ] T189 Handle edge case: Actor joins mid-performance (wait for next scene)
- [ ] T190 Handle edge case: Actor loses connection during performance (reconnection)
- [ ] T191 Handle edge case: One participant has poor connection (graceful degradation)
- [ ] T192 Handle edge case: Director ends performance early (smooth transition to Wrap Party)
- [ ] T193 Handle edge case: Performance exceeds expected duration (graceful handling)
- [ ] T194 Add loading states and skeleton screens for all async operations
- [ ] T195 Implement session cleanup on Wrap Party completion in src/lib/utils/session-cleanup.ts
- [ ] T196 Test complete user flow end-to-end (Vibe Selection → Wrap Party)
- [ ] T197 Performance audit: Verify <3s load time, <200KB initial JS, 60fps teleprompter scrolling
- [ ] T198 [P] Conduct security audit (OWASP Top 10, dependency vulnerabilities, API security) in docs/security/audit-report.md
- [ ] T199 [P] Implement security testing suite (input validation, injection attacks, XSS prevention) in tests/security/security.test.ts
- [ ] T200 [P] Verify session code entropy meets 128-bit minimum requirement in tests/security/session-code-security.test.ts
- [ ] T201 [P] Test API key and sensitive data exposure prevention (verify no client-side exposure) in tests/security/data-exposure.test.ts
- [ ] T202 [P] Implement security headers (CSP, X-Frame-Options, HSTS) in next.config.js or middleware
- [ ] T203 [P] Create input sanitization utilities to prevent injection attacks in src/lib/security/input-sanitizer.ts
- [ ] T204 [P] Verify rate limiting prevents abuse (10 requests/user/hour) in tests/security/rate-limiting.test.ts
- [ ] T205 [P] Test browser compatibility (Chrome, Firefox, Safari, Edge - last 2 versions) in tests/compatibility/browser-compat.test.ts
- [ ] T206 [P] Test mobile browser compatibility (iOS Safari, Chrome Mobile) in tests/compatibility/mobile-compat.test.ts
- [ ] T207 [P] Verify progressive enhancement (core functionality without JavaScript) in tests/compatibility/progressive-enhancement.test.ts

## Parallel Execution Examples

### User Story 1 (Vibe Selection)
- T023, T024, T013-T017 can be worked on in parallel (different files, no dependencies)

### User Story 2 (Director Configuration)
- T034-T037 can be worked on in parallel (different form fields)
- T046-T048 can be worked on in parallel (different API routes)
- T013-T017 (CSS variables) can be worked on in parallel with form implementation

### User Story 3 (Actor Joins)
- T078 (character display) can be worked on in parallel with join logic
- T070-T071 (API routes) can be worked on in parallel with UI components

### User Story 4 (Synchronization)
- T094-T096 (different Socket.io events) can be worked on in parallel
- T102-T104 (connection status UI) can be worked on in parallel
- T105-T108 (CastingCouch features) can be worked on in parallel

### User Story 5 (Teleprompter)
- T107-T113 (different teleprompter features) can be worked on in parallel
- T115-T117 (advancement control) can be worked on in parallel with display

### Polish Phase (Cross-Cutting Concerns)
- T181a-T181d (scalability load testing) can be worked on in parallel
- T181e-T181g (scalability infrastructure) can be worked on in parallel
- T198-T204 (security testing and audit) can be worked on in parallel
- T205-T207 (browser compatibility testing) can be worked on in parallel

## Task Summary

**Total Tasks:** 286

**Tasks by Phase:**
- Phase 1 (Setup): 9 tasks
- Phase 2 (Foundational): 18 tasks (added: text registry, SVG logo definitions, logo animations, layout patterns in CSS variables)
- Phase 3 (US1 - Vibe Selection): 10 tasks (updated: test includes text registry and logo changes)
- Phase 4 (US2 - Director Configuration): 46 tasks (added: T033a-d for theme-specific layout patterns, section titles from text registry, button labels, placeholder text, visual effects)
- Phase 5 (US3 - Actor Joins): 16 tasks
- Phase 6 (US4 - Synchronization): 32 tasks (added: Character Dossier component with 8 new tasks for detailed character view, hidden motivation display, theme-specific styling, navigation)
- Phase 6a (PartyKit Migration): 49 tasks (migration from Socket.io to PartyKit for Vercel compatibility, includes detailed CI/CD automation, token generation, and documentation updates)
- Phase 7 (US5 - Teleprompter): 20 tasks (removed duplicate T087b)
- Phase 8 (US6 - Wrap Party): 19 tasks
- Phase 9 (US7 - Premium): 19 tasks
- Phase 10 (Polish): 42 tasks (added: scalability testing, security audit, browser compatibility testing)

**Parallel Opportunities:** 60+ tasks marked [P]

**MVP Scope:** Phases 1-7 (120 tasks) - Core collaborative performance flow (Phase 6a migration recommended after Phase 6 or Phase 7)

**Post-MVP:** Phases 8-10 (77 tasks) - Wrap Party, Premium features, Polish  
**Note:** Phase 10 (Polish) can be completed independently of Phase 9 (Premium Features) as it polishes MVP features only.
