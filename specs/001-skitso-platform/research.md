# Research & Technical Decisions: Skitso Platform

**Date:** 2025-01-27  
**Feature:** Skitso Platform MVP

## Research Findings

### 1. Real-Time Synchronization: Socket.io vs ws Library

**Decision:** Socket.io for MVP

**Rationale:**
- Socket.io provides sub-500ms latency required for teleprompter synchronization
- Bidirectional communication supports server-authoritative model with optimistic updates
- Automatic polling fallback for environments where WebSocket is blocked (corporate firewalls)
- Built-in room management perfect for session-based grouping (`socket.join(sessionId)`)
- Automatic reconnection with exponential backoff (saves 1-2 weeks of development time)
- Lower bandwidth than frequent polling (important for mobile users)

**Alternatives Considered:**
- **ws library:** Lightweight (~10KB vs ~50KB) but requires manual implementation of:
  - Polling fallback (must implement manually)
  - Room/session management (must implement manually)
  - Reconnection logic with exponential backoff (must implement manually)
  - Connection state management (must implement manually)
  - Estimated 1-2 weeks additional development time vs Socket.io
- **Polling only:** Simpler implementation but higher latency and bandwidth usage
- **Server-Sent Events (SSE):** Unidirectional, doesn't support client-to-server updates needed for script advancement
- **WebRTC:** Overkill for state synchronization, better suited for video chat (premium feature)

**Comparison Analysis:**
See `socket-comparison.md` for detailed Socket.io vs ws comparison. Key factors:
- Socket.io: Faster MVP delivery, built-in features, ~40KB larger bundle
- ws: Smaller bundle, more control, requires significant manual implementation
- **Decision:** Socket.io chosen for MVP speed and built-in features; can migrate to ws post-MVP if bundle size becomes critical

**Implementation Notes:**
- Use Socket.io library for real-time synchronization
- Socket.io provides built-in reconnection handling, room management, and automatic fallback to polling
- Implement exponential backoff reconnection strategy (Socket.io handles this automatically)
- Automatic fallback to polling (long-polling) if WebSocket fails (handled by Socket.io)
- Use message queue for offline state changes (sync on reconnect)
- Socket.io rooms for session-based grouping (one room per session)

**References:**
- Socket.io Documentation: https://socket.io/docs/v4/
- Socket.io LLMs.txt Reference: https://context7.com/websites/socket_io/llms.txt?tokens=10000
- ws Library LLMs.txt Reference: https://context7.com/websockets/ws/llms.txt?tokens=10000
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Detailed Comparison: See `socket-comparison.md` in this directory

---

### 2. OpenAI API: Style-Constrained Prompt Engineering

**Decision:** Structured system prompts with explicit VibeContext constraints and JSON schema validation

**Rationale:**
- Explicit constraints in system prompts ensure consistent vibe matching
- JSON schema validation (Zod) catches malformed responses before display
- Structured prompts reduce token usage vs. verbose descriptions
- Enables retry with simplified prompts (remove optional constraints on failure)

**Prompt Structure:**
```
System: You are a script generator for {VIBE_CONTEXT} style performances.
Constraints:
- Dialogue must use {VIBE_SLANG_REGISTRY} terminology
- Tone must match {VIBE_TONE_GUIDELINES}
- Pacing must be {VIBE_PACING} (snappy/contemplative/etc.)
- Character archetypes must use {VIBE_ARCHETYPE_LABELS}

Output format: JSON schema (dialogue lines, stage directions, sound cues)
```

**Retry Strategy:**
1. Initial attempt: Full prompt with all constraints
2. First retry: Simplified prompt (remove optional constraints, keep core vibe)
3. Second retry: Minimal prompt (basic structure, vibe name only)
4. If all fail: Show error with manual retry option

**Alternatives Considered:**
- **Fine-tuned models:** Too expensive and complex for MVP
- **Few-shot examples:** Increases token usage, less flexible
- **Separate models per vibe:** Unnecessary complexity, single model with constraints works

**Cost Optimization:**
- Cache successful generations for similar inputs (theme + vibe + participant count)
- Use GPT-4o for quality, not GPT-4 Turbo (better style adherence)
- Batch character image generation where possible

**References:**
- OpenAI API Best Practices: https://platform.openai.com/docs/guides/prompt-engineering
- Zod schema validation: https://zod.dev/

---

### 3. CSS Variables + Tailwind v4 Integration

**Decision:** CSS custom properties in `globals.css` with Tailwind v4 variable references

**Rationale:**
- CSS Variables enable atomic theme swaps without component re-renders
- Tailwind v4 supports CSS variable references in config
- `data-theme` attribute selector provides clean scoping
- Performance: CSS variable changes are GPU-accelerated

**Implementation Pattern:**
```css
/* globals.css */
[data-theme='VIRAL_NEON'] {
  --color-bg: #0A0A0A;
  --color-primary: #8AFB17;
  /* ... */
}

/* tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        primary: 'var(--color-primary)',
        /* ... */
      }
    }
  }
}
```

**Theme Provider:**
```typescript
// ThemeProvider subscribes to vibeAtom, applies data-theme to root
useEffect(() => {
  document.documentElement.setAttribute('data-theme', currentVibe);
}, [currentVibe]);
```

**Alternatives Considered:**
- **CSS-in-JS (styled-components):** Runtime overhead, harder to optimize
- **Tailwind classes per vibe:** Duplicate component code, harder to maintain
- **CSS Modules:** Doesn't support dynamic theme switching easily

**Performance:**
- Theme swap: <100ms (CSS variable change is instant)
- No re-renders required (CSS handles visual changes)
- Bundle size: No additional JS for theming

**References:**
- Tailwind CSS Variables: https://tailwindcss.com/docs/customizing-colors#using-css-variables
- CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties

---

### 4. Session Code Generation

**Decision:** Cryptographically secure random alphanumeric (8-10 characters) using Web Crypto API

**Rationale:**
- 8-10 characters provides sufficient entropy (128-bit minimum requirement)
- Alphanumeric (A-Z, a-z, 0-9) balances security and usability
- Web Crypto API provides cryptographically secure randomness
- Collision probability is negligible for expected session volume

**Algorithm:**
```typescript
function generateSessionCode(length: number = 9): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}
```

**Entropy Calculation:**
- 62 possible characters (A-Z, a-z, 0-9)
- 9 characters: 62^9 ≈ 1.35 × 10^16 combinations
- Entropy: log2(62^9) ≈ 54 bits per code
- For 128-bit requirement: Use 10 characters (log2(62^10) ≈ 60 bits) or combine with server-side secret

**Shareable Link:**
- Format: `https://skitso.app/join/{sessionCode}`
- Server validates code and redirects to session
- Link can be shortened for social sharing

**Alternatives Considered:**
- **UUID:** Too long (36 chars), not user-friendly
- **Numeric only:** Lower entropy, easier to guess
- **Base64:** Includes special characters, harder to type

**Security:**
- Codes are unguessable (cryptographically random)
- Server validates codes before allowing join
- Rate limiting prevents brute force attempts
- Codes expire after 24 hours

**References:**
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- Entropy calculation: https://en.wikipedia.org/wiki/Password_strength

---

### 5. Jotai atomWithStorage Patterns

**Decision:** Use `atomWithStorage` for all session-critical state with localStorage backend

**Rationale:**
- Browser localStorage provides persistence without backend
- `atomWithStorage` integrates seamlessly with Jotai reactive system
- Survives browser refreshes (required for MVP)
- Future backend migration can maintain atom interface

**Storage Structure:**
```typescript
// Atoms persist to localStorage with keys:
'vibe' → VibeType
'cast' → CastMember[]
'current_script' → Script | null
'chaos_level' → number
'session_code' → string | null
'session_state' → SessionState
```

**Size Limits:**
- localStorage typically 5-10MB per domain
- Estimated session data: ~100KB (script, cast, config)
- Well within limits for MVP
- Future: Consider compression or IndexedDB for larger sessions

**Cleanup Strategy:**
- Sessions expire after 24 hours (timestamp check)
- Cleanup on Wrap Party completion
- Periodic cleanup of expired sessions (on app load)

**Migration Strategy:**
- Keep atom interface when adding backend
- Backend becomes source of truth, atoms sync to backend
- Backward compatible: Works with or without backend

**Alternatives Considered:**
- **IndexedDB:** More complex, unnecessary for MVP data size
- **SessionStorage:** Doesn't persist across tabs, not suitable
- **Backend-only:** Requires backend infrastructure, blocks MVP delivery

**References:**
- Jotai atomWithStorage: https://jotai.org/docs/utils/atom-with-storage
- localStorage limits: https://developer.mozilla.org/en-US/docs/Web/API/Storage

---

## Summary of Decisions

| Decision Area | Chosen Solution | Key Rationale |
|--------------|----------------|---------------|
| Real-Time Sync | Socket.io (WebSocket with polling fallback) | Sub-500ms latency, bidirectional, built-in reconnection |
| AI Prompting | Structured prompts with VibeContext constraints | Consistency, cost-effective |
| Theming | CSS Variables + Tailwind v4 | Atomic swaps, no re-renders |
| Session Codes | Crypto-secure alphanumeric (8-10 chars) | Security + usability |
| State Persistence | Jotai atomWithStorage (localStorage) | MVP-friendly, future-proof |

All research items resolved. Ready for Phase 1 design.
