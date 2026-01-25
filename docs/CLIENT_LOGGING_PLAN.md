# Client Logging Implementation Plan

## Overview

Create a centralized, safe logging system for client-side code that:
- Provides log levels (debug, info, warn, error, critical)
- Shows full logs in development for debugging
- **Production logging is for exception handling only** - errors and critical issues
- Automatically sanitizes sensitive data - **never exposes sensitive information**
- Designed for future Sentry integration (planned, not implemented initially)

## Goals

1. **Security**: Never log sensitive data (session codes, participant IDs, tokens, API keys, etc.) in production - sanitization must be comprehensive and fail-safe
2. **Developer Experience**: Full visibility in development for debugging
3. **Production Exception Handling**: Production logging focused on exception handling - only `error` and `critical` levels
4. **Type Safety**: TypeScript strict mode compatible
5. **Migration Path**: Easy to replace existing console statements
6. **Future-Ready**: Architecture supports Sentry integration when ready

## Log Levels

| Level | Development | Production | Use Case |
|-------|-------------|------------|----------|
| `debug` | ✅ Full | ❌ None | Detailed debugging, state dumps, verbose tracing |
| `info` | ✅ Full | ❌ None | General information, flow tracking, non-critical events |
| `warn` | ✅ Full | ❌ None | Recoverable issues, deprecations, fallbacks (dev only) |
| `error` | ✅ Full | ✅ Sanitized | **Exception handling** - Errors that don't crash the app, validation failures |
| `critical` | ✅ Full | ✅ Sanitized | **Exception handling** - Critical errors, security issues, unrecoverable failures |

**Production Logging Philosophy**: Production client-side logging is **exclusively for exception handling**. Only `error` and `critical` levels are logged in production, and all data is sanitized to prevent sensitive information exposure.

## Implementation

### 1. Create Logger Utility (`src/lib/utils/logger.ts`)

**Features:**
- Environment-aware (dev vs production)
- **Comprehensive sensitive data sanitization** - fail-safe, never exposes sensitive data
- Type-safe API
- Contextual logging (component/feature tags)
- **Architecture ready for Sentry integration** (planned for future, not implemented initially)

**API Design:**
```typescript
logger.debug(message, data?, context?)
logger.info(message, data?, context?)
logger.warn(message, data?, context?)
logger.error(message, data?, context?)
logger.critical(message, data?, context?)
```

### 2. Sensitive Data Sanitization

**CRITICAL**: Sanitization must be comprehensive and fail-safe. Never expose sensitive data in production logs.

**Patterns to sanitize:**
- Session codes (`sessionCode`, `sessionId`, `code`)
- Participant IDs (`participantId`, `id`, `userId`, `actorId`)
- Room IDs (`room`, `roomId`)
- Host URLs (partial masking or full redaction)
- Any object keys containing: `token`, `key`, `secret`, `password`, `auth`, `api`, `credential`
- Full error objects (extract safe properties only: `message`, `code`, `name` - never stack traces in production)
- Network request/response data
- LocalStorage contents
- Any nested objects containing sensitive keys

**Sanitization Strategy:**
- **Development**: Log full data with `[SENSITIVE]` markers for awareness
- **Production**: 
  - Replace sensitive values with `[REDACTED]` 
  - Remove sensitive keys entirely from logged objects
  - Deep sanitization of nested objects
  - Fail-safe: If sanitization fails, log nothing rather than risk exposure
  - Never log stack traces, only error messages and codes

### 3. Context Tags

Add contextual tags for filtering:
- `[PartyKit]` - WebSocket/PartyKit related
- `[JoinPage]` - Join page specific
- `[DirectorDesk]` - Director interface
- `[CharacterCard]` - Character components
- `[CastingCouch]` - Casting interface

### 4. Future Sentry Integration (Planned)

**Status**: Planned for future implementation, not included in initial version.

**Design Considerations:**
- Logger architecture will support Sentry integration via adapter pattern
- When implemented, Sentry will only receive:
  - Sanitized error messages (no sensitive data)
  - Error codes and types
  - Stack traces (sanitized, no file paths with sensitive data)
  - Context tags (component/feature names)
  - User-friendly error messages (not technical details)
- **Never send to Sentry**: Session codes, participant IDs, tokens, API keys, full error objects, request/response bodies
- Integration point will be in `logger.error()` and `logger.critical()` methods
- Configuration via environment variable: `NEXT_PUBLIC_SENTRY_DSN` (when ready)

## Migration Strategy

### Phase 1: Create Logger
1. Create `src/lib/utils/logger.ts`
2. Add tests for sanitization and level filtering
3. Document usage patterns

### Phase 2: Migrate High-Risk Areas
Priority order:
1. PartyKit client (`src/lib/partykit/client.ts`) - Contains connection details
2. Join page (`src/app/join/[sessionCode]/page.tsx`) - Contains session/participant IDs
3. Director components - Contains session state
4. API routes (if client-side) - May contain sensitive data

### Phase 3: Migrate Remaining Code
- Replace all `console.log` → `logger.debug` or `logger.info`
- Replace all `console.warn` → `logger.warn`
- Replace all `console.error` → `logger.error`
- Add ESLint rule to prevent new `console.*` statements

## File Structure

```
src/lib/utils/
  logger.ts              # Main logger implementation
  logger.test.ts         # Unit tests
  logger-config.ts       # Configuration (sanitization patterns, etc.)
```

## Configuration

### Environment Variables

Add to `.env.example`:
```bash
# Logging Configuration
NEXT_PUBLIC_LOG_LEVEL=debug  # debug, info, warn, error, critical (dev only)
NEXT_PUBLIC_ENABLE_REMOTE_LOGGING=false  # Enable remote error reporting
```

### Runtime Configuration

- Use `process.env.NODE_ENV` to determine environment
- Use `NEXT_PUBLIC_LOG_LEVEL` for development log level override
- **Production always uses `error` minimum level** (exception handling only)
- Production logging is disabled for `debug`, `info`, and `warn` levels

## Example Usage

### Before (Current)
```typescript
console.log('[PartyKit] Initializing connection', {
  host,
  room,
  party: 'main',
  environment: process.env.NODE_ENV,
});
```

### After (With Logger)
```typescript
import { logger } from '@/lib/utils/logger';

logger.debug('[PartyKit] Initializing connection', {
  host,  // Will be sanitized in production
  room,  // Will be sanitized in production
  party: 'main',
  environment: process.env.NODE_ENV,
}, { context: 'PartyKit' });
```

### Error Handling
```typescript
// Before
console.error('Failed to connect:', error);

// After
logger.error('Failed to connect', { 
  message: error.message,
  code: error.code 
}, { context: 'PartyKit' });
// In production: Only logs message and code, not full error object
```

## Security Considerations

**CRITICAL**: Production logging must never expose sensitive data. Sanitization is fail-safe.

1. **No PII in Production**: Participant names, session codes, IDs, etc. are completely redacted
2. **Stack Traces**: Only in development, **never in production** (only error messages and codes)
3. **Error Objects**: Extract safe properties only (message, code, name) - never full error objects
4. **Network Logs**: Never log full request/response bodies in production
5. **Local Storage**: Never log localStorage contents
6. **Deep Sanitization**: Recursively sanitize nested objects and arrays
7. **Fail-Safe**: If sanitization fails or encounters unknown structure, log nothing rather than risk exposure
8. **Exception Handling Focus**: Production logs are for exception handling only, not debugging

## Testing Strategy

1. **Unit Tests**: Test sanitization, level filtering, context handling
2. **Integration Tests**: Verify production builds don't log debug/info
3. **Security Tests**: Verify sensitive data is never logged in production mode

## ESLint Rule

Add rule to prevent new console statements:
```json
{
  "rules": {
    "no-console": ["warn", { 
      "allow": [] 
    }]
  }
}
```

## Rollout Plan

1. **Week 1**: Create logger utility and tests
2. **Week 2**: Migrate high-risk areas (PartyKit, Join page)
3. **Week 3**: Migrate remaining components
4. **Week 4**: Add ESLint rule, verify production builds

## Implementation Notes

1. **Sentry Integration**: Planned for future, architecture will support it via adapter pattern
2. **Performance**: Production logging is minimal (error/critical only) and should have negligible performance impact
3. **User Feedback**: Critical errors should show user-friendly messages via UI, not just console logs
4. **Exception Handling**: Production logging is focused on exception handling - capturing errors for debugging production issues without exposing sensitive data

---

## Key Decisions Confirmed

✅ **Log Levels**: `debug`, `info`, `warn`, `error`, `critical` - approved  
✅ **Production Logging**: Exception handling only (`error` and `critical` levels)  
✅ **Sentry Integration**: Planned for future, architecture will support it  
✅ **Sanitization**: Comprehensive, fail-safe, never exposes sensitive data  
✅ **Migration Approach**: Phased rollout starting with high-risk areas  

## Ready for Implementation

This plan is approved and ready for implementation. The logger will:
- Provide full logging in development
- Only log exceptions (`error`/`critical`) in production
- Sanitize all sensitive data comprehensively
- Be architected for future Sentry integration
- Never expose sensitive information in production logs
