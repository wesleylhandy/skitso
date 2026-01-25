# Gender Selection for Character Generation - Analysis & Recommendation

**Date:** 2026-01-24  
**Context:** MVP development, prioritizing flow and minimal disruption

## Current State

- Characters are AI-generated without explicit gender specification
- Participants are assigned characters automatically upon joining
- Director can pre-define characters by name and optional role (no gender field)
- Character generation prompt doesn't constrain gender
- Character data model has no gender field
- Character images are generated with visual appearance, but participants can play any role

## Analysis: Allow Gender Selection vs. Leave to AI

### Option 1: Leave Gender to AI (Recommended for MVP)

**Pros:**
- ✅ **Simpler UX** - No additional form fields or decisions
- ✅ **Faster flow** - Reduces decision fatigue, keeps momentum
- ✅ **More inclusive** - Allows for non-binary, fluid, or ambiguous character representation
- ✅ **Creative freedom** - AI can generate diverse characters without constraints
- ✅ **Performance-focused** - Participants play roles regardless of character appearance
- ✅ **No code changes** - Works with current implementation
- ✅ **Less validation** - No need to handle gender-related edge cases

**Cons:**
- ❌ **Less control** - Users can't specify gender preferences
- ❌ **Potential mismatch** - Character appearance might not match participant preferences
- ❌ **Image generation** - Generated images might imply gender that doesn't match participant

**Risk Assessment:**
- **Low risk** - Current system already works without gender specification
- **User feedback** - Can add later if users request it
- **MVP appropriate** - Aligns with "keep things flowing" goal

### Option 2: Allow Gender Selection

**Pros:**
- ✅ **User control** - Participants can specify preferences
- ✅ **Better matching** - Character appearance can align with preferences
- ✅ **Inclusivity** - Can support non-binary options explicitly

**Cons:**
- ❌ **Added complexity** - Requires UI changes, validation, prompt engineering
- ❌ **Slower flow** - Additional decision point in configuration
- ❌ **Potential awkwardness** - What if someone wants to play a different gender?
- ❌ **Stereotyping risk** - Could reinforce gender stereotypes if not handled carefully
- ❌ **Implementation cost** - Multiple files need changes:
  - Form UI (director-config-form.tsx)
  - Data models (session.ts, session-config-schema.ts)
  - Character generation prompt template
  - Image generation prompt
  - Validation logic
  - Character assignment logic

**Risk Assessment:**
- **Medium risk** - Adds complexity and potential friction
- **MVP disruption** - Requires significant changes across multiple systems
- **User research needed** - Should validate if this is actually desired

## Recommendation: Leave to AI for MVP

**Decision:** Do not add gender selection in MVP. Leave character gender to AI generation.

**Rationale:**
1. **MVP Focus** - Goal is to "prevent too much disruption and keep things flowing"
2. **Performance Context** - Participants are playing theatrical roles, not representing themselves
3. **Inclusive by Default** - Not specifying gender allows for more fluid representation
4. **Iterative Improvement** - Can add based on user feedback post-MVP
5. **Technical Simplicity** - Current system works without this feature

## Implementation Plan (If Needed Post-MVP)

If user feedback indicates gender selection is desired, here's a phased approach:

### Phase 1: Optional Director Preference (Low Impact)
- Add optional "character diversity preference" to Director's Desk
- Options: "Balanced", "Any", "Specify per character"
- Only affects AI generation hints, not hard constraints
- **Impact:** Minimal UI change, no participant-level selection

### Phase 2: Participant Preferences (If Phase 1 Shows Demand)
- Add optional gender preference when participants join
- Use as soft constraint in character assignment (prefer but don't require)
- **Impact:** Moderate UI change, assignment logic update

### Phase 3: Explicit Character Gender (If Needed)
- Add gender field to Character model
- Update prompts to respect gender constraints
- **Impact:** Significant changes across generation pipeline

## Alternative: Gender-Neutral Approach

Instead of gender selection, consider:
- **Character archetypes** - Focus on personality/role rather than gender
- **Visual style preferences** - "Masculine", "Feminine", "Androgynous", "Any" (if needed)
- **No specification** - Let AI generate diverse characters naturally

This maintains inclusivity while allowing some control if needed.

## Conclusion

For MVP: **Leave gender to AI**. This keeps the flow simple, maintains inclusivity, and allows for iterative improvement based on real user feedback. The current system already supports diverse character generation without explicit gender constraints.

If users request gender selection post-MVP, implement Phase 1 first (optional director preference) to gauge demand before adding participant-level controls.
