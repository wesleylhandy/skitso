# Join Page During Skit Generation: UX Options

## Current Behavior

**Director form (configuring):**
- `loadingStep`: `'characters'` → `'generating'` (script + images in parallel).
- Rich progress: titles (`loadingCharactersTitle` / `loadingContentTitle`), body copy (`loadingCharactersBody` / `loadingGeneratingBody`), and a progress bar (characters → script → images).
- Progress is **local only**. Nothing is broadcast to PartyKit during generation.

**PartyKit / join page:**
- Session status stays `configuring` until generation completes, then `updateSessionState('casting')` → `session:state:updated`.
- Director syncs **cast** after character gen and **script** after script gen. PartyKit broadcasts `cast:updated` and `script:updated`.
- Join page subscribes to `state:recovered`, `cast:updated`, `script:updated`, `session:state:updated`.

**Join page “waiting” UI:**
- When the actor has joined but `!(script && cast.length > 0)` and no character assignment yet, it shows a static **`waitingForGeneration`** message (e.g. *“Waiting for the director to finish cooking the script and characters...”*).
- Actors **do** receive updates when cast or script **finish** (via those events), and the UI can transition to preview once data exists. They **do not** see progress **during** generation (e.g. “Generating characters…”, “Writing script…”).

---

## UX Considerations

| Goal | Why it matters |
|------|----------------|
| **Reduce perceived wait** | Users tolerate waits better when they know something is happening. |
| **Reduce confusion** | “Why is nothing changing?” → “It’s still generating.” |
| **Reduce bounce** | Visible progress reduces refresh/leave. |
| **Avoid false precision** | Script/gen can vary a lot; exact % or ETA can backfire. |
| **Keep scope manageable** | Director form already has full progress; join page needs “good enough” feedback. |

---

## Options

### Option 1: Status-only (minimal change)

**What:** No new progress. Keep current `waitingForGeneration` message. Optional copy tweak, e.g. *“You’ll see characters and script here as soon as they’re ready.”*

**Pros:** No new plumbing, no new PartyKit messages.  
**Cons:** Long generation still feels like a black box; no “currently doing X” feedback.

**Effort:** Low (copy-only if you change anything).

---

### Option 2: Leverage existing updates (cast/script land)

**What:** Join page already gets `cast:updated` and `script:updated`. Use those to **acknowledge** progress:
- When **cast** arrives (and still no script): e.g. *“Characters are ready. Waiting for the script…”*
- When **script** arrives: e.g. *“Script ready. Almost there…”* (or similar), then transition to preview when both exist.

**Pros:** No new PartyKit message types. Clear “something just arrived” feedback.  
**Cons:** No “we’re currently generating characters” — only “characters just landed.” Most of the wait (characters + script + images) still has a single static phase before first update.

**Effort:** Low. Join page logic + copy changes only.

---

### Option 3: Coarse progress messages (phase + message)

**What:** Introduce a **`generation:progress`** (or similar) PartyKit message:

```ts
{ type: 'generation:progress'; data: { sessionId: string; phase: 'characters' | 'script' | 'images'; message: string } }
```

- Director form emits when `loadingStep` or phase changes (e.g. characters → generating, and optionally “script” vs “images” if you split them).
- Join page subscribes and shows **phase + message** under the waiting UI (e.g. *“Generating characters…”*, *“Writing script and adding visuals…”*).

**Pros:** Actors see “we’re doing X now,” which matches Director-side progress. No fake percentages.  
**Cons:** New message type; Director form must emit; PartyKit must handle/broadcast (or clients broadcast via existing channel).

**Effort:** Medium. Director form + PartyKit + join page.

---

### Option 4: Detailed progress (steps + optional %)

**What:** Extend progress with steps and optional progress:

```ts
{
  type: 'generation:progress';
  data: {
    sessionId: string;
    step: number;        // 1..4
    stepLabel: string;   // e.g. "Generating characters"
    progress?: number;   // 0..100, optional
  };
}
```

- Join page shows a **stepper** (“Step 1 of 4”) and/or **progress bar**.
- Director form maps `loadingStep` + `generationProgress` into these fields and emits.

**Pros:** Very clear, “game-like” progress.  
**Cons:** More UI and state; steps can change (e.g. skip images); progress is approximate and can feel misleading if uneven.

**Effort:** Medium–high. Same as Option 3, plus join page stepper/progress UI.

---

### Option 5: Hybrid (status + optional progress)

**What:** Keep **status** and **cast/script updates** as today. Add **optional** `generation:progress` (phase + message, Option 3–style).

- When **no** progress is received: show current `waitingForGeneration` (or Option 2–style copy when cast/script land).
- When **progress** is received: show status + **“Right now: \<message\>”** (e.g. *“Right now: Generating characters…”*).

**Pros:** Backward compatible; works even if Director doesn’t emit yet. Incremental.  
**Cons:** Slightly more join-page logic (status vs status+progress).

**Effort:** Medium (same as Option 3, with a bit more conditional UI).

---

## Recommendation

- **Short term:** **Option 2** — Use existing `cast:updated` / `script:updated` to acknowledge “characters ready” and “script ready” on the join page. Improves clarity with no new infra.
- **Next step:** **Option 3 or 5** — Add `generation:progress` (phase + message) so actors see “we’re currently doing X” during generation. Option 5 keeps behavior correct if progress is missing.

Implementing Option 3/5 would involve:

1. **PartyKit** — Handle `generation:progress` (or `session:generation:progress`) and broadcast to room (or allow client→server→broadcast).
2. **Director form** — Emit progress when `loadingStep` / phase changes, reusing existing `loadingCharactersTitle` / `loadingContentTitle` and body copy for `message`.
3. **PartyKit client** — `onGenerationProgress(callback)`, plus `emitGenerationProgress(sessionId, phase, message)` used by Director form.
4. **Join page** — Subscribe and show phase + message in the “waiting” UI, with fallback when no progress is available (Option 5).

### Option 5 implementation (done)

- **PartyKit** (`parties/session.ts`): New message `generation:progress`; `handleGenerationProgress` broadcasts `{ sessionId, phase, message, timestamp }` to the room.
- **Director form**: Emits when entering `characters` phase (`loadingCharactersTitle`) and `script` phase (`loadingGeneratingBody`). Uses a `code` variable so new sessions have a valid `sessionId` for emit and create-session.
- **PartyKit client**: `onGenerationProgress` and `emitGenerationProgress(sessionId, phase, message)`.
- **Join page**: Subscribes to `onGenerationProgress`, keeps `generationProgress` state, clears on `session:state:updated` → `casting`. Waiting UI shows `waitingForGeneration`; when `generationProgress` exists, also shows *"Right now: {message}"* (`role="status"`, `aria-live="polite"`).

---

## Summary Table

| Option | New PartyKit messages | Director changes | Join page changes | Effort |
|--------|------------------------|------------------|-------------------|--------|
| 1. Status-only | No | No | Copy only (optional) | Low |
| 2. Leverage cast/script | No | No | Logic + copy | Low |
| 3. Coarse progress | Yes (`generation:progress`) | Emit on phase change | Subscribe + show message | Medium |
| 4. Detailed progress | Yes (extended) | Emit step + % | Stepper / progress UI | Medium–high |
| 5. Hybrid | Yes (optional) | Same as 3 | Status + progress when available | Medium |
