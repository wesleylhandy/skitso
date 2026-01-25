# Data URL to HTTP URL Conversion Implementation

## Overview

Converted all data URLs to HTTP URLs throughout the system to fix WebSocket message size issues and ensure consistent image handling on both director's page and join page.

## Changes Made

### 1. PartyKit Server (`parties/session.ts`)

**Added Helper Functions:**
- `getCharacterImageHttpUrl()` - Generates HTTP endpoint URL: `/parties/main/{sessionId}/image/{characterId}`
- `convertImageUrlToHttp()` - Converts data URLs to HTTP URLs, preserves existing HTTP URLs
- `convertCastToHttpUrls()` - Converts all data URLs in cast array to HTTP URLs

**Updated Storage:**
- Still stores data URLs in `cast:image:${characterId}` keys (for HTTP endpoint to serve)
- But converts cast array to use HTTP URLs before storing/broadcasting

**Updated Broadcasts:**
- All `cast:updated` broadcasts now use HTTP URLs instead of data URLs
- State recovery (`state:recovered`) now sends HTTP URLs instead of data URLs

**Key Changes:**
```typescript
// Before: Stripped image URLs
const castForBroadcast = cast.map((char) => ({
  ...char,
  visualRepresentation: { ...char.visualRepresentation, imageUrl: undefined }
}));

// After: Convert data URLs to HTTP URLs
const castForBroadcast = convertCastToHttpUrls(sessionId, cast);
```

### 2. Director Desk (`src/app/director-desk/page.tsx`)

**Updated Cast Update Handler:**
- No longer preserves data URLs from generation
- Uses HTTP URLs from PartyKit (which are now HTTP URLs)
- Converts any remaining data URLs to HTTP URLs as fallback

**Key Changes:**
```typescript
// Before: Preserved data URLs
const imageUrl = existingImageUrl && existingImageUrl.startsWith('data:')
  ? existingImageUrl
  : getCharacterImageUrl(data.sessionId, char.id);

// After: Always use HTTP URLs
const finalImageUrl = imageUrl.startsWith('data:')
  ? getCharacterImageUrl(data.sessionId, char.id)
  : imageUrl;
```

### 3. Join Page (`src/app/join/[sessionCode]/page.tsx`)

**Updated State Recovery:**
- Converts any data URLs to HTTP URLs
- Uses HTTP URLs from PartyKit (which are now HTTP URLs)
- Added logging for image URL conversion

**Updated Cast Updates:**
- Converts any data URLs to HTTP URLs
- Ensures all image URLs are HTTP URLs

**Key Changes:**
```typescript
// Before: Kept data URLs if present
const httpImageUrl = existingImageUrl && existingImageUrl.startsWith('data:')
  ? existingImageUrl
  : getCharacterImageUrl(sessionId, char.id);

// After: Convert data URLs to HTTP URLs
const finalImageUrl = httpImageUrl.startsWith('data:')
  ? getCharacterImageUrl(sessionId, char.id)
  : httpImageUrl;
```

### 4. Director Config Form (`src/components/director/director-config-form.tsx`)

**No Changes Needed:**
- Still receives data URLs from image generation API
- Stores data URLs locally in cast atom
- When syncing to PartyKit, PartyKit converts them to HTTP URLs
- PartyKit broadcasts back with HTTP URLs, which director desk uses

## Flow

### Image Generation → Storage → Broadcast

1. **Image Generated** (`/api/openai/character-image`):
   - Returns data URL: `data:image/png;base64,...`

2. **Director Config Form**:
   - Stores data URL in local cast atom
   - Syncs to PartyKit with data URL

3. **PartyKit Receives Cast**:
   - Stores data URL in `cast:image:${characterId}` (for HTTP endpoint)
   - Converts cast array to use HTTP URLs: `/parties/main/{sessionId}/image/{characterId}`
   - Stores cast with HTTP URLs
   - Broadcasts cast with HTTP URLs

4. **Clients Receive Updates**:
   - Director desk: Gets HTTP URLs from PartyKit
   - Join page: Gets HTTP URLs from PartyKit
   - Both use HTTP URLs consistently

5. **HTTP Endpoint Serves Images**:
   - Reads data URL from `cast:image:${characterId}`
   - Converts data URL to binary
   - Serves as binary with proper MIME type

## Benefits

1. **WebSocket Message Size**: HTTP URLs are ~50 bytes vs 100KB+ for data URLs
2. **Consistency**: All clients use HTTP URLs, no mixing of data URLs and HTTP URLs
3. **Performance**: Smaller WebSocket messages, faster synchronization
4. **Reliability**: No WebSocket size limit issues

## Testing

1. **Generate Characters**: Images should generate as data URLs
2. **Check Director Desk**: Should see HTTP URLs in cast
3. **Check Join Page**: Should see HTTP URLs in cast
4. **Verify Images Load**: HTTP endpoint should serve images correctly
5. **Check WebSocket Messages**: Should be small (< 1KB per cast update)

## Migration Notes

- Existing sessions with data URLs in storage will continue to work
- HTTP endpoint will serve data URLs from storage
- New cast updates will use HTTP URLs
- No breaking changes - backward compatible
