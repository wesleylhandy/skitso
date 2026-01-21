# OpenAI Integration

This directory contains the OpenAI API integration for AI-powered content generation.

## Configuration

### Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key (get from https://platform.openai.com/api-keys)

Optional (model overrides):
- `OPENAI_MODEL_CHARACTER` - Model for character generation (default: `gpt-5-mini`)
- `OPENAI_MODEL_SCRIPT` - Model for script generation (default: `gpt-5-mini`)
- `OPENAI_MODEL_IMAGE_PROMPT` - Model for image prompt generation (default: `gpt-5-mini`)

### Model Selection

**Spec Requirements:**
- Spec mentions `gpt-5-mini` (future model, not yet available)
- Research recommends `gpt-4o` for better quality/style adherence
- Current implementation uses `gpt-5-mini` for cost-effectiveness

**To use better quality models:**
```bash
# In .env.local
OPENAI_MODEL_CHARACTER=gpt-4o
OPENAI_MODEL_SCRIPT=gpt-4o
OPENAI_MODEL_IMAGE_PROMPT=gpt-4o
```

## API Usage

### Current Implementation

We're using **OpenAI SDK v6.x** with the **Chat Completions API**:
- ✅ Latest SDK version (v6.16.0)
- ✅ Standard `chat.completions.create()` syntax
- ✅ Proper TypeScript types
- ✅ JSON mode for structured outputs
- ✅ Error handling and retry logic

### API Syntax

```typescript
const openai = createOpenAIClient();

const completion = await openai.chat.completions.create({
  model: getModel('CHARACTER_GENERATION'),
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.8,
});
```

### Note on Responses API

OpenAI introduced a new Responses API in 2025 (`/v1/responses`), but:
- Chat Completions API is still fully supported
- Chat Completions is more widely used and documented
- Our implementation uses Chat Completions for compatibility and stability

## Files

- `client.ts` - OpenAI client initialization (reads from `process.env.OPENAI_API_KEY`)
- `models.ts` - Model configuration (centralized, environment-configurable)
- `rate-limiter.ts` - Rate limiting (10 requests/user/hour)
- `prompts/` - Prompt template system (loads from markdown files)

## Rate Limiting

- **Limit**: 10 requests per user per hour
- **Storage**: localStorage (browser) or in-memory (server)
- **User ID**: From `x-user-id` header or 'anonymous'

## Error Handling

All API routes include:
- Input validation (Zod schemas)
- Rate limiting checks
- Retry logic with simplified prompts
- Response validation
- Proper error messages
