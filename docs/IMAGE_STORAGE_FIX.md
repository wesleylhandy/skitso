# Character Image Storage Fix

## Problem

Character images were not being stored properly in PartyKit storage, causing 404 errors when clients tried to fetch images via the HTTP endpoint (`/parties/main/{sessionId}/image/{characterId}`).

### Root Cause

The image storage logic in `handleCastUpdate` had a critical flaw:

1. **Only stored data URLs** in the `originalDataUrls` map (line 758-763)
2. **Only stored external HTTP URLs** separately (line 891-916)
3. **Didn't store images** if:
   - The incoming cast had HTTP endpoint URLs (already converted placeholders)
   - The incoming cast had external HTTP URLs but they weren't properly captured
   - The logic missed edge cases where images should be preserved

### Symptoms

- Images generated successfully (either as data URLs or external HTTP URLs from DALL-E)
- Cast updates sent to PartyKit
- Images not found in storage when HTTP endpoint tried to serve them
- 404 errors: `Image not found in storage` with `hasImageUrl: false`

## Solution

Refactored the image storage logic to:

1. **Track ALL images** (data URLs and external HTTP URLs) in a single `imagesToStore` map
2. **Store images** if they are:
   - Data URLs (need to be served as binary via HTTP endpoint)
   - External HTTP URLs (need to be redirected via HTTP endpoint)
   - NOT endpoint URLs (endpoint URLs are placeholders, not actual images)
3. **Preserve existing images** from storage if incoming cast doesn't have images
4. **Unified storage** - all images stored in one pass instead of separate logic for data URLs and HTTP URLs

### Changes Made

**File**: `parties/session.ts`

1. **Replaced `originalDataUrls` map with `imagesToStore` map** that captures all image types
2. **Improved image detection logic** to identify data URLs, external HTTP URLs, and endpoint URLs
3. **Unified storage promises** - single array of promises instead of separate arrays
4. **Better logging** - includes image type (data-url, external-http-url) in logs

### Code Flow

```
Incoming Cast Update
  ↓
Load existing images from storage
  ↓
Merge incoming cast with existing images
  ↓
Identify images to store:
  - Data URLs from incoming cast
  - External HTTP URLs from incoming cast  
  - Existing images if incoming doesn't have them
  ↓
Store all images in cast:image:{characterId} keys
  ↓
Convert cast to use HTTP endpoint URLs for broadcast
  ↓
Save cast and broadcast update
```

## Testing

To verify the fix works:

1. **Generate characters with images** (both data URLs and external HTTP URLs)
2. **Check PartyKit logs** for:
   - `[PartyKit Server] Storing image:` messages
   - `[PartyKit Server] Stored image successfully:` messages
   - Image type should be logged (data-url or external-http-url)
3. **Request image via HTTP endpoint**: `GET /parties/main/{sessionId}/image/{characterId}`
4. **Verify**:
   - Data URLs are served as binary images
   - External HTTP URLs redirect to the external URL
   - No 404 errors

## Related Files

- `parties/session.ts` - Main fix location
- `src/app/api/openai/character-image/route.ts` - Image generation API
- `src/components/director/director-config-form.tsx` - Cast update client code

## Notes

- **Endpoint URLs** (`/parties/main/{sessionId}/image/{characterId}`) are placeholders and should NOT be stored
- **External HTTP URLs** (from DALL-E) are stored and redirected via the HTTP endpoint
- **Data URLs** (from GPT-image models) are stored and converted to binary for serving
- **Existing images** are preserved if incoming cast doesn't have images (prevents data loss)
