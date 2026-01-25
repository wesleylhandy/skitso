<!--
Sync Impact Report:
Version: 0.0.0 → 1.0.0 (Initial creation)
Modified Principles: N/A (new document)
Added Sections: All sections (initial creation)
Removed Sections: N/A
Templates Requiring Updates:
  ✅ updated: .specify/templates/plan-template.md
  ✅ updated: .specify/templates/spec-template.md
  ✅ updated: .specify/templates/tasks-template.md
  ✅ updated: .specify/templates/commands/speckit.constitution.md
Follow-up TODOs: None
-->

# Skitso Project Constitution

**Version:** 1.0.1  
**Ratification Date:** 2025-01-27  
**Last Amended:** 2025-01-27

---

## Preamble

This constitution establishes the foundational principles, technical standards, and governance framework for **Skitso**, a collaborative "social-scripting" platform that transforms group hangouts into immersive performance spaces. The project leverages a global **VibeContext** system to enable Directors to select aesthetic and linguistic "Production Styles" (Viral Neon, Indie A24, Sitcom Studio, Brainrot Theater) that simultaneously control AI generation, visual DNA, and user experience across all participant devices.

---

## Core Principles

### Principle 1: VibeContext as Single Source of Truth

**Rule:** The `VibeContext` MUST be the authoritative state for all aesthetic, linguistic, and behavioral decisions across the application. All components, AI prompts, and UI theming MUST derive from the active VibeContext atom.

**Rationale:** Skitso's core value proposition is seamless aesthetic transformation. By centralizing vibe state in a single Jotai atom, we ensure consistency across Director configuration, Actor synchronization, and Teleprompter performance. This prevents "vibe drift" where different parts of the app display conflicting styles.

**Implementation Requirements:**
- VibeContext MUST be stored in a persistent Jotai atom (`atomWithStorage`)
- All theme variables MUST be derived from VibeContext, not hardcoded
- AI system prompts MUST include VibeContext as a required parameter
- Navigation labels and interaction patterns MUST adapt to active VibeContext

---

### Principle 2: Real-Time Synchronization

**Rule:** When a Director establishes a VibeContext, all joining Actors MUST receive synchronized theme updates within 500ms. The synchronization mechanism MUST be bidirectional and conflict-resistant.

**Rationale:** Collaborative performance requires visual cohesion. Actors joining mid-session must immediately see the Director's chosen aesthetic to maintain immersion. Sub-second synchronization ensures the experience feels "live" rather than "stale."

**Implementation Requirements:**
- VibeContext changes MUST broadcast to all connected Actors
- UI theme swaps MUST be atomic (no intermediate states visible)
- Synchronization failures MUST degrade gracefully (show error, maintain last known good state)
- Connection state MUST be visible to Director and Actors

---

### Principle 3: AI Generation Consistency

**Rule:** All AI-generated content (scripts, archetypes, character descriptions) MUST be constrained by the active VibeContext. System prompts MUST explicitly include vibe-specific slang registries, tone guidelines, and stylistic constraints.

**Rationale:** Skitso solves "Corporate Cringe" by making slang and aesthetics user-controlled. If AI generates content that doesn't match the chosen vibe, the illusion breaks. Consistency requires explicit prompt engineering that enforces vibe boundaries.

**Implementation Requirements:**
- Character generation prompts MUST include: VibeContext, Group Size, Context
- Script generation prompts MUST include: VibeContext, Cast JSON, Slang Registry, Chaos Level
- Character image generation MUST include: Character Description + Vibe-specific Art Style
- All OpenAI API calls MUST validate VibeContext presence before execution
- Generated content MUST be validated against vibe constraints before display

---

### Principle 4: Progressive Enhancement Architecture

**Rule:** The application MUST function with core features (vibe selection, script generation, teleprompter) without requiring real-time backend infrastructure. MVP state MUST persist in browser storage using `atomWithStorage`.

**Rationale:** MVP delivery requires shipping without complex backend setup. Browser-local state enables rapid iteration and testing. Future migration to persistent backend MUST not break existing atom-based state management.

**Implementation Requirements:**
- All critical state (vibe, cast, currentScript, chaosLevel) MUST use `atomWithStorage`
- State persistence MUST survive browser refreshes until "Wrap Party" completion
- Backend migration MUST maintain atom interface compatibility
- Offline functionality MUST be supported for core Director workflows

---

### Principle 5: Dynamic Theming System

**Rule:** Visual theming MUST be implemented via CSS custom properties (CSS Variables) that are swapped based on VibeContext. Tailwind CSS v4 tokens MUST reference these variables, not hardcoded values.

**Rationale:** Multi-vibe support requires runtime theme switching. CSS Variables enable atomic theme swaps without component re-renders. Tailwind v4's variable system aligns with this requirement.

**Implementation Requirements:**
- Theme variables MUST be defined in `[data-theme='VIBE_NAME']` selectors
- All color, font, and effect tokens MUST reference CSS variables
- Theme provider MUST apply `data-theme` attribute to root element
- Theme swaps MUST be instant (<100ms visual delay)
- No hardcoded color/font values in component styles

---

### Principle 6: Type Safety and Modern React Patterns

**Rule:** TypeScript strict mode MUST be enabled. All state atoms, API responses, and component props MUST be fully typed. Server Components MUST be the default; Client Components only when interactivity is required.

**Rationale:** Type safety prevents runtime errors in complex state flows. Server Components reduce bundle size and improve performance. These patterns align with Next.js 16+ best practices.

**Implementation Requirements:**
- `tsconfig.json` MUST have `strict: true`
- No `any` types allowed (use `unknown` if type uncertain)
- Jotai atoms MUST have explicit TypeScript types
- OpenAI API responses MUST be validated with Zod schemas
- Server Components MUST be used unless hooks/event handlers required

---

### Principle 7: Accessibility and Semantic HTML

**Rule:** All interactive elements MUST be keyboard accessible. Screen reader support MUST be implemented for vibe selection, script navigation, and cast management. WCAG 2.1 AA compliance MUST be maintained.

**Rationale:** Collaborative platforms must be inclusive. Accessibility ensures all users can participate regardless of input method or assistive technology needs.

**Implementation Requirements:**
- Native HTML elements (`<button>`, `<select>`, `<dialog>`) MUST be used over custom equivalents
- Focus management MUST be implemented for modals and navigation
- Color contrast MUST meet WCAG 2.1 AA standards (4.5:1 normal, 3:1 large)
- Touch targets MUST be minimum 44x44px
- ARIA labels MUST be provided for custom interactive components

---

### Principle 8: Performance and Bundle Optimization

**Rule:** Initial page load MUST be under 3 seconds on 3G connection. Code splitting MUST be used for heavy components (Teleprompter, AI generation UI). Images and assets MUST be optimized for web delivery.

**Rationale:** Social-scripting sessions are often spontaneous. Slow load times break immersion. Performance directly impacts user retention.

**Implementation Requirements:**
- Next.js `dynamic()` MUST be used for code splitting heavy components
- Images MUST use Next.js `Image` component with optimization
- Font loading MUST use `next/font` with subset optimization
- Bundle size MUST be monitored (target: <200KB initial JS)
- Lazy loading MUST be implemented for below-fold content

---

## Technical Standards

### Stack Requirements

- **Framework:** Next.js 16+ (App Router) deployed on Vercel
- **Styling:** Tailwind CSS v4 with CSS Variables for theming
- **State Management:** Jotai with `atomWithStorage` for persistence
- **AI Engine:** OpenAI API (GPT-4o for scripts/archetypes, gpt-image-1.5 for character art)
- **Database/ORM (Post-MVP):** PostgreSQL with Prisma (schema migration ready)
- **Type Safety:** TypeScript 5+ with strict mode

### Directory Structure

```
/src
  /components
    /ui             # Shadcn-like accessible components
    /vibes          # Theme-specific wrappers and style overrides
    /director       # Intake form and configuration logic
    /teleprompter   # Real-time script reader and soundboard
  /state            # Jotai atoms for 'vibe', 'currentScript', and 'cast'
  /lib
    /openai         # System prompt templates and API handlers
    /hooks          # useVibe hooks for dynamic theme switching
  /styles           # Global CSS with vibe-specific variable tokens
```

### State Atom Definitions

```typescript
import { atomWithStorage } from 'jotai/utils';

export const vibeAtom = atomWithStorage<VibeType>('vibe', 'VIRAL_NEON');
export const castAtom = atomWithStorage<CastMember[]>('cast', []);
export const currentScriptAtom = atomWithStorage<Script | null>('current_script', null);
export const chaosLevelAtom = atomWithStorage<number>('chaos_level', 5);
```

### VibeContext Types

VibeContext MUST support at minimum:
- `VIRAL_NEON`: High-energy, internet-native slang, neon aesthetics
- `INDIE_A24`: Cinematic, artistic, nuanced dialogue
- `SITCOM_STUDIO`: Classic TV comedy timing and structure
- `BRAINROT_THEATER`: Absurdist, meme-heavy, chaotic energy
- `QUIET_STUDIO`: Professional minimalist, anti-cringe, clean productivity tool

---

## Governance

### Amendment Procedure

1. **Proposal:** Any team member MAY propose a constitution amendment via pull request to `.specify/memory/constitution.md`
2. **Review:** Amendments MUST be reviewed by at least one other team member
3. **Versioning:** Amendments MUST increment version according to semantic versioning:
   - **MAJOR:** Backward incompatible principle removals or redefinitions
   - **MINOR:** New principle/section added or materially expanded guidance
   - **PATCH:** Clarifications, wording, typo fixes, non-semantic refinements
4. **Ratification:** Amendments are ratified upon merge to main branch
5. **Propagation:** Constitution changes MUST trigger review of dependent templates (plan, spec, tasks, commands)

### Compliance Review

- **Pre-commit:** Developers MUST self-assess compliance with principles before committing
- **Code Review:** Reviewers MUST flag violations of constitution principles
- **Quarterly Audit:** Full constitution compliance review every quarter (or upon major version bump)

### Version History

- **1.0.1** (2025-01-27): Added QUIET_STUDIO to VibeContext types (constitution alignment fix)
- **1.0.0** (2025-01-27): Initial constitution ratification

---

## Exceptions and Deviations

Exceptions to constitution principles MUST be:
1. Documented in code comments with rationale
2. Approved via pull request review
3. Tracked in project issue tracker with label `constitution-exception`
4. Reviewed for removal in next quarterly audit

---

## Related Documents

- Technical Specification: `.specify/templates/spec-template.md`
- Planning Template: `.specify/templates/plan-template.md`
- Task Template: `.specify/templates/tasks-template.md`
- Command Templates: `.specify/templates/commands/*.md`

---

*This constitution is a living document. It evolves with the project while maintaining core principles that define Skitso's identity and technical excellence.*
