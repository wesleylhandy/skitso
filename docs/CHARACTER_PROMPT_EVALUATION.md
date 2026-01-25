# Character Generation Prompt — Evaluation

**Scope:** `specs/001-skitso-platform/prompts/character-generation-prompt.md` and runtime usage in `src/lib/openai/prompts/character-prompt.ts`, `src/app/api/openai/characters/route.ts`.

**Observed issue:** Personality traits are returned as **full sentences** (e.g. "She tends to be very outgoing and loves attention") instead of **short phrases**; the expectation of **traits with ratings 1–100** maps to **attributes** in the spec, which are a separate field.

---

## 1. Clarification: Traits vs Attributes

| Field | Spec format | Purpose | Ratings? |
|-------|-------------|---------|----------|
| **personalityTraits** | `string[]` | Short labels, e.g. "Extremely confident", "Trend-obsessed" | No |
| **attributes** | `Array<{name: string, rating: number}>` | Dimensions like "Confidence", "Chaos Level" | Yes, 1–100 |

- **"Traits with a rating out of 100"** → **attributes** (name + rating).
- **"Sentences"** → **personalityTraits** drifting into prose.

Both can be problematic: traits as sentences, and/or attributes under-produced or confused with traits.

---

## 2. Strengths of the Current Prompt

- **Clear JSON schema**  
  Exact structure with `characters[]`, `personalityTraits`, `attributes`, etc. Reduces format hallucination.

- **Concrete expected-output example**  
  Full `Expected Output` shows short traits ("Extremely confident", "Trend-obsessed", "Impulsive") and attributes with 1–100 ratings. Good few-shot signal.

- **Explicit attribute rules**  
  "3–5 attributes", "rating 1–100", "vibe-appropriate names" are stated. Same cues exist in the schema and example.

- **Vibe-specific guidance**  
  Archetypes, naming, and trait style (chaotic, refined, etc.) are specified per vibe, which helps consistency.

- **Safety and injection rules**  
  Director-provided data (theme, tone, `directorDefinedCharacters`) is boxed and explicitly untrusted. Reduces override attempts.

- **Single, focused role**  
  "Professional character designer for theatrical performances" sets a clear frame.

- **`response_format: { type: 'json_object' }`**  
  Enforces JSON and avoids markdown-wrapped output.

---

## 3. Weaknesses and Root Causes

### 3.1 **No explicit "Personality Trait Format" rules**

- **Attribute Guidelines** exist; there is **no** equivalent **Personality Trait Guidelines** section.
- The prompt never states that traits must be **short phrases (e.g. 2–4 words)** or **must not be full sentences**.
- "Personality traits" in natural language often suggests descriptive prose; the model can reasonably produce sentences unless told otherwise.

**Effect:** Traits drift into sentences despite the example.

### 3.2 **Traits vs attributes under-specified**

- The split between **traits** (labels, no numbers) and **attributes** (name + 1–100) is implied by the schema and example but never clearly explained in prose.
- Without that distinction, the model may:
  - Use sentences for "personality" and under-use attributes, or
  - Mix formats (e.g. put descriptive sentences in `personalityTraits`).

**Effect:** Confusion between traits and attributes; traits as sentences.

### 3.3 **Examples only; no negative examples**

- The prompt shows only **positive** examples (correct traits and attributes).
- There is no "Do NOT" guidance such as:  
  - Do NOT use full sentences for `personalityTraits`.  
  - Do NOT put ratings or dimensions in `personalityTraits`; use `attributes` for that.

**Effect:** Model has no explicit anti-patterns to avoid.

### 3.4 **Vibe lines don’t constrain format**

- Lines like "chaotic personality traits", "refined personality traits" describe **style**, not **format**.
- They don’t reinforce "short phrases" or "no sentences."

**Effect:** Format compliance relies entirely on the single expected-output example.

### 3.5 **Minimal user message**

- User message: `Generate ${participantCount} characters for ${vibeContext} style.`
- It doesn’t restate output rules (traits = short phrases, attributes = name + 1–100). All constraints live in the system prompt.

**Effect:** Slight risk that a long system prompt dilutes format constraints; user message doesn’t reinforce them.

### 3.6 **Retry fallback is much weaker**

- On retry, the route uses `generateSimplifiedCharacterPrompt`:  
  `"personalityTraits (array), ... attributes (array with name and rating 1-100)"`.
- No examples, no trait-vs-attribute distinction, no "short phrases only."

**Effect:** Retries are more likely to produce sentence-like traits and looser attribute format.

---

## 4. Summary Table

| Aspect | Strength | Weakness |
|--------|----------|----------|
| JSON schema | Clear, complete | — |
| Attributes | Explicit rules + examples | — |
| Personality traits | Good examples | No format rules; no "no sentences" |
| Traits vs attributes | — | Distinction not stated in prose |
| Negative examples | — | None |
| Vibe-specific | Helpful for style | Don’t reinforce trait format |
| Safety | Strong | — |
| Retry prompt | — | Too vague on traits/attributes |

---

## 5. Recommendations

1. **Add a "Personality Trait Guidelines" section** (mirroring Attribute Guidelines):
   - Each trait: **short phrase** (e.g. 2–4 words).
   - **Do NOT** use full sentences or clauses.
   - Examples: "Extremely confident", "Trend-obsessed", "Impulsive".
   - Anti-examples: "She is very outgoing and loves attention", "Tends to speak before thinking."

2. **Clarify traits vs attributes in one short bullet list:**
   - `personalityTraits`: brief **labels** only; no numbers, no sentences.
   - `attributes`: **dimensions** with `name` and `rating` 1–100.

3. **Add 1–2 negative examples** for `personalityTraits` in the "Important" or guideline section, with a single "Do NOT" line.

4. **Optionally tighten the user message** to reinforce format, e.g.:  
   `Generate ${participantCount} characters for ${vibeContext}. Use short trait phrases (no sentences) and attributes with ratings 1–100.`

5. **Harden the retry prompt** so it still states:
   - Traits = short phrases, not sentences.
   - Attributes = `{name, rating}` with rating 1–100.
   - Optionally include a minimal one-character example.

6. **Fix Character Dossier attribute display**  
   Currently attributes are shown as `{attr.rating}/10` in `character-dossier.tsx` (line 184). The spec uses 1–100. Use `{attr.rating}/100` (or an equivalent scale) so "traits with a rating out of 100" is correctly reflected in the UI.

---

## 6. Related Files

- Prompt template: `src/lib/openai/prompts/templates/character-generation-prompt.md`
- Prompt builder: `src/lib/openai/prompts/character-prompt.ts`
- API route (incl. retry): `src/app/api/openai/characters/route.ts`
- Character Dossier (attribute display): `src/components/actor/character-dossier.tsx`
