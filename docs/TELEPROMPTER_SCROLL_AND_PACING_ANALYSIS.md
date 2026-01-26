# Teleprompter Scroll & Pacing Analysis

## Summary

| Topic | Finding |
|-------|---------|
| **Mobile scroll "a little off"** | **Fixed:** Scrolled-into-view lines were hidden under the sticky header because we didn't offset by header height. Header height varies by viewport (wrap, banner, Director vs Actor). We now measure it at runtime and apply `scroll-margin-top` to the current line. See §2.. |
| **Autoscroll "does not work"** | Autoscroll **is implemented**: when `currentLineIndex` changes, an effect scrolls the current line to the top via `scrollIntoView`. It can fail on mobile (same root cause as above) or when the line element isn’t found yet (retry logic exists). |
| **Paced walk-through** | **Not supported.** Advancement is **manual only** (Advance button, Space, Arrow Right). There is no auto-advance at a given pace (e.g. WPM or seconds per line). |

---

## 1. Current Scroll Implementation

**Location:** `src/components/teleprompter/teleprompter.tsx` (lines 137–238)

**Behavior:**

- A `useEffect` runs when `currentLineIndex` (or `visualTokens.animationStyle`) changes.
- It finds the current line DOM node (via `currentLineRef` or `[data-line-index="…"]`).
- It calls `lineElement.scrollIntoView({ block: 'start', inline: 'nearest', behavior })` to bring the current line to the top of the scrollable area.
- Respects `prefers-reduced-motion` and vibe (`snappy` → `auto`, else `smooth`).
- Uses `requestAnimationFrame` twice to wait for React render + layout before scrolling.
- If the line isn’t found, it retries once after 50ms.

**Scroll container:** The scrollable region is a `div` with `flex-1 min-h-0 overflow-y-auto` (`scrollContainerRef`). The `min-h-0` is **required**: flex items default to `min-height: auto`, which prevents shrinking; without `min-h-0`, the container grows with content, never overflows, and **does not scroll**. Then `scrollTo(0)` / `scrollTo(target)` have no effect. See §1.1. The script lines live inside a `max-w-4xl mx-auto space-y-4` wrapper. The **sticky header** (Director/ Actor controls) is **outside** this scroll container, so it does not scroll with the script.

### 1.1 Flex + overflow root cause (min-h-0)

**Problem:** With `flex-1 overflow-y-auto` but no `min-h-0`, the scroll container does not actually scroll. Initial view can “work” (we’re at `scrollTop` 0) while **advance does nothing** because the container is not scrollable.

**Fix:** Add `min-h-0` to the scroll container. References: [overflow: scroll on div with flex: 1](https://stackoverflow.com/questions/70198644/overflow-scroll-on-div-with-flex-1-without-specific-height), [overflow not working on flex items](https://stackoverflow.com/questions/37442722/overflowscroll-not-working-on-flex-items).

**Intent:** “Auto-scroll” here means **scroll-to-current-line on advance**: whenever the user (or sync) advances, the view scrolls so the new current line is at the top. It is **not** continuous autoscroll (e.g. ticker-style) or pace-based advance.

---

## 2. Why Mobile Scroll Can Be “a Little Off”

**Root cause:** `scrollIntoView()` is **not reliable** inside an `overflow-y-auto` (or `overflow: auto`) div on Mobile Safari and some mobile browsers.

**Evidence:**

- Stack Overflow / WebKit bug reports: [Mobile Safari, scrollIntoView doesn’t work](https://stackoverflow.com/questions/45098593/mobile-safari-scrollintoview-doesnt-work), [WebKit nested scroll boxes](https://bugs.webkit.org/show_bug.cgi?id=189907).
- `scrollIntoView` scrolls **scrollable ancestors** chosen by the UA. With nested scrollables (e.g. body + inner `overflow-y-auto` div), mobile UAs often scroll the **window** instead of (or as well as) the inner div, or behave inconsistently.
- The current code **does not** scroll the container explicitly; it only calls `scrollIntoView` on the line. So we fully depend on the browser to scroll the right element.

**Additional mobile factors:**

- **Scroll chaining / overscroll:** Inner scroll can chain to the outer page. `overscroll-behavior: contain` on the scroll div is not set and could help.
- **Viewport changes:** Keyboard open/close, dynamic toolbars, safe areas can change layout around scroll, making “scroll to top of line” feel slightly off even when the inner scroll works.
- **Touch vs programmatic scroll:** Some devices prioritize touch-driven scroll and can fight or override programmatic scroll.

**Fix applied (header offset):** The "items hidden by the fixed header" issue is addressed by (1) measuring header height at runtime via `ResizeObserver` (fallback when unavailable, e.g. jsdom), and (2) applying `scroll-margin-top: headerHeight` to the current line so scrolled-into-view lines sit below the header. **Optional:** Prefer explicit `container.scrollTop` over `scrollIntoView` to avoid mobile quirks.

---

## 3. Why “Autoscroll Doesn’t Work” (User Report)

**Possible causes:**

1. **Mobile `scrollIntoView` failure** (same as above): The effect runs, but the inner container doesn’t scroll, so it looks like “no autoscroll.”
2. **Line not found:** The 50ms retry handles late-mounted DOM, but in heavy or slow layouts (e.g. low-end mobile) the line can still be missing, so no scroll occurs.
3. **Wrong scroll target:** If the UA scrolls the window instead of the inner div, the teleprompter content may not move, or it may jump in a confusing way.
4. **Logging:** The effect logs to `console`. Checking for `[Teleprompter]` messages (including “Line element not found”) can confirm whether the effect runs and whether it finds the line.

**Conclusion:** The **feature exists** (scroll-to-current on advance), but **reliance on `scrollIntoView`** makes it fragile, especially on mobile. Fixing scroll via explicit `scrollTop` on the container should address both “mobile off” and “autoscroll doesn’t work” where the failure is scroll-related.

---

## 4. Paced Walk-Through (Auto-Advance at a Given Pace)

**Spec / product:**

- `spec.md` FR-6: *“Both Director and Actors can **manually** advance script lines”* and *“Director has override authority to **control** or **pause** script advancement.”*
- No mention of automatic, time-based advancement or “words per minute” / “seconds per line” pacing.

**Current implementation:**

- **Advancement:** Only via **manual** actions:
  - Advance button (`AdvanceControl` / Director buttons).
  - Keyboard: Space or Arrow Right (when not paused and no Director override).
- **`TimingIndicator`:** Shows elapsed time, estimated duration, and fast/normal/slow **pacing feedback** for the **current** line. It is **display-only**; it does **not** trigger advance.
- **`estimatedDuration`:** Hard-coded to `5` seconds per line in `TimingIndicator` and when passed from `Teleprompter`. Not used for auto-advance.

**Conclusion:** There is **no** paced walk-through. The teleprompter is **manual-only**: users advance when ready; the Director can pause and override. Adding a “pace” (e.g. X seconds per line or WPM) that **auto-advances** would be a **new feature**, not a missing part of the current design.

---

## 5. Recommendations

### 5.1 Fix mobile scroll and autoscroll reliability

1. **Scroll the container explicitly** instead of relying on `scrollIntoView`:
   - Use `scrollContainerRef` and the current line element.
   - Compute `lineTop` relative to container (e.g. `getBoundingClientRect`), then set `container.scrollTop` so the line aligns at the top (optionally account for padding).
   - Apply the same logic for both “smooth” and “auto” behavior (e.g. `behavior: 'smooth'` on the container if supported, or a small custom animation).
2. **Optional:** Add `overscroll-behavior: contain` to the scroll div to reduce scroll chaining on mobile.
3. **Optional:** Keep `scrollIntoView` as fallback only when the container is not scrollable or in rare edge cases; prefer the explicit `scrollTop` path everywhere else.

### 5.2 Paced walk-through (future)

If you want **auto-advance at a given pace**:

- **Design:** Define what “pace” means (e.g. seconds per line, or WPM with simple word-count). Decide whether it’s global or per-line (e.g. from script metadata). Decide how it interacts with Director pause/override and manual advance.
- **Implementation:** Use a timer (e.g. `setInterval` or `setTimeout` chain) that calls `handleAdvance` when the configured duration for the current line has elapsed, **only** when not paused and when Director hasn’t taken override. Integrate with `TimingIndicator` (e.g. drive countdown from the same pace) and add a UX control (e.g. “Enable auto-advance”, “Seconds per line” or “WPM”).
- **Sync:** Auto-advance would still go through `advancePerformance` like manual advance, so existing PartyKit sync and Director override remain unchanged.

---

## 6. References

- `src/components/teleprompter/teleprompter.tsx` – scroll effect, advance handlers, layout.
- `src/components/teleprompter/advance-control.tsx` – Advance/Pause/Resume UI.
- `src/components/teleprompter/timing-indicator.tsx` – elapsed/estimated/pacing display.
- `specs/001-skitso-platform/spec.md` – FR-6 Teleprompter (manual advance, Director override).
- [Mobile Safari, scrollIntoView doesn’t work](https://stackoverflow.com/questions/45098593/mobile-safari-scrollintoview-doesnt-work) – workaround: use `scrollTop` on the scroll container.
- [overflow not working on flex items](https://stackoverflow.com/questions/37442722/overflowscroll-not-working-on-flex-items) – add `min-height: 0` to flex + overflow-y-auto container (§1.1).
