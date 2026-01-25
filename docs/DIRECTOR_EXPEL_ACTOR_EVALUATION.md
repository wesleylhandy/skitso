# Director Expel Actor – Evaluation

## Question

Should the director have the power to expel an actor from the party/session?

---

## Current State

### Director capabilities (enforced)

- **Character assignment** (`character:assign`): Director-only; server rejects others with "Only directors can assign characters".
- **Start performance** (`performance:start`): Director-only; "Only Director can start performance" otherwise.

### Director capabilities (spec / flow)

- Override or define character assignments before generation.
- End performance early (session → Wrap Party).
- Script advancement with director override.
- Reset / "Start New Session" (local + disconnect; not expel).

### Expel / remove today

- **Spec & tasks:** No "expel", "kick", or "remove actor" requirement.
- **UI:** No expel action in Casting Couch or elsewhere. Participants can only leave themselves.
- **Server:** `session:leave` accepts optional `participantId`. When provided, that participant is removed and `participant:left` is broadcast. **There is no authorization check** – any participant could, in theory, send `session:leave` with another’s `participantId` and remove them. The client only ever sends `{ sessionId }` (self-leave), so expel is not exposed.

### Other auth gaps (relevant but separate)

- `session:state:update`: No director check; anyone could change status.
- `session:leave` + `participantId`: Unrestricted; we’d fix this if we add director-only expel.

---

## Use Cases For Expel

| Use case | When | Notes |
|----------|------|--------|
| Wrong person joined | Casting | Shared link, typo in code, etc. Director wants to remove and re-invite. |
| Disruptive actor | Casting or performing | Behavior issues; director needs to remove without ending whole session. |
| Trim / replace cast | Casting | Too many joined, or director wants different people before starting. |
| Actor unresponsive | Casting | Ghost participant; director clears them to keep lobby accurate. |

---

## Use Cases Against / Risks

| Concern | Mitigation |
|--------|------------|
| **Abuse** – Director kicks arbitrarily | Same as other director powers (assign, start). Trust model is director-in-charge. |
| **Confusion** – Actor removed without clarity | Notify actor when expelled (e.g. toast + redirect), and show optional reason in UI. |
| **Script/cast mismatch** | Character stays in script. If we expel, we must unassign that character and optionally handle "orphaned" lines (see below). |

---

## Script & Cast Implications

- Cast and script are fixed at generation. Each character has lines.
- **Expel during casting:** Unassign character from expelled actor. Character remains in cast; can be reassigned or left unassigned. Script unchanged. Straightforward.
- **Expel during performance:** Same unassign, but that character’s lines are still in the script. Options:
  - **A)** Treat as "vacant" role: lines stay, no one delivers them (weird for teleprompter).
  - **B)** Director "ends performance early" instead of expelling one actor (current spec).
  - **C)** Support expel mid-performance and define behavior for orphaned lines (e.g. skip, or placeholder) – more product/UX work.

**Recommendation:** If we add expel, **limit it to casting** for MVP. During performance, keep "Director ends performance early" as the way to stop or reset. Revisit mid-performance expel later if needed.

---

## Spec Fit

- Spec: Director configures session, overrides assignments, starts/ends performance. No explicit expel.
- Edge cases: "Actor joins mid-performance", "Actor loses connection" – no "director removes actor".
- Expel is a **natural extension** of director-as-host: they already choose who gets which character and when the show starts; removing a participant fits that role.

---

## Recommendation

### 1. **Yes – director should be able to expel an actor**

**Rationale:**

- Aligns with director-as-host (assign, start, end). Removing a participant is consistent.
- Supports real scenarios: wrong joiner, disruptive or ghost actors, trimming cast.
- Low extra trust: we already trust the director with cast and flow.

### 2. **Scope for MVP**

- **Casting only.** No expel during performance. Use "end performance early" for that.
- **Director-only.** Restrict expel to director; fix `session:leave` + `participantId` abuse.

### 3. **Implementation sketch**

- **Option A – Reuse `session:leave`:**  
  - Allow `session:leave` with `participantId` **only** when sender is director.  
  - Self-leave (no `participantId`) stays allowed for anyone.  
  - Add director check in `handleSessionLeave`.

- **Option B – New message `actor:expel`:**  
  - `actor:expel` `{ sessionId, participantId }`, director-only.  
  - Server: unassign character from that participant, remove from `participants`, broadcast `participant:left` (and optionally `cast:updated`).  
  - Keeps `session:leave` for self-leave only; clearer semantics.

**Recommendation:** **Option B** (`actor:expel`). Clearer intent, easier to reason about and audit, and keeps `session:leave` strictly for "I am leaving."

### 4. **UX**

- **Casting Couch:** Per-actor control (e.g. "Remove" or "Expel") for director only. Confirmation modal to reduce accidents.
- **Expelled actor:** Client receives `participant:left` for their `participantId`; show message ("You were removed from the session") and redirect to join page or home.

### 5. **Security**

- Fix **`session:leave` + `participantId`**: either forbid it (if we use `actor:expel`) or restrict to director (if we use Option A).
- Ensure **`session:state:update`** is director-only if it isn’t already; that’s a separate change but relevant to director authority.

---

## Summary

| | |
|-|-|
| **Should director have power to expel?** | **Yes.** |
| **When?** | Casting only for MVP. |
| **How?** | New `actor:expel` message, director-only; unassign character, remove participant, broadcast `participant:left`. |
| **Client** | Director: "Remove" in Casting Couch with confirm. Expelled actor: notify + redirect. |
| **Also fix** | Restrict or remove `session:leave` + `participantId`; consider enforcing director-only `session:state:update`. |

---

## Optional: Later Enhancements

- **Mid-performance expel** plus defined behavior for orphaned lines (e.g. skip, placeholder).
- **Optional reason** when expelling (for expelled user’s message).
- **Audit log** of who expelled whom and when (if we add broader logging).
