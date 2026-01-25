# AI Prompt Architecture

## Decision: Three Separate Prompts

**Recommendation:** Use **three separate prompts** for character generation, script generation, and character image generation.

### Why Two Prompts?

1. **Workflow Alignment**: Characters must be generated and assigned to Actors before script generation
   - Characters are assigned immediately when Actors join (Casting Couch phase)
   - Script generation happens after characters are assigned
   - Script needs to reference specific character names and attributes

2. **Director Control**: Allows Director to review and override character assignments before script generation
   - Director can see generated characters in Casting Couch
   - Director can override assignments or pre-define characters
   - Script generation uses the final character assignments

3. **Architecture Consistency**: Matches the planned API endpoint structure
   - `/api/openai/characters` - Character generation endpoint (T047)
   - `/api/openai/script` - Script generation endpoint (T048)
   - `/api/openai/character-image` - Character image generation endpoint (T049)
   - Separate concerns, separate prompts

4. **Better Script Quality**: Script can reference specific character details
   - Uses actual character names from assigned characters
   - Incorporates character attributes and hidden motivations
   - Creates dialogue that reflects each character's personality

5. **Error Handling**: Easier to retry individual steps
   - If character generation fails, retry without regenerating script
   - If script generation fails, characters are already created
   - Better user experience with partial success

## Workflow

```
1. Director Configures Session
   ↓
2. Generate Characters (Character Generation Prompt)
   → Characters stored in castAtom
   → Basic image prompts included in character data
   ↓
3. Generate Character Images (Character Image Generation Prompt)
   → Images generated for each character
   → Images stored in character visualRepresentation
   → Characters displayed in Casting Couch with visuals
   ↓
4. Director Reviews/Overrides Characters (Optional)
   → Director can modify assignments
   ↓
5. Actors Join Session
   → Characters assigned from pool
   → Character assignments visible to all
   ↓
6. Generate Script (Script Generation Prompt)
   → Script references specific assigned characters
   → Script stored in currentScriptAtom
   ↓
7. Performance Begins
```

## Prompt Files

- **Character Generation**: `character-generation-prompt.md`
  - Generates character archetypes with attributes, motivations, and basic image prompts
  - Input: VibeContext, participant count, optional Director-defined characters
  - Output: Array of character objects with basic image prompts

- **Character Image Generation**: `character-image-generation-prompt.md`
  - Generates optimized gpt-image-1.5 prompts or directly creates character visual representations
  - Input: Character object, VibeContext, optional existing image prompt
  - Output: Optimized gpt-image-1.5 prompt and/or image URL
  - Model: gpt-image-1.5 (or GPT to generate gpt-image-1.5 prompt)

- **Script Generation**: `script-generation-prompt.md`
  - Generates complete skit with dialogue, stage directions, and sound cues
  - Input: VibeContext, theme, tone, characters (already generated), scene count, chaos level
  - Output: Structured script JSON

## Integration Points

### Character Generation Prompt
- **Used in**: `/api/openai/characters` route handler (T047)
- **Called from**: Director's Desk after configuration submission (T068)
- **Stores result in**: `castAtom` (T065)
- **VibeContext integration**: Character naming, archetype labels, personality traits, art style

### Character Image Generation Prompt
- **Used in**: `/api/openai/character-image` route handler (T049)
- **Called from**: Director's Desk after character generation (parallel with script generation)
- **Stores result in**: Character `visualRepresentation` object in `castAtom`
- **VibeContext integration**: Art style directives (neon glitch, film grain, etc.), color palettes, visual effects
- **Character integration**: Uses character traits, attributes, and archetype to inform visual design

### Script Generation Prompt
- **Used in**: `/api/openai/script` route handler (T048)
- **Called from**: Director's Desk after character generation (T069)
- **Stores result in**: `currentScriptAtom` (T066)
- **VibeContext integration**: Dialogue tone, slang density, pacing, stage direction energy
- **Character integration**: References specific character names, attributes, and motivations

## VibeContext Integration

All three prompts must include VibeContext constraints:

1. **Character Generation**:
   - Naming conventions (modern slang vs. classic names)
   - Archetype terminology ("The Main Character" vs. "The Protagonist")
   - Personality trait style (chaotic vs. refined)
   - Basic art style directives for initial image prompts

2. **Character Image Generation**:
   - Art style directives (neon glitch, film grain, TV studio, chaos aesthetic, minimalist)
   - Color palettes (vibrant neon, muted cinematic, bright clean, clashing chaos, neutral professional)
   - Visual effects (digital artifacts, film grain, clean lines, exaggerated features, minimal effects)
   - Lighting styles (harsh neon, natural soft, bright studio, dramatic chaos, even professional)
   - Composition and mood (dynamic/energetic, contemplative, friendly, absurd, professional)

3. **Script Generation**:
   - Dialogue tone and language style
   - Slang usage (for VIRAL_NEON)
   - Stage direction energy level
   - Sound cue style
   - Pacing and timing

## Error Handling

All prompts should implement:
- Automatic retry with simplified prompts on failure
- Vibe-appropriate error messages
- Rate limiting (10 requests/user/hour)
- Response validation with Zod schemas

**Image Generation Specific:**
- If gpt-image-1.5 generation fails, retry with simplified prompt (remove style-specific terms)
- Fallback to basic character description if multiple retries fail
- Consider caching generated images for same character + vibe combinations

## Testing Considerations

- Test character generation with different VibeContexts
- Test character image generation with different VibeContexts and character types
- Verify image style matches VibeContext aesthetic (visual inspection)
- Test script generation with pre-generated characters
- Verify character-to-script integration (names match, attributes reflected)
- Test with Director-defined characters
- Test with different chaos levels and scene counts
- Test image generation error handling and retry logic
- Verify image prompts are under 400 characters (gpt-image-1.5 limit)
