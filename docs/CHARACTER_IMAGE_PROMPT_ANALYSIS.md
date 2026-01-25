# Character Image Prompt Analysis

## Executive Summary

**Finding: The character image generation system does NOT fully utilize the complete character dossier.** Specifically, the `hiddenMotivation` field is excluded from the image generation prompt, despite being a key component of the character dossier generated earlier.

## Current Flow

### 1. Character Generation (Complete Dossier)

**Location:** `src/lib/openai/prompts/character-prompt.ts`  
**Template:** `src/lib/openai/prompts/templates/character-generation-prompt.md`

The character generation prompt creates a complete character dossier with:
- ✅ `name`: string
- ✅ `archetypeLabel`: string
- ✅ `personalityTraits`: string[]
- ✅ `hiddenMotivation`: string ⚠️ **KEY MISSING FIELD**
- ✅ `attributes`: Array<{name: string, rating: number}>
- ✅ `imagePrompt`: string (initial prompt)

**Example Output:**
```json
{
  "name": "Zayden",
  "archetypeLabel": "The Main Character",
  "personalityTraits": ["Extremely confident", "Trend-obsessed", "Impulsive"],
  "hiddenMotivation": "Desperately wants to prove they're not a one-hit wonder",
  "attributes": [
    {"name": "Confidence", "rating": 95},
    {"name": "Chaos Level", "rating": 88}
  ],
  "imagePrompt": "A confident Gen Z person with neon green hair..."
}
```

### 2. Image Generation API Call

**Location:** `src/components/director/director-config-form.tsx` (lines 122-129)

When calling the image generation API, only a **subset** of the character data is sent:

```typescript
body: JSON.stringify({
  character: {
    id: character.id,
    name: character.name,
    archetypeLabel: character.archetypeLabel,
    personalityTraits: character.personalityTraits,
    attributes: character.attributes,
    // ❌ hiddenMotivation is NOT included
  },
  vibeContext,
  optionalImagePrompt: character.visualRepresentation.imagePrompt,
})
```

**Missing Fields:**
- ❌ `hiddenMotivation` - Not sent to API
- ❌ Other Character type fields (id, sessionId, participantId, isLocked, dialogueLines, visualRepresentation) - Not needed for image generation

### 3. Image Generation API Validation

**Location:** `src/app/api/openai/character-image/route.ts` (lines 24-39)

The API route validates incoming requests with a Zod schema that **explicitly excludes** `hiddenMotivation`:

```typescript
const RequestSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    archetypeLabel: z.string(),
    personalityTraits: z.array(z.string()),
    attributes: z.array(
      z.object({
        name: z.string(),
        rating: z.number(),
      })
    ).optional(),
    // ❌ hiddenMotivation is NOT in the schema
  }),
  vibeContext: z.enum([...]),
  optionalImagePrompt: z.string().optional(),
});
```

**Impact:** Even if `hiddenMotivation` were sent, it would be stripped out during validation.

### 4. Image Prompt Template

**Location:** `src/lib/openai/prompts/templates/character-image-generation-prompt.md`

The template documents the expected character object format (line 29):

```markdown
- {{character}} will come in the form of an object: 
  `{name: string, archetypeLabel: string, personalityTraits: string[], 
    attributes: Array<{name: string, rating: number}>}`
```

**Template Guidelines (lines 84-87):**
- ✅ Incorporate character's personality traits into visual design
- ✅ Reflect archetype in visual presentation
- ✅ Use attribute ratings to inform visual details
- ✅ Character name can inform visual style
- ❌ **Does NOT mention using hiddenMotivation**

### 5. Image Prompt Generation Function

**Location:** `src/lib/openai/prompts/image-prompt.ts` (lines 32-35)

The function receives a full `Character` object and JSON stringifies it:

```typescript
const context: Record<string, string> = {
  vibeContext,
  character: formatTemplateValue(sanitizedCharacter), // JSON stringifies entire object
};
```

**However:** Since the API route validation strips out `hiddenMotivation` before it reaches this function, the JSON stringified character object will not contain it.

## Impact Analysis

### What's Included ✅

1. **Name** - Used to inform visual style (modern vs classic names)
2. **Archetype Label** - Used for visual positioning and prominence
3. **Personality Traits** - Used to inform visual design (e.g., confident = strong posture)
4. **Attributes** - Used to inform visual details (e.g., high confidence = direct eye contact)
5. **VibeContext** - Used for art style matching
6. **Optional Image Prompt** - Director-provided refinement

### What's Missing ❌

1. **Hidden Motivation** - This is a critical character element that could inform:
   - Visual expression (e.g., "desperately wants to prove..." = slightly anxious confidence)
   - Character depth and nuance
   - Subtle visual cues that reflect internal conflict
   - More sophisticated character representation

## Recommendations

### Option 1: Include Hidden Motivation (Recommended)

**Benefits:**
- Full character dossier utilization
- More nuanced and sophisticated character images
- Better alignment between character generation and image generation

**Changes Required:**

1. **Update API Request Schema** (`src/app/api/openai/character-image/route.ts`):
   ```typescript
   character: z.object({
     // ... existing fields
     hiddenMotivation: z.string(), // Add this
   }),
   ```

2. **Update API Call** (`src/components/director/director-config-form.tsx`):
   ```typescript
   character: {
     // ... existing fields
     hiddenMotivation: character.hiddenMotivation, // Add this
   },
   ```

3. **Update Image Prompt Template** (`character-image-generation-prompt.md`):
   - Update the variable format documentation to include `hiddenMotivation`
   - Add guidelines on how to use hidden motivation in visual design
   - Example: "Use hidden motivation to inform subtle visual cues (e.g., internal conflict reflected in expression)"

### Option 2: Explicitly Document Exclusion

If `hiddenMotivation` is intentionally excluded (e.g., to keep images simpler), document this decision:

- Add comment explaining why `hiddenMotivation` is excluded
- Update template documentation to clarify this is intentional
- Consider if this aligns with product goals

### Option 3: Make It Optional

Add `hiddenMotivation` as an optional field that enhances the prompt when present but doesn't break when absent.

## Code Locations Summary

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Character Generation | `src/lib/openai/prompts/character-prompt.ts` | 29-78 | ✅ Includes hiddenMotivation |
| Character Type | `src/state/types/session.ts` | 45-63 | ✅ Includes hiddenMotivation |
| Image API Call | `src/components/director/director-config-form.tsx` | 122-129 | ❌ Excludes hiddenMotivation |
| Image API Validation | `src/app/api/openai/character-image/route.ts` | 24-39 | ❌ Excludes hiddenMotivation |
| Image Prompt Template | `src/lib/openai/prompts/templates/character-image-generation-prompt.md` | 29 | ❌ Doesn't document hiddenMotivation |
| Image Prompt Function | `src/lib/openai/prompts/image-prompt.ts` | 32-35 | ⚠️ Would include it if passed |

## Conclusion

The character image generation system currently uses a **subset** of the character dossier, specifically excluding the `hiddenMotivation` field. This represents a missed opportunity to create more nuanced and sophisticated character visualizations that reflect the full depth of the character as designed.

**Recommendation:** Include `hiddenMotivation` in the image generation pipeline to fully utilize the character dossier and create more sophisticated character representations.
