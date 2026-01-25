# Implementation Plan: Skitso Platform

## Constitution Check

Before planning, verify alignment with Skitso Project Constitution principles:

- [x] VibeContext considered as single source of truth
- [x] Real-time synchronization requirements addressed
- [x] AI generation consistency with VibeContext enforced
- [x] Progressive enhancement (browser storage) maintained
- [x] Dynamic theming system compatibility verified
- [x] Type safety and Server Components prioritized
- [x] Accessibility requirements included
- [x] Performance targets defined

**Constitution Compliance Notes:**
- All state management uses Jotai `atomWithStorage` for browser persistence (Principle 4)
- VibeContext atom is the single source of truth for all theming and AI generation (Principle 1)
- Server-authoritative synchronization with optimistic updates ensures real-time consistency (Principle 2)
- All AI prompts include VibeContext constraints (Principle 3)
- CSS Variables system enables dynamic theme switching (Principle 5)
- TypeScript strict mode enforced throughout (Principle 6)
- WCAG 2.1 AA compliance maintained (Principle 7)
- Performance targets defined: <3s load, <200KB initial JS (Principle 8)

## Feature/Epic Overview

**Title:** Skitso - AI-Assisted Collaborative Performance Platform

**Description:** 
Skitso is a collaborative performance platform that enables groups to create, perform, and share theatrical skits. The platform uses a global VibeContext system that simultaneously controls AI generation parameters, visual design tokens, and user experience elements. Users select from five production styles (Viral Neon, Indie A24, Sitcom Studio, Brainrot Theater, Quiet Studio) that transform the entire application's aesthetic, linguistic tone, and interaction patterns in real-time.

The platform supports role-based collaboration where a Director configures skit parameters, and the system generates contextually-appropriate scripts, character archetypes, and visual assets. Participants join as Actors, receive role assignments with hidden motivations, and perform using a synchronized teleprompter interface.

**VibeContext Impact:**
- VibeContext is the central organizing principle for all features
- Visual theming: All UI components derive colors, fonts, animations from active VibeContext
- AI generation: All OpenAI prompts include VibeContext constraints for style consistency
- Linguistic adaptation: Navigation labels, buttons, messages adapt to vibe tone
- Synchronization: VibeContext is broadcast to all participants' devices
- State persistence: VibeContext identifier stored in session state

## User Stories

### As a Director
- I want to select a production style (VibeContext) that transforms the entire app's aesthetic
- So that I can create an immersive, cohesive performance experience
- I want to configure skit parameters (theme, tone, participants, chaos level)
- So that the AI generates contextually-appropriate scripts and characters
- I want to pre-define or override character assignments
- So that I can control casting decisions
- I want to share a session code/link with participants
- So that Actors can join my performance session
- I want to control script advancement during performance
- So that I can manage pacing and timing
- I want to see all participants and their connection status
- So that I know when everyone is ready to perform

### As an Actor
- I want to join a session using a code or link
- So that I can participate in a collaborative performance
- I want my device to automatically sync to the Director's VibeContext
- So that I see the same visual design as other participants
- I want to receive a character assignment immediately upon joining
- So that I can prepare for my role
- I want to see a synchronized teleprompter with my lines highlighted
- So that I can perform my part accurately
- I want to advance script lines when ready
- So that I can control my own pacing
- I want to vote and share the performance after completion
- So that I can validate and celebrate the experience

### As a Premium User
- I want to enable video chat during performances
- So that I can see and hear other participants remotely
- I want to record performances
- So that I can share them later on social media
- I want unlimited sessions per month
- So that I can use the platform frequently without restrictions

## Technical Approach

### Architecture Decisions

1. **State Management: Jotai with atomWithStorage**
   - All critical state (vibe, cast, script, chaosLevel) uses persistent atoms
   - Browser localStorage enables offline functionality
   - Future backend migration maintains atom interface compatibility

2. **Synchronization: Server-Authoritative with Optimistic Updates**
   - Server acts as single source of truth for session state
   - Local UI updates occur immediately for responsive UX
   - Server reconciles conflicts automatically
   - PartyKit for real-time updates (<500ms latency) - Vercel-compatible WebSocket solution
   - PartyKit server handles session rooms (parties) and event broadcasting
   - Session state uses PartyKit storage (24h expiration) for MVP; external database optional post-MVP if longer persistence, query capabilities, or analytics needed
   - Automatic reconnection and state recovery handled by PartyKit client

3. **Theming: CSS Variables with data-theme Attribute**
   - Root element receives `data-theme="VIBE_NAME"` attribute
   - CSS custom properties defined per vibe in `[data-theme='VIBE_NAME']` selectors
   - Tailwind v4 tokens reference CSS variables
   - Theme swaps are atomic (<100ms visual delay)

4. **AI Integration: OpenAI API with VibeContext Constraints**
   - All prompts include VibeContext as required parameter
   - System prompts enforce vibe-specific slang, tone, and style
   - Retry logic: Automatic retry with simplified prompts on failure
   - Response validation with Zod schemas

5. **Session Management: Browser Storage + Server Sync**
   - Session codes: 8-10 character alphanumeric with shareable links
   - Session state persists in localStorage until Wrap Party
   - Server maintains authoritative session state for multi-device sync
   - Sessions expire after 24 hours from creation or last activity (whichever is later)

6. **Component Architecture: Server Components Default**
   - Server Components for static content and data fetching
   - Client Components only for interactivity (hooks, event handlers)
   - Code splitting with `dynamic()` for heavy components (Teleprompter, AI generation UI)

### State Management

**Jotai Atoms:**
```typescript
// Core state atoms (all use atomWithStorage)
export const vibeAtom = atomWithStorage<VibeType>('vibe', 'VIRAL_NEON');
export const castAtom = atomWithStorage<CastMember[]>('cast', []);
export const currentScriptAtom = atomWithStorage<Script | null>('current_script', null);
export const chaosLevelAtom = atomWithStorage<number>('chaos_level', 5);
export const sessionCodeAtom = atomWithStorage<string | null>('session_code', null);
export const sessionStateAtom = atomWithStorage<SessionState>('session_state', 'idle');

// Derived atoms
export const currentVibeConfigAtom = atom((get) => VIBE_CONFIGS[get(vibeAtom)]);
export const activeParticipantsAtom = atom((get) => 
  get(castAtom).filter(p => p.connectionStatus === 'connected')
);
```

**State Persistence:**
- All atoms use `atomWithStorage` for browser localStorage persistence
- State survives browser refreshes until Wrap Party completion
- Server sync maintains authoritative state for multi-device scenarios
- Session cleanup on Wrap Party or 24-hour expiration

### AI Integration

**Prompt Templates:**
- Character Generation: `specs/001-skitso-platform/prompts/character-generation-prompt.md`
- Script Generation: `specs/001-skitso-platform/prompts/script-generation-prompt.md`
- Character Image Generation: `specs/001-skitso-platform/prompts/character-image-generation-prompt.md`
- Architecture Documentation: `specs/001-skitso-platform/prompts/README.md`

**OpenAI Endpoints:**
1. **Character Generation** (`/api/openai/characters`)
   - Input: VibeContext, participant count, optional Director-defined characters
   - Output: JSON array of character objects (name, archetype, traits, motivation, image prompt)
   - Model: gpt-5-mini
   - Prompt Template: `prompts/character-generation-prompt.md`
   - VibeContext usage: Character naming, archetype labels, personality traits, art style directives

2. **Script Generation** (`/api/openai/script`)
   - Input: VibeContext, cast JSON, theme, tone, chaos level, slang registry
   - Output: Structured JSON script (dialogue, stage directions, sound cues, timing)
   - Model: gpt-5-mini
   - Prompt Template: `prompts/script-generation-prompt.md`
   - VibeContext usage: Dialogue tone, slang density, pacing, stage direction energy

3. **Character Image Generation** (`/api/openai/character-image`)
   - Input: Character object, VibeContext, optional existing image prompt
   - Output: gpt-image-1.5 generated image URL
   - Model: gpt-image-1.5 (or GPT to generate optimized prompt)
   - Prompt Template: `prompts/character-image-generation-prompt.md`
   - VibeContext usage: Art style (film grain for Indie, neon glitch for Viral, etc.)

**Error Handling:**
- Automatic retry with simplified prompts on initial failure
- If retry fails, show vibe-appropriate error message with manual retry option
- Rate limiting: 10 generation requests per user per hour

### Theming

**Vibe Themes Affected:**
- All five vibes: VIRAL_NEON, INDIE_A24, SITCOM_STUDIO, BRAINROT_THEATER, QUIET_STUDIO

**CSS Variables Required:**
```css
/* Per-vibe variables in globals.css */
[data-theme='VIRAL_NEON'] {
  --color-bg: #0A0A0A;
  --color-primary: #8AFB17;
  --color-accent: #BF40BF;
  --font-header: 'Inter Black Italic', sans-serif;
  --font-body: 'Inter', sans-serif;
  --border-radius: 4px;
  --animation-style: 'snappy';
  /* Layout patterns: card styles, spacing, component arrangements */
}

[data-theme='INDIE_A24'] {
  --color-bg: #141414;
  --color-primary: #CC7722;
  --color-accent: #FFFFFF;
  --font-header: 'EB Garamond', serif;
  --font-body: 'Roboto Mono', monospace;
  --border-radius: 0px;
  --animation-style: 'slow-fade';
  /* Layout patterns: card styles, spacing, component arrangements */
}

/* Similar for SITCOM_STUDIO, BRAINROT_THEATER, QUIET_STUDIO */
```

**Text Registry System:**
- Centralized text registry per VibeContext containing all UI textual labels
- Includes: section titles, button text, form placeholders, error messages, success messages
- Switched atomically with theme changes (no partial text updates)
- Example: "The Vibe" (Viral Neon) vs "Genre Selection" (Quiet Studio) for same form section

**Logo System:**
- SVG logo per VibeContext with theme-specific typography styling
- Optional animations: glitch effects, pulsing, scanlines
- Animations activate on theme selection or user interaction
- Logo definitions stored in VibeContext config

**Theme Provider Component:**
- Subscribes to `vibeAtom`
- Applies `data-theme` attribute to root element
- Switches text registry atomically with theme change
- Updates logo display and animations
- Triggers smooth transition animations (500ms cross-dissolve)

## Implementation Steps

### Phase 0: Foundation & Research

1. **Research & Setup**
   - [x] Research WebSocket vs polling for real-time sync (server-authoritative model) - Initial Decision: Use Socket.io → Superseded by PartyKit migration (Phase 6a) for Vercel compatibility
   - [ ] Research OpenAI API best practices for style-constrained generation
   - [ ] Research CSS Variables + Tailwind v4 integration patterns
   - [ ] Research Jotai atomWithStorage patterns for session persistence
   - [ ] Research session code generation (cryptographically secure, 8-10 chars alphanumeric)
   - [ ] Generate `research.md` with findings and decisions

2. **Project Setup**
   - [ ] Initialize Next.js 16+ project with App Router
   - [ ] Configure TypeScript strict mode
   - [ ] Install dependencies: jotai, openai, tailwindcss, zod
   - [ ] Configure Tailwind CSS v4 with CSS Variables support
   - [ ] Set up directory structure per constitution

### Phase 1: Core VibeContext System

3. **VibeContext Infrastructure**
   - [ ] Define VibeType enum and VibeContext type
   - [ ] Create `vibeAtom` with atomWithStorage
   - [ ] Define CSS variables for all five vibes in `globals.css` (colors, fonts, border styles, animation styles, layout patterns)
   - [ ] Create centralized text registry per VibeContext (all UI labels, button text, placeholders, section titles, messages)
   - [ ] Define SVG logo per VibeContext with theme-specific typography styling
   - [ ] Implement logo animation system (glitch effects, pulsing, scanlines) with optional activation on theme selection/interaction
   - [ ] Create ThemeProvider component (applies data-theme attribute, switches text registry atomically)
   - [ ] Create `useVibe` hook for accessing current vibe config (includes text registry access)
   - [ ] Test theme switching (<100ms transformation, including text and logo changes, per constitution Principle 5)

4. **Vibe Selection UI**
   - [ ] Create VibeSelector component (Server Component)
   - [ ] Implement five vibe cards with previews
   - [ ] Add selection handler (updates vibeAtom)
   - [ ] Verify instant visual transformation
   - [ ] Add accessibility (keyboard nav, screen reader support)

### Phase 2: Director Configuration

5. **Director's Desk Form**
   - [ ] Create DirectorConfigForm component (Client Component)
   - [ ] Implement form fields: theme, tone, participants, chaos level
   - [ ] Apply theme-specific layout patterns (card styles, spacing, component arrangements from VibeContext)
   - [ ] Use theme-specific section titles from text registry (e.g., "The Vibe" vs "Genre Selection")
   - [ ] Use theme-specific button labels and placeholder text from text registry
   - [ ] Apply theme-specific visual effects (glows, borders, shadows) from VibeContext config
   - [ ] Add optional character pre-definition interface
   - [ ] Implement form validation (Zod schemas)
   - [ ] Style form to match active VibeContext (colors, fonts, layout patterns, visual effects)
   - [ ] Add loading states for AI generation

6. **AI Generation Integration**
   - [ ] Create OpenAI API route handlers
   - [ ] Implement character generation endpoint (use `prompts/character-generation-prompt.md`)
   - [ ] Implement script generation endpoint (use `prompts/script-generation-prompt.md`)
   - [ ] Implement character image generation endpoint (use `prompts/character-image-generation-prompt.md`)
   - [ ] Add VibeContext to all prompts (prompts already include VibeContext constraints)
   - [ ] Implement retry logic (simplified prompts on failure)
   - [ ] Add error handling with vibe-appropriate messages
   - [ ] Validate responses with Zod schemas

7. **Session Code Generation**
   - [ ] Implement cryptographically secure session code generation (8-10 chars alphanumeric)
   - [ ] Generate shareable link
   - [ ] Create `sessionCodeAtom` with atomWithStorage
   - [ ] Create session sharing UI component

### Phase 3: Casting Couch (Lobby)

8. **Multi-Device Synchronization**
   - [ ] Design server-authoritative sync architecture
   - [ ] Implement Socket.io for real-time synchronization (initial implementation, will be migrated to PartyKit in Phase 6a)
   - [ ] Create session state management on server
   - [ ] Implement optimistic updates (local UI updates immediately)
   - [ ] Add conflict resolution logic
   - [ ] Implement reconnection handling
   - [ ] Add connection status indicators
   - [ ] Note: Initial implementation uses Socket.io for development. Phase 6a migrates to PartyKit for Vercel deployment.

9. **Casting Couch UI**
   - [ ] Create CastingCouch component (Client Component)
   - [ ] Implement participant list with connection status
   - [ ] Display character assignments (immediate on join)
   - [ ] Show character visual representations
   - [ ] Add Director override interface for character assignments
   - [ ] Implement "Start Performance" button (Director only)
   - [ ] Style to match active VibeContext

### Phase 4: The Stage (Teleprompter)

11. **Teleprompter Component**
    - [ ] Create Teleprompter component (Client Component, code-split with dynamic())
    - [ ] Display script with character assignments
    - [ ] Implement line highlighting (current/active line)
    - [ ] Show upcoming lines (2-3 ahead)
    - [ ] Dim completed lines
    - [ ] Implement vibe-appropriate scrolling behavior
    - [ ] Distinguish stage directions and sound cues
    - [ ] Add timing indicators
    - [ ] Style to match active VibeContext

11. **Script Advancement Control**
    - [ ] Implement shared control (Director and Actors can advance)
    - [ ] Add Director override authority
    - [ ] Synchronize advancement across all devices
    - [ ] Add manual advance buttons
    - [ ] Track script progress state

### Phase 5: Wrap Party & Session Management

13. **Wrap Party UI**
    - [ ] Create WrapParty component (Client Component)
    - [ ] Implement voting interface (quality, favorite moments, best actor, funniest)
    - [ ] Display real-time vote results
    - [ ] Style voting buttons/awards to match VibeContext
    - [ ] Add social sharing (Twitter, Instagram, TikTok)
    - [ ] Generate shareable summary cards
    - [ ] Implement feedback/comments

13. **Session Persistence**
    - [ ] Ensure all atoms persist to localStorage
    - [ ] Implement session recovery on browser refresh
    - [ ] Set up PartyKit storage for server-side session state (24h expiration)
    - [ ] Add session expiration logic (24 hours)
    - [ ] Implement session cleanup on Wrap Party completion
    - [ ] Test multi-session support (different codes)
    - [ ] Note: PartyKit storage sufficient for MVP; external database optional post-MVP

### Phase 6a: PartyKit Migration

**Goal:** Migrate from Socket.io to PartyKit for Vercel-compatible deployment

**Prerequisites:** Phase 6 (Synchronization) complete

**Migration Steps:**

1. **PartyKit Setup**
   - Install PartyKit dependencies (@partykit/react, partykit)
   - Create PartyKit project and configure partykit.json
   - Set up environment variables:
     - `NEXT_PUBLIC_PARTYKIT_HOST`: PartyKit server URL (e.g., `https://skitso.[username].partykit.dev`)
     - `PARTYKIT_TOKEN`: Only needed for CI/CD automation, not local development
   - Generate PartyKit access token for CI/CD:
     - Run `npx partykit token generate` locally
     - This opens browser for GitHub authentication
     - Saves `PARTYKIT_LOGIN` and `PARTYKIT_TOKEN` values
     - Store these securely (never commit to source control)
   - Deploy PartyKit server to PartyKit managed platform (partykit.dev):
     - Manual deployment: `npx partykit deploy` (prompts for login)
     - Automated deployment: Configure GitHub Actions (see step 5)
   - Note: No Cloudflare account required for managed platform deployment
   - Free tier limits: 10 projects max, 24h storage, domain pattern: [project-name].[github-username].partykit.dev

2. **Server Migration**
   - Create parties/session.ts PartyKit server file
   - Port event handlers from src/lib/socket/server.ts to PartyKit
   - Implement participant tracking using PartyKit connections
   - Set up PartyKit storage for session state (24h expiration matches FR-9 requirement)
   - Implement 24-hour session expiration logic
   - Note: External database optional post-MVP if longer persistence or query capabilities needed

3. **Client Migration**
   - Create src/lib/partykit/client.ts wrapper
   - Replace Socket.io client calls in all components
   - Update connection status tracking
   - Test reconnection and state recovery

4. **Infrastructure Changes**
   - Remove custom server (server.ts) or keep for local dev only
   - Update package.json scripts
   - Update deployment documentation
   - Remove Socket.io dependencies

5. **Testing & Deployment**
   - Update all socket-related tests
   - End-to-end testing of migration
   - Deploy PartyKit server to managed platform (partykit.dev):
     - Initial manual deployment: `npx partykit deploy` to get host URL
     - Verify deployment successful and note the PartyKit host URL
   - Set up GitHub Actions CI/CD for automated PartyKit deployment:
     - Generate PartyKit token: `npx partykit token generate` (if not done in step 1)
     - Add GitHub repository secrets:
       - `PARTYKIT_LOGIN`: Your GitHub username (from token generation)
       - `PARTYKIT_TOKEN`: The generated token (from token generation)
     - Create `.github/workflows/deploy-partykit.yml` workflow file:
       - Trigger on push to main branch (or specified branch)
       - Checkout code
       - Set up Node.js
       - Run `npx partykit deploy` using secrets
       - Optional: Add deployment status checks
     - Test workflow by pushing to main branch
     - Verify automated deployment works correctly
     - Note: GitHub Actions free tier provides 2,000 minutes/month for private repos (unlimited for public). Typical PartyKit deployment uses ~1-2 minutes per run, well within free tier limits.
   - Update Vercel deployment configuration:
     - Add `NEXT_PUBLIC_PARTYKIT_HOST` environment variable in Vercel dashboard
     - Set value to your PartyKit host URL (e.g., `https://skitso.[username].partykit.dev`)
     - Verify Vercel can connect to PartyKit server
   - Document deployment workflow:
     - Manual deployment steps
     - CI/CD automation setup
     - Environment variable configuration
     - Troubleshooting common issues
   - Verify multi-device synchronization works

**Acceptance Criteria:**
- All Socket.io features work with PartyKit
- Multi-device synchronization maintains <500ms latency
- Session persistence works correctly (24h expiration using PartyKit storage)
- Reconnection handles gracefully
- PartyKit server deployed and accessible (manual deployment successful)
- GitHub Actions CI/CD workflow configured and tested (automated deployment works)
- PartyKit token generated and stored securely in GitHub secrets
- Vercel deployment configuration updated with PartyKit host URL
- Deployment to Vercel successful
- No increase in error rates

**Reference:** See `docs/PARTYKIT_MIGRATION_ANALYSIS.md` for detailed migration plan

### Phase 6: Premium Features (Post-MVP)

15. **Video Chat Integration**
    - [ ] Research video chat service options (WebRTC, third-party service)
    - [ ] Implement video chat enable/disable
    - [ ] Create video feed layout (grid, spotlight)
    - [ ] Add mute/unmute controls
    - [ ] Implement audio-only fallback
    - [ ] Style to match VibeContext

15. **Recording Capabilities**
    - [ ] Research recording service options
    - [ ] Implement recording enable/disable
    - [ ] Capture video, audio, script synchronization
    - [ ] Generate recording file post-performance
    - [ ] Create recording playback interface
    - [ ] Implement editing (trim, enhance, effects)
    - [ ] Add sharing functionality
    - [ ] Implement storage limits (10 recordings, 1GB)

## Acceptance Criteria

- [ ] User can select from five vibes and see instant visual transformation (<100ms per constitution Principle 5)
- [ ] Director can configure skit parameters and generate script/characters within 30 seconds
- [ ] Session codes (8-10 chars alphanumeric) and shareable links work for participants
- [ ] Actors join and immediately receive character assignments
- [ ] All devices synchronize VibeContext and session state within 500ms
- [ ] Teleprompter displays script with synchronized advancement across devices
- [ ] Shared control works: Director and Actors can advance, Director has override
- [ ] Wrap Party voting and sharing completes successfully
- [ ] Session state persists across browser refreshes
- [ ] Sessions expire after 24 hours or on Wrap Party completion
- [ ] AI generation failures retry automatically, then show error with manual retry
- [ ] All UI elements adapt to active VibeContext (colors, fonts, layout patterns, text labels via registry, logo, animations)
- [ ] Textual labels switch atomically with theme changes via centralized text registry
- [ ] SVG logo displays with theme-specific typography and optional animations
- [ ] Character Dossier accessible from Casting Couch with full character details including hidden motivation
- [ ] WCAG 2.1 AA compliance maintained (keyboard nav, screen readers, color contrast)
- [ ] Performance targets met: <3s load, <200KB initial JS, 60fps teleprompter scrolling

## Dependencies

### External Services
- **OpenAI API:** Required for script generation, character generation, image generation
  - API key configuration
  - Rate limiting implementation
  - Cost monitoring

### Internal Dependencies
- **VibeContext System:** Must be implemented before all other features
- **Session Management:** Required before Casting Couch and The Stage
- **Real-Time Synchronization:** Required before The Stage feature

### Data Dependencies
- **VibeContext Definitions:** Complete definitions for all five vibes (visual tokens including layout patterns, text registry with all UI labels, logo definitions with SVG and animation specs, linguistic tone, AI parameters)
- **Text Registry:** Complete set of UI textual labels, button text, placeholders, section titles, and messages for each VibeContext
- **Logo Definitions:** SVG logo specifications with theme-specific typography styling and animation parameters for each VibeContext
- **Slang Registry:** Current 2026 slang terms for Viral Neon vibe
- **Character Archetype Library:** Base archetype definitions for each vibe style

## Risks and Mitigations

- **Risk:** OpenAI API rate limits or failures could block script generation
  - **Mitigation:** Implement retry logic with simplified prompts, show user-friendly errors, consider caching successful generations

- **Risk:** Real-time synchronization latency could break performance flow
  - **Mitigation:** Use PartyKit WebSocket for low-latency updates (<500ms requirement), implement optimistic updates, add connection status indicators

- **Risk:** PartyKit migration introduces bugs or performance issues
  - **Mitigation:** Complete migration in development environment first, comprehensive testing before production, keep Socket.io code in separate branch for rollback

- **Risk:** PartyKit storage limitations (24h expiration) conflict with session persistence needs
  - **Mitigation:** PartyKit storage (24h) is sufficient for MVP per FR-9 requirement. External database (PostgreSQL/Redis) can be added post-MVP if longer persistence, query capabilities, or analytics are needed. MVP uses PartyKit storage exclusively.

- **Risk:** Browser storage limits could prevent session persistence
  - **Mitigation:** Monitor localStorage usage, implement cleanup for expired sessions, consider compression for large scripts

- **Risk:** VibeContext theme switching could cause performance issues
  - **Mitigation:** Use CSS Variables for atomic swaps, minimize re-renders, test on low-end devices

- **Risk:** Multi-device conflicts during script advancement
  - **Mitigation:** Server-authoritative model with conflict resolution, Director override authority, clear conflict resolution rules

## Performance Considerations

- **Initial Load:** <3 seconds on 3G connection
- **Vibe Transformation:** <100ms visual delay (per constitution Principle 5)
- **Script Generation:** <30 seconds for typical sessions (2-10 participants, 2-5 minute performance duration, 50-200 script lines)
- **Synchronization:** <500ms latency for state updates
- **Teleprompter Scrolling:** 60fps smooth animation
- **Bundle Size:** <200KB initial JavaScript
- **Code Splitting:** Heavy components (Teleprompter, AI generation UI) loaded on demand

## Accessibility Checklist

- [x] Keyboard navigation supported (all interactive elements)
- [x] Screen reader compatible (ARIA labels, semantic HTML)
- [x] Color contrast meets WCAG 2.1 AA (4.5:1 normal, 3:1 large text)
- [x] Touch targets minimum 44x44px
- [x] Focus indicators visible and clear
- [x] Alternative text for all images (including generated character images)
- [x] Reduced motion preferences respected
- [x] Native HTML elements used over custom equivalents where possible

---

## Phase 0: Research & Outline

### Research Tasks

1. **WebSocket vs Polling for Real-Time Sync** ✅ RESOLVED
   - Research server-authoritative synchronization patterns
   - Compare WebSocket vs polling for <500ms latency requirements
   - Evaluate conflict resolution strategies
   - **Initial Decision:** Use Socket.io (WebSocket with automatic polling fallback)
   - **Updated Decision:** Migrated to PartyKit (Phase 6a) for Vercel-compatible WebSocket support
   - **Reference:** https://context7.com/websites/socket_io/llms.txt?tokens=10000
   - **Migration Reference:** See Phase 6a and `docs/PARTYKIT_MIGRATION_ANALYSIS.md`

2. **OpenAI API Best Practices** ✅ RESOLVED
   - Research style-constrained prompt engineering
   - Evaluate retry strategies and error handling
   - Research cost optimization (caching, prompt optimization)
   - **Decision:** Three separate prompt templates created (character generation, script generation, image generation)
   - **Reference:** `specs/001-skitso-platform/prompts/README.md` for architecture and workflow
   - **Prompt Templates:** See `specs/001-skitso-platform/prompts/` directory

3. **CSS Variables + Tailwind v4 Integration**
   - Research Tailwind v4 CSS Variables support
   - Evaluate theme switching performance
   - Research atomic theme swap patterns
   - Decision needed: Implementation pattern for theme provider

4. **Session Code Generation**
   - Research cryptographically secure code generation (8-10 chars alphanumeric, 128-bit entropy)
   - Evaluate collision probability
   - Research shareable link generation patterns
   - Decision needed: Code generation algorithm

5. **Jotai atomWithStorage Patterns**
   - Research session persistence patterns
   - Evaluate localStorage size limits
   - Research state migration strategies
   - Decision needed: Storage structure, cleanup strategies

---

## Phase 1: Design & Contracts

### Data Model

See `data-model.md` for complete entity definitions.

### API Contracts

See `/contracts/` directory for OpenAPI specifications.

### Quick Start Guide

See `quickstart.md` for development setup instructions.
