# Prompt Template System

This directory contains the prompt generation system that loads markdown templates and performs variable substitution.

## Architecture

### Template Files (Source of Truth)
- **Location**: `specs/001-skitso-platform/prompts/*.md`
- **Format**: Markdown files with `{{variable}}` placeholders
- **Section**: System prompts are extracted from the "## System Prompt" section

### Template Engine
- **File**: `template-engine.ts`
- **Purpose**: Reads markdown files and performs variable substitution
- **Syntax**: `{{variableName}}` for simple replacements

### Prompt Generators
- `character-prompt.ts` - Generates character generation prompts
- `script-prompt.ts` - Generates script generation prompts  
- `image-prompt.ts` - Generates image generation prompts

## Usage

```typescript
import { generateCharacterPrompt } from './character-prompt';

const prompt = generateCharacterPrompt({
  vibeContext: 'VIRAL_NEON',
  participantCount: 3,
  theme: 'A group of friends trying to go viral',
  tone: 'comedic',
});
```

## Benefits

1. **Maintainability**: Prompts are in markdown, easy to read and edit
2. **Separation of Concerns**: Prompt content separated from code logic
3. **Version Control**: Changes to prompts are clearly visible in git diffs
4. **Non-Developer Friendly**: Content writers can edit prompts without touching code
5. **Documentation**: Markdown files serve as documentation

## Template Variables

Variables use `{{variableName}}` syntax:
- Simple values: `{{vibeContext}}`, `{{participantCount}}`
- Complex values (arrays/objects) are JSON stringified automatically

## Adding New Variables

1. Add `{{variableName}}` to the markdown template
2. Include the variable in the context object when calling `loadPromptTemplate()`
3. The template engine will automatically substitute it

## Example Template

```markdown
## System Prompt

Play the role of a professional character designer. 
I will provide you with {{vibeContext}} and {{participantCount}} characters.

Generate characters that match the {{vibeContext}} style.
```

## Future Enhancements

- Conditional sections (e.g., `{{#if VIRAL_NEON}}...{{/if}}`)
- Loops for arrays
- Helper functions for formatting
- Template inheritance/composition
