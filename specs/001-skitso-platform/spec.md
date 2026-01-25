# Feature Specification: Skitso Platform

**Feature Name:** Skitso - AI-Assisted Collaborative Performance Platform

**Version:** 1.0.0

**Last Updated:** 2025-01-27

## Overview

Skitso is an AI-assisted collaborative performance platform that enables groups to create, perform, and share theatrical skits. The platform transforms group hangouts into immersive performance spaces by allowing a "Director" to select a specific aesthetic and linguistic "Production Style" (VibeContext) that controls the entire application experience.

The core innovation is the **VibeContext system** - a global state that simultaneously controls:
1. AI generation parameters (language style, slang, dialogue tone)
2. Visual design tokens (colors, fonts, animations, layout)
3. User experience elements (navigation labels, interaction patterns, sound effects)

Users can choose from five distinct production styles:
- **Viral Neon**: High-energy, meme-dense, neon aesthetic
- **Indie A24**: Cinematic, elegant, film-grain aesthetic
- **Sitcom Studio**: Nostalgic, high-energy, retro-modern TV aesthetic
- **Brainrot Theater**: Maximum chaos, dopamine-driven, intentionally over-designed
- **Quiet Studio**: Professional minimalist, anti-cringe, clean productivity tool

The platform supports role-based collaboration where a Director configures skit parameters (theme, tone, participant count, chaos level), and the system generates contextually-appropriate scripts, character archetypes, and visual assets. Participants join as Actors, receive role assignments with hidden motivations, and perform using a synchronized teleprompter interface.

The application operates as a linear session flow: Vibe Selection → Director's Desk (Configuration) → Casting Couch (Lobby) → The Stage (Performance) → Wrap Party (Validation/Sharing). All participants' devices synchronize to the Director's chosen VibeContext, ensuring visual and linguistic consistency across the collaborative experience.

## Clarifications

### Session 2025-01-27

- Q: What is the synchronization architecture model for maintaining state across devices? → A: Server-authoritative with optimistic updates (local UI updates immediately, server reconciles conflicts)
- Q: Who controls script advancement during performance, and how does manual control interact with automatic scrolling? → A: Shared control (Director and Actors can both advance, with Director override)
- Q: What format should session codes use, and how should they be shared with participants? → A: Alphanumeric code (8-10 characters) with shareable link (both options available)
- Q: When exactly are characters assigned to Actors - immediately upon joining the lobby, or when the Director starts the performance? → A: Immediately upon joining lobby, but Director can override or define character assignments before skit generation as part of initial configuration prompts
- Q: What happens when AI generation fails completely - what fallback content is provided, and what is the user experience? → A: Retry with simplified prompts, then show error with manual retry option
- Q: What is the Backstage component referenced in wireframes, and where does it fit in the user flow? → A: Backstage is an alternative wireframe name for Casting Couch (lobby component). The specification uses "Casting Couch" terminology consistently.
- Q: How should the system handle theme-specific textual labels technically? → A: Centralized text registry per VibeContext (all labels, buttons, placeholders, messages defined in vibe config, switched atomically with theme changes)
- Q: What are the requirements for the SKITSO logo (Stride logo) across themes? → A: SVG logo per VibeContext with theme-specific typography styling, optional animations (glitch effects, pulsing, scanlines) on theme selection or user interaction
- Q: What is the Character Dossier component, and how does it relate to existing character viewing functionality? → A: Character Dossier is a detailed character view screen accessible from Casting Couch, showing full character information (name, archetype, traits, visual representation, hidden motivation for assigned Actor)
- Q: What specific visual and textual differences should Director's Desk exhibit across themes beyond basic color/font changes? → A: Each theme has distinct layout patterns (card styles, spacing, component arrangements), section title wording, button label terminology, placeholder text phrasing, and visual effects (glows, borders, shadows) - all defined in VibeContext config

### Session 2026-01-24

- Q: For the new prompt-injection hardening tasks (T218–T220), should their scope apply only to script generation or to all three OpenAI flows (character, script, image)? → A: Apply to all three OpenAI flows (character, script, image)

### Session 2025-01-21

- Q: What session storage strategy should be used for MVP - PartyKit storage or external database? → A: Use PartyKit storage for MVP (24h expiration sufficient per FR-9 requirement). External database can be added post-MVP if longer persistence, query capabilities, or analytics are needed.

## User Scenarios & Testing

### Scenario 1: Director Creates a Skit Session

**Actor:** Director (primary user)

**Preconditions:**
- User has access to the application
- User has internet connection

**Flow:**
1. User opens the application and lands on the Vibe Selection screen
2. User browses the five available production styles
3. User selects a production style (e.g., "Indie A24")
4. Application immediately transforms visual design, typography, and interaction patterns to match selected style
5. User proceeds to Director's Desk configuration screen
6. User inputs skit parameters:
   - Theme/topic for the skit
   - Tone preference
   - Number of participants (2-10)
   - Chaos level (1-10 scale)
7. User submits configuration
8. System generates script, character archetypes, and visual assets matching the selected VibeContext
9. User receives a session code (8-10 character alphanumeric) and shareable link to share with participants
10. User waits in Casting Couch lobby for participants to join

**Success Criteria:**
- User can complete vibe selection and configuration in under 2 minutes
- Visual transformation occurs instantly (within 100ms) when vibe is selected
- Generated content matches the selected vibe's linguistic and aesthetic style
- Session code (8-10 character alphanumeric) and shareable link are both available and work for participants

**Edge Cases:**
- User closes browser before participants join (session should persist)
- User selects different vibe after starting configuration (should reset or warn)
- Network interruption during generation (should show error and allow retry)

### Scenario 2: Actor Joins and Performs

**Actor:** Participant (Actor role)

**Preconditions:**
- Director has created a session and shared session code/link
- Actor has received session code/link

**Flow:**
1. Actor opens session link or enters session code
2. Actor's device automatically syncs to Director's selected VibeContext (visual design matches)
3. Actor sees Casting Couch lobby with other participants
4. System immediately assigns Actor a character archetype with hidden motivation (unless Director pre-defined assignments during configuration)
5. Actor receives character description and visual representation
6. Actor can access Character Dossier from Casting Couch to view detailed character information including hidden motivation
7. When Director starts performance, Actor transitions to The Stage (Teleprompter view)
8. Actor sees synchronized script with their dialogue lines highlighted
9. Actor performs their lines following the teleprompter
10. Script advances through shared control (Director and Actors can both advance, with Director override authority)
11. Performance completes and transitions to Wrap Party screen

**Success Criteria:**
- Actor can join session using code/link in under 30 seconds
- Actor's device visual design matches Director's vibe immediately upon joining
- Character assignment occurs automatically within 5 seconds of joining
- Teleprompter synchronization works across all devices with less than 500ms delay
- Actor can clearly see their assigned lines and timing cues

**Edge Cases:**
- Actor joins mid-performance (should wait for next scene or be assigned to current scene)
- Actor loses connection during performance (should show reconnection option)
- Multiple actors have same dialogue timing (should handle gracefully)

### Scenario 3: Complete Performance Session

**Actors:** Director + Multiple Actors (2-10 participants)

**Preconditions:**
- Director has configured session
- All participants have joined

**Flow:**
1. Director starts performance from Casting Couch
2. All participants transition to The Stage simultaneously
3. Teleprompter displays script with synchronized scrolling
4. Participants perform their assigned roles following dialogue and stage directions
5. System tracks performance progress and timing
6. Performance completes (all script lines delivered or Director ends early)
7. All participants transition to Wrap Party screen
8. Participants can vote on performance quality, favorite moments, or awards
9. Participants can share performance recording (if premium feature enabled)
10. Session concludes with social sharing options

**Success Criteria:**
- All participants see synchronized script updates within 500ms of each other
- Performance can be completed without technical interruptions
- Wrap Party voting completes successfully
- Session data persists for 24 hours after completion for sharing

**Edge Cases:**
- One participant has poor connection (should degrade gracefully, show connection status)
- Director ends performance early (should transition smoothly to Wrap Party)
- Performance exceeds expected duration (should handle gracefully)

### Scenario 4: Premium Features - Video Chat and Recording

**Actor:** Premium user (Director or Actor)

**Preconditions:**
- User has premium subscription
- Session is active

**Flow:**
1. Premium user enables video chat feature during Casting Couch or The Stage
2. Video chat interface appears with participant video feeds
3. Users can see and hear each other during performance
4. User enables recording feature before or during performance
5. System records performance (video, audio, script synchronization)
6. After Wrap Party, user can access recorded performance
7. User can edit, trim, or enhance recording
8. User can share recording via social media or direct link

**Success Criteria:**
- Video chat connects all participants within 10 seconds
- Recording captures synchronized script and participant performances
- Recording file is available within 1 minute of performance completion
- Sharing links work and are accessible to recipients

**Edge Cases:**
- User's device doesn't support video (should fall back to audio-only)
- Recording fails due to storage limits (should notify user and allow retry)
- Shared link expires or is inaccessible (should handle gracefully)

## Functional Requirements

### FR-1: VibeContext Selection and Application

**Description:** Users must be able to select from five distinct production styles, and the entire application must transform its visual design, linguistic tone, and interaction patterns to match the selected style.

**Acceptance Criteria:**
- Five production styles are available: Viral Neon, Indie A24, Sitcom Studio, Brainrot Theater, Quiet Studio
- Visual transformation (colors, fonts, layouts, animations) occurs within 100ms of selection
- All application screens reflect the selected vibe consistently
- Textual labels (section titles, button text, form placeholders, messages) switch atomically with theme changes via centralized text registry per VibeContext
- Linguistic elements (labels, buttons, messages) adapt to match vibe's tone
- Transformation is smooth and visually coherent (no jarring transitions)
- Selected vibe persists across browser sessions until explicitly changed

**VibeContext Dependencies:**
- Visual design tokens (background colors, accent colors, typography, border styles, animation styles)
- Text registry (centralized collection of all UI textual labels, button text, form placeholders, section titles, error messages, success messages - switched atomically with theme changes)
- Logo definition (SVG logo per VibeContext with theme-specific typography styling, optional animations such as glitch effects, pulsing, scanlines on theme selection or user interaction)
- Interaction patterns (animation speeds, hover effects, click feedback, sound effects)

### FR-2: Director Configuration (Director's Desk)

**Description:** Directors must be able to configure skit parameters that influence AI generation of scripts, characters, and visual assets.

**Acceptance Criteria:**
- Director can input:
  - Theme/topic (free text, 10-200 characters)
  - Tone preference (dropdown or tags: comedic, dramatic, satirical, absurdist, suspenseful, romantic, action-packed, slice-of-life, or custom free text)
  - Number of participants (numeric input, 2-10 range)
  - Chaos level (slider or numeric input, 1-10 scale)
  - Optional: Character assignments or character preferences (Director can pre-define or override character assignments before skit generation)
- Configuration form adapts its visual style and labels to match selected VibeContext
- Each theme exhibits distinct layout patterns (card styles, spacing, component arrangements) defined in VibeContext visual design tokens
- Section titles, button labels, and placeholder text use theme-specific wording from VibeContext text registry (e.g., "The Vibe" vs "Genre Selection", "The Squad" vs "Participants")
- Visual effects (glows, borders, shadows, animations) match theme aesthetic and are defined in VibeContext config
- Form validates inputs before submission (theme length, participant count range, etc.)
- Submission triggers AI generation process
- Director receives feedback during generation (loading state, progress indicator)
- If AI generation fails, system automatically retries with simplified prompts
- If retry also fails, system shows error message with manual retry option (vibe-appropriate error messaging)
- Generated content (script, characters, assets) matches selected VibeContext style
- If Director pre-defined character assignments, those are used; otherwise system generates characters automatically
- Configuration can be saved and edited before starting performance

**VibeContext Dependencies:**
- Layout patterns (card styles, spacing, component arrangements) defined in visual design tokens
- Form labels, section titles, button labels, and placeholders use vibe-specific wording from text registry
- Button styles and visual effects match vibe aesthetic (e.g., pulsing for Brainrot, minimal for Quiet Studio, glows for Viral Neon)
- Error messages use vibe-appropriate tone from text registry
- Generation parameters passed to AI match vibe constraints

### FR-3: Character Generation and Assignment

**Description:** System must generate character archetypes with hidden motivations that match the selected VibeContext and assign them to participants. Characters are assigned immediately when Actors join the lobby, unless Director has pre-defined character assignments during configuration.

**Acceptance Criteria:**
- System generates appropriate number of characters based on participant count
- Each character includes:
  - Name (vibe-appropriate)
  - Archetype label (e.g., "The Main Character" for Viral, "The Protagonist" for Indie)
  - Personality traits
  - Hidden motivation (not visible to other participants)
  - Visual representation (generated image matching vibe aesthetic)
- Characters are assigned to Actors immediately upon joining the lobby
- Director can pre-define or override character assignments during configuration phase (before skit generation)
- If Director pre-defined assignments, those take precedence; otherwise system auto-assigns upon Actor join
- Character assignments are unique (no duplicates)
- Characters are distributed fairly (balanced roles, speaking time)
- Character descriptions are appropriate for selected vibe's tone and complexity
- Visual representations match vibe's art style (e.g., film grain for Indie, neon glitch for Viral)

**VibeContext Dependencies:**
- Character naming conventions match vibe (e.g., modern slang names for Viral, classic names for Indie)
- Archetype labels match vibe terminology
- Personality traits reflect vibe's tone (chaotic for Brainrot, refined for Indie)
- Visual art style matches vibe aesthetic

### FR-4: Script Generation

**Description:** System must generate contextually-appropriate scripts with dialogue, stage directions, and sound cues that match the selected VibeContext.

**Acceptance Criteria:**
- Generated script includes:
  - Dialogue lines assigned to specific characters
  - Stage directions (actions, movements, expressions)
  - Sound effect cues (where applicable)
  - Timing markers (pacing, pauses)
- Script length is appropriate for participant count (2-5 minutes performance time)
- Dialogue uses language style matching selected vibe (slang for Viral, cinematic for Indie, etc.)
- Script incorporates user-provided theme/topic
- Chaos level influences script randomness and interaction intensity
- Script is structured with clear scenes or segments
- All participants have balanced speaking opportunities

**VibeContext Dependencies:**
- Dialogue tone and language style match vibe (2026 slang for Viral, award-winning dialogue for Indie)
- Stage directions match vibe's energy level (high-energy for Brainrot, subtle for Indie)
- Sound cues match vibe aesthetic (electronic for Viral, ambient for Indie)
- Script pacing matches vibe (snappy for Viral, contemplative for Indie)

### FR-5: Multi-Device Synchronization

**Description:** All participants' devices must synchronize to the Director's VibeContext and maintain real-time state alignment during the session. Synchronization uses a server-authoritative model with optimistic updates: local UI updates occur immediately for responsive user experience, while the server acts as the single source of truth and reconciles any conflicts. Implemented using PartyKit for Vercel-compatible WebSocket support.

**Acceptance Criteria:**
- When Actor joins using session code, their device immediately syncs to Director's VibeContext
- Visual design on all devices matches Director's selected vibe
- Script updates appear on all devices within 500ms of each other
- Teleprompter scrolling is synchronized across devices
- State changes (performance start, scene transitions, script progress) propagate to all devices
- Local UI updates occur immediately (optimistic updates) while server confirms state changes
- Server reconciles any conflicting state changes automatically
- Connection status is visible to all participants
- Reconnection after network interruption restores synchronized state from server

**VibeContext Dependencies:**
- Synchronized state includes VibeContext identifier
- Visual sync ensures all devices show same colors, fonts, layouts
- Linguistic sync ensures all devices show same labels and messages

### FR-6: Teleprompter Interface (The Stage)

**Description:** Participants must have a synchronized teleprompter interface that displays the script with clear line highlighting and timing cues. Script advancement uses shared control: both Director and Actors can advance the script, but Director has override authority to control pacing.

**Acceptance Criteria:**
- Teleprompter displays full script with character assignments visible
- Current/active line is highlighted using vibe-appropriate styling
- Upcoming lines are visible (2-3 lines ahead)
- Completed lines are dimmed or marked
- Scrolling behavior matches vibe (smooth for Indie, snappy for Viral)
- Stage directions and sound cues are clearly distinguished from dialogue
- Timing indicators show when to speak (countdown, visual cues)
- Teleprompter is readable in various lighting conditions
- Both Director and Actors can manually advance script lines
- Director has override authority to control or pause script advancement
- All advancement actions are synchronized across all devices

**VibeContext Dependencies:**
- Highlight colors use vibe's primary accent color
- Scrolling speed and animation style match vibe (slow fade for Indie, quick snap for Viral)
- Typography matches vibe (serif for Indie, bold sans-serif for Viral)
- Visual cues match vibe aesthetic (glow effects for Viral, subtle underline for Indie)

### FR-7: Casting Couch (Lobby)

**Description:** Participants must be able to join a session, see other participants, receive character assignments, and wait for performance to begin. Character assignments occur immediately when Actors join, unless Director has pre-defined assignments during configuration.

**Acceptance Criteria:**
- Director sees list of joined participants with connection status
- Actors see other participants and their assigned characters (names and archetypes only, not hidden motivations)
- Character assignments appear automatically and immediately when Actor joins the lobby
- If Director pre-defined character assignments during configuration, those are used; otherwise system auto-assigns upon join
- Director can override character assignments in the lobby before starting performance
- Visual representations of characters are displayed
- Lobby interface matches selected VibeContext
- Director can start performance when minimum participant count is met
- Participants see countdown or notification when Director starts performance
- Participants can leave lobby before performance starts (session remains for others)

**VibeContext Dependencies:**
- Lobby layout and styling match vibe (cards for Indie, tiles for Sitcom, floating elements for Brainrot)
- Character display style matches vibe aesthetic
- Start button styling matches vibe (e.g., pulsing for Brainrot, minimal for Quiet Studio)

### FR-7a: Character Dossier (Detailed Character View)

**Description:** Actors must be able to access a detailed character view screen from Casting Couch that displays complete character information, including hidden motivations visible only to the assigned Actor.

**Acceptance Criteria:**
- Character Dossier is accessible from Casting Couch (via character card click or dedicated button)
- Navigation flow: Clicking a character card in Casting Couch opens Character Dossier as a modal overlay (not a new page). Modal includes close button and backdrop click to return to Casting Couch. Navigation preserves Casting Couch state.
- Character Dossier displays full character information:
  - Character name (vibe-appropriate)
  - Archetype label
  - Personality traits (list)
  - Visual representation (generated image matching vibe aesthetic)
  - Hidden motivation (visible only to assigned Actor, not other participants)
- Character Dossier interface matches selected VibeContext (layout, styling, text labels)
- Actors can navigate back to Casting Couch from Character Dossier
- Character Dossier is available throughout Casting Couch phase (before performance starts)

**VibeContext Dependencies:**
- Character Dossier layout and styling match vibe aesthetic
- Text labels (section titles, field labels) use vibe-specific terminology from text registry
- Character information presentation style matches vibe (e.g., dramatic for Indie, energetic for Viral)

### FR-8: Wrap Party (Validation and Sharing)

**Description:** After performance, participants must be able to validate the experience, vote on aspects, and share the session.

**Acceptance Criteria:**
- Wrap Party screen appears automatically after performance completion
- Participants can vote on:
  - Overall performance quality
  - Favorite moments or lines
  - Best actor/character
  - Funniest moment
- Voting interface matches selected VibeContext (e.g., "Ate" medals for Viral, "Best Actor" trophies for Indie)
- Results are displayed in real-time as votes come in
- Participants can share session via:
  - Social media links (Twitter, Instagram, TikTok)
  - Direct link generation
  - Screenshot or summary card generation
- Session data persists for 24 hours for sharing purposes
- Participants can leave feedback or comments

**VibeContext Dependencies:**
- Voting buttons and awards match vibe aesthetic and terminology
- Sharing cards use vibe-appropriate visual design
- Success messages use vibe-appropriate language

### FR-9: Session Management and Persistence

**Description:** Sessions must persist across browser refreshes, handle disconnections gracefully, and maintain state until completion.

**Acceptance Criteria:**
- Session state persists in browser storage (localStorage) and PartyKit server storage
- Users can refresh browser without losing session progress
- Session data includes: VibeContext, configuration, cast, script, performance progress
- Sessions expire after 24 hours from creation or last activity (whichever is later)
- PartyKit storage provides server-side session persistence (24h expiration matches requirement)
- Disconnected users can rejoin using same session code (8-10 character alphanumeric) or shareable link
- Director can end session early (transitions to Wrap Party)
- Session cleanup occurs after Wrap Party completion or expiration
- Multiple sessions can exist simultaneously (different session codes)
- Session codes can be shared via both manual entry and shareable link

**VibeContext Dependencies:**
- Persisted state includes VibeContext identifier
- Session recovery restores vibe-appropriate visual state

### FR-10: Premium Features - Video Chat Integration

**Description:** Premium users must be able to enable video chat for remote performances.

**Acceptance Criteria:**
- Video chat can be enabled during Casting Couch or The Stage
- All participants with video capability see each other's video feeds
- Video layout adapts to number of participants (grid, spotlight, etc.)
- Audio is synchronized with video
- Participants can mute/unmute audio and video
- Video quality adapts to connection speed
- Fallback to audio-only if video is unavailable
- Video chat interface matches selected VibeContext styling

**VibeContext Dependencies:**
- Video chat UI elements (buttons, layout) match vibe aesthetic
- Visual effects (borders, overlays) match vibe style

### FR-11: Premium Features - Recording Capabilities

**Description:** Premium users must be able to record performances for later viewing and sharing.

**Acceptance Criteria:**
- Recording can be enabled before or during performance
- Recording captures:
  - Video feeds (if video chat enabled)
  - Audio from all participants
  - Synchronized script display
  - Performance timing and progress
- Recording file is generated within 1 minute of performance completion
- Users can access recordings from Wrap Party or session history
- Recordings can be:
  - Viewed in-app
  - Downloaded
  - Shared via link
  - Edited (trim, enhance, add effects)
- Recording storage is limited per user (e.g., 10 recordings, 1GB total)
- Recordings expire after 30 days (premium) or 7 days (free trial)

**VibeContext Dependencies:**
- Recording interface matches vibe aesthetic
- Editing tools use vibe-appropriate effects and filters

## Non-Functional Requirements

### NFR-1: Performance

**Requirements:**
- VibeContext visual transformation completes within 100ms
- Script generation completes within 30 seconds for typical sessions (2-10 participants, 2-5 minute performance duration, 50-200 script lines)
- Character image generation completes within 10 seconds per character
- Multi-device synchronization maintains less than 500ms latency
- Application loads initial screen within 2 seconds on standard mobile connection
- Teleprompter scrolling is smooth (60fps) on modern devices
- Video chat connects all participants within 10 seconds

**Success Criteria:**
- 95% of vibe transformations complete within 100ms
- 90% of script generations complete within 30 seconds
- 99% of synchronization updates propagate within 500ms
- Application receives performance score of 90+ on Core Web Vitals

### NFR-2: Accessibility

**Requirements:**
- Application meets WCAG 2.1 AA compliance standards
- All interactive elements are keyboard navigable
- Screen reader support for all content and interactions
- Color contrast ratios meet 4.5:1 for normal text, 3:1 for large text across all vibes
- Touch targets are minimum 44x44 pixels
- Focus indicators are visible and clear
- Alternative text provided for all images (including generated character images)
- Reduced motion preferences are respected (disable animations when requested)

**Success Criteria:**
- Automated accessibility testing passes WCAG 2.1 AA checks
- Manual testing with screen readers (NVDA, VoiceOver) confirms all functionality is accessible
- Color contrast validation passes for all vibe combinations
- Keyboard navigation allows complete user flow without mouse/touch

### NFR-3: Reliability and Error Handling

**Requirements:**
- Application handles network interruptions gracefully
- Failed API calls (AI generation, image generation) show user-friendly error messages
- Sessions recover from browser crashes or tab closures
- Invalid inputs are validated with clear error messages
- Rate limiting prevents abuse of AI generation features
- AI generation failure handling: System automatically retries with simplified prompts if initial generation fails
- If retry with simplified prompts also fails, system shows error message with manual retry option
- Error messages are vibe-appropriate and provide clear guidance for user action

**Success Criteria:**
- 99% of sessions complete without critical errors
- Error messages are user-friendly and vibe-appropriate
- Session recovery succeeds in 95% of reconnection attempts
- Invalid input rejection rate is 100% (no invalid data accepted)
- AI generation failures are automatically retried at least once with simplified prompts before showing error

### NFR-4: Scalability

**Requirements:**
- Application supports 1,000 concurrent sessions
- Each session supports 2-10 participants
- AI generation queue handles 100 concurrent requests
- Session data storage scales to 10,000 active sessions
- Video chat supports up to 10 participants per session

**Success Criteria:**
- System maintains performance (NFR-1 targets) under 1,000 concurrent sessions
- AI generation queue processes requests within 30 seconds under normal load
- No session data loss under expected load

### NFR-5: Security and Privacy

**Requirements:**
- Session codes are cryptographically secure and unguessable
- Session codes are alphanumeric, 8-10 characters in length
- Session codes can be shared via both manual code entry and shareable link
- User data is not stored permanently without consent
- Recordings are accessible only to session participants and those with share links
- API keys and sensitive data are not exposed to client
- Input validation prevents injection attacks
- Prompt-injection protections are applied consistently across all AI generation endpoints (character, script, and character image) in both prompt templates and regression tests
- Rate limiting prevents abuse

**Success Criteria:**
- Session codes have sufficient entropy (minimum 128 bits)
- Session codes are alphanumeric format, 8-10 characters
- No user data persists beyond 24 hours without explicit consent
- Security audit finds no critical vulnerabilities
- Rate limiting prevents more than 10 generation requests per user per hour

### NFR-6: Browser Compatibility

**Requirements:**
- Application works on modern browsers (Chrome, Firefox, Safari, Edge) last 2 versions
- Mobile browsers supported (iOS Safari, Chrome Mobile)
- Progressive enhancement: core functionality works without JavaScript (basic form submission)
- Graceful degradation for unsupported features (video chat, advanced animations)

**Success Criteria:**
- Application functions correctly on 95% of target browser/device combinations
- Core user flow (vibe selection, configuration, basic performance) works on all supported browsers
- Feature detection prevents errors on unsupported browsers

## Success Criteria

### Quantitative Metrics

1. **User Onboarding Success Rate**
   - 90% of users complete vibe selection and reach Director's Desk within first session
   - 80% of users complete full configuration and generate a script within 5 minutes

2. **Performance Completion Rate**
   - 75% of started sessions complete full performance (Director's Desk → Wrap Party)
   - Average session duration: 15-20 minutes (including setup and performance)

3. **Multi-Device Synchronization Accuracy**
   - 99% of script updates synchronize across all devices within 500ms
   - 95% of participants report visual consistency across devices

4. **AI Generation Quality**
   - 85% of users rate generated scripts as "good" or "excellent" (4+ stars)
   - 90% of generated content matches selected VibeContext style (validated by human review)

5. **System Performance**
   - 95% of vibe transformations complete within 100ms
   - 90% of script generations complete within 30 seconds
   - Application loads initial screen within 2 seconds on 4G connection

6. **Session Persistence**
   - 95% of sessions recover successfully after browser refresh
   - 90% of disconnected users successfully rejoin sessions

### Qualitative Metrics

1. **User Satisfaction**
   - Users report feeling "immersed" in selected vibe aesthetic
   - Users find generated content "contextually appropriate" for selected style
   - Users describe experience as "fun" and "engaging"

2. **VibeContext Effectiveness**
   - Users can distinguish between different vibe styles clearly
   - Users report visual and linguistic consistency throughout session
   - Users feel vibe selection meaningfully impacts their experience

3. **Collaboration Quality**
   - Users report successful multi-participant performances
   - Users find character assignments "fair" and "balanced"
   - Users enjoy synchronized teleprompter experience

4. **Premium Feature Value**
   - Premium users report video chat enhances remote performance experience
   - Premium users find recording feature "valuable" for sharing
   - Premium feature adoption rate: 20% of active users within 3 months

## Key Entities

### Session
- **Attributes:**
  - Unique session identifier (code)
  - VibeContext (selected production style)
  - Director user identifier
  - Configuration (theme, tone, participant count, chaos level)
  - Status (configuring, casting, performing, completed, expired)
  - Created timestamp
  - Expiration timestamp (24 hours from creation or last activity)
  - Cast (list of participants and character assignments)
  - Script (generated dialogue, stage directions, sound cues)
  - Performance progress (current line, scene, timing)
  - Wrap Party data (votes, awards, feedback)

### Participant
- **Attributes:**
  - Unique participant identifier
  - Session identifier (foreign key)
  - Role (Director or Actor)
  - Name (user-provided or generated)
  - Character assignment (if Actor)
  - Connection status (connected, disconnected, reconnecting)
  - Join timestamp
  - Device information (for synchronization)

### Character
- **Attributes:**
  - Unique character identifier
  - Session identifier (foreign key)
  - Participant identifier (foreign key, if assigned)
  - Name
  - Archetype label
  - Personality traits (list)
  - Hidden motivation (not visible to other participants)
  - Visual representation (image URL or data)
  - Dialogue lines (references to script lines)

### Script
- **Attributes:**
  - Unique script identifier
  - Session identifier (foreign key)
  - VibeContext (for style matching)
  - Dialogue lines (ordered list)
  - Stage directions (interspersed with dialogue)
  - Sound cues (interspersed with dialogue)
  - Timing markers (pacing, pauses)
  - Generated timestamp
  - Version (for edits/regenerations)

### VibeContext
- **Attributes:**
  - Unique vibe identifier (VIRAL_NEON, INDIE_A24, SITCOM_STUDIO, BRAINROT_THEATER, QUIET_STUDIO)
  - Visual design tokens (colors, fonts, border styles, animation styles, layout patterns including card styles, spacing, component arrangements)
  - Logo definition (SVG logo with theme-specific typography styling, optional animation specifications for glitch effects, pulsing, scanlines)
  - Text registry (centralized collection of all UI labels, button text, placeholders, messages, section titles, and terminology specific to this vibe - switched atomically with theme changes)
  - Visual effects definitions (glows, borders, shadows, animations specific to theme aesthetic)
  - Linguistic tone definitions (labels, messages, terminology)
  - AI generation parameters (prompt templates, style constraints)
  - Interaction patterns (animation speeds, hover effects, sound effects)

### Recording (Premium Feature)
- **Attributes:**
  - Unique recording identifier
  - Session identifier (foreign key)
  - Creator user identifier
  - Video file URL or reference
  - Audio file URL or reference
  - Script synchronization data
  - Created timestamp
  - Expiration timestamp (30 days for premium, 7 days for trial)
  - Share settings (public, private, link-based)
  - View count
  - Download count

## Assumptions

1. **User Base and Behavior:**
   - Primary users are Gen Z and Gen Alpha (ages 13-30)
   - Users are familiar with mobile-first applications
   - Users have stable internet connection (4G minimum)
   - Users primarily use mobile devices (smartphones, tablets)
   - Users are comfortable with AI-generated content

2. **Technical Environment:**
   - Users have modern browsers (last 2 versions of Chrome, Firefox, Safari, Edge)
   - Users have JavaScript enabled
   - Users have sufficient device storage for session data (localStorage)
   - Network latency is acceptable for real-time synchronization (under 500ms typical)

3. **Content and Moderation:**
   - Generated content (scripts, characters) will be appropriate for general audiences
   - Users will provide appropriate themes/topics (no explicit moderation required initially)
   - AI generation will produce contextually appropriate content matching vibe styles
   - No content moderation system will be implemented for MVP; relies on user responsibility and community self-regulation. Moderation features may be added in future releases if issues arise.

4. **Business Model:**
   - Free tier includes basic features (vibe selection, script generation, basic performance)
   - Premium tier includes video chat and recording features
   - Premium pricing model: Freemium with usage limits - Free users can create 5 sessions per month, Premium users have unlimited sessions. Premium subscription pricing to be determined.
   - Session limits: Free users can create 5 sessions per month, Premium users have unlimited sessions

5. **Data and Privacy:**
   - Session data is ephemeral (deleted after 24 hours unless explicitly saved)
   - User accounts are optional (sessions can be created without registration)
   - Recordings are stored securely and accessible only to authorized users
   - No personally identifiable information is collected beyond what users provide

6. **AI Generation:**
   - AI service (OpenAI) is available and reliable
   - AI generation costs are acceptable for business model
   - Generated content quality meets user expectations (85% satisfaction rate target)
   - Generation time is acceptable (under 30 seconds for typical sessions)

7. **Synchronization:**
   - Real-time synchronization uses server-authoritative model with optimistic updates
   - Server acts as single source of truth for session state
   - Local UI updates occur immediately for responsive experience, with server reconciliation for conflicts
   - Real-time synchronization uses PartyKit (WebSocket-based, Vercel-compatible)
   - PartyKit provides automatic reconnection and state recovery
   - Session state uses PartyKit storage (24h expiration) for MVP; external database optional post-MVP if longer persistence or query capabilities needed
   - Network interruptions are infrequent and recoverable
   - Participants are in same timezone or timezone differences are handled gracefully

8. **VibeContext System:**
   - Five production styles are sufficient for MVP (additional styles can be added later)
   - Visual transformations are performant and don't cause browser issues
   - VibeContext system is extensible for future styles

## Dependencies

### External Services
- **AI Generation Service:** Required for script generation, character generation, and image generation. Service must support style-constrained generation and return structured data (JSON).
- **Real-Time Communication Service:** PartyKit (WebSocket server, Vercel-compatible) for real-time session synchronization and multi-device communication. Deployed to PartyKit managed platform (partykit.dev) - no Cloudflare account required. Free tier limits: 10 projects max, 24h storage expiration, domain pattern: [project-name].[github-username].partykit.dev.
- **Session Storage:** PartyKit storage (24h expiration) for MVP. External database (PostgreSQL/Redis) optional post-MVP if longer persistence, query capabilities, or analytics are needed.
- **Video Chat Service (Premium):** Required for premium video chat feature. Service must support multi-participant video calls with audio synchronization.
- **Storage Service (Premium):** Required for recording storage and sharing. Service must support video file storage, CDN delivery, and access control.

### Internal Dependencies
- **VibeContext System:** Core system that must be implemented before other features. All features depend on VibeContext for styling and generation parameters.
- **Session Management System:** Required for multi-device synchronization and state persistence. Must be implemented before Casting Couch and The Stage features.
- **Real-Time Synchronization Infrastructure:** Required for teleprompter synchronization and multi-device state alignment. Must be implemented before The Stage feature.

### Data Dependencies
- **VibeContext Definitions:** Complete definitions for all five production styles (visual tokens, linguistic tone, AI parameters) must be created before application launch.
- **Slang Registry (for Viral Neon):** Current 2026 slang terms and usage patterns must be compiled for AI generation.
- **Character Archetype Library:** Base archetype definitions for each vibe style must be created for AI generation reference.

## Open Questions

1. **Content Moderation:** Should there be automated or manual moderation for user-provided themes and AI-generated content? What is the policy for inappropriate content?

2. **Premium Pricing:** What is the pricing structure for premium features? Subscription-based, one-time payment, or usage-based? What are the specific price points?

3. **Session Limits:** What are the exact limits for free vs. premium users? (Assumed 5 sessions/day for free, unlimited for premium - needs confirmation)

4. **Recording Storage:** What is the storage limit per user for recordings? (Assumed 10 recordings or 1GB total - needs confirmation)

5. **Character Image Generation:** ✅ RESOLVED - Character images are generated for all vibes using gpt-image-1.5. Each vibe has specific art style directives (neon glitch for Viral, film grain for Indie, etc.). Fallback: Retry with simplified prompt (remove style-specific terms), then fallback to basic character description. See `specs/001-skitso-platform/prompts/character-image-generation-prompt.md` for details.

6. **Offline Support:** Should the application support offline mode for viewing scripts or completed sessions, or is online-only acceptable?

7. **User Accounts:** Are user accounts required, or can sessions be created anonymously? What are the benefits of creating an account?

8. **Social Sharing Integration:** Which social media platforms should be prioritized for sharing? (Twitter, Instagram, TikTok assumed - needs confirmation)

9. **Performance Duration:** What is the target and maximum duration for a performance? (Assumed 2-5 minutes - needs confirmation)

10. **Chaos Level Impact:** How exactly does the chaos level (1-10) affect script generation? What are the specific differences between low and high chaos levels?

11. **Real-Time Synchronization Platform:** ✅ RESOLVED - Using PartyKit for Vercel-compatible WebSocket support.
    - **Decision:** Migrate from Socket.io to PartyKit
    - **Rationale:** Vercel doesn't support custom servers or WebSockets; PartyKit provides free tier with full WebSocket support
    - **Migration Analysis:** See `docs/PARTYKIT_MIGRATION_ANALYSIS.md`
    - **Deployment:** PartyKit managed platform (partykit.dev) - no Cloudflare account required. Supports GitHub Actions CI/CD for automated deployment.
    - **Free Tier Limits:** 10 projects max, 24h storage expiration, domain pattern: [project-name].[github-username].partykit.dev
    - **Cost:** Free tier covers MVP needs
    - **Timeline:** Migration planned for Phase 6a (after Phase 6 or Phase 7 completion)
