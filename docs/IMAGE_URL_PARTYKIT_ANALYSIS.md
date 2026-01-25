# Image URL Preservation in PartyKit - Analysis & Solution

## Problem Statement

CharacterCard images (imageUrls) are not preserving between director desk and join pages, and are lost on state changes. The issue stems from PartyKit's storage limitations and how data URLs are handled.

## Root Cause Analysis

### 1. PartyKit Storage Limits
- **Per-value limit: 128 KiB (131,072 bytes)**
- **Per-key limit: 2,048 bytes**
- **No limit on number of keys** (can shard data across keys)

### 2. Data URL Size Constraints
- Base64-encoded 1024x1024 PNG images: **~100-200KB each**
- 5 characters × 200KB = **~1MB total** (exceeds 128 KiB limit by 8x)
- **Data URLs are NOT viable for PartyKit storage** when stored in cast array

### 3. Current Implementation Issues

#### Issue A: Images Stripped from Broadcasts
**Location**: `parties/session.ts:836-842`
```typescript
const castForBroadcast = cast.map((char) => ({
  ...char,
  visualRepresentation: {
    ...char.visualRepresentation,
    imageUrl: undefined, // Don't send data URLs via WebSocket (too large)
  },
}));
```
**Problem**: Images are intentionally stripped from WebSocket broadcasts to avoid message size limits (~576 bytes). This is correct, but clients never receive images via broadcasts.

#### Issue B: Separate Storage with Race Conditions
**Location**: `parties/session.ts:656-741`
- Images stored separately: `cast:image:${char.id}`
- Cast stored without images
- **Race condition**: State recovery may happen before images are fully stored
- **Missing await**: Image storage promises are awaited, but verification may fail

#### Issue C: State Recovery Image Loading
**Location**: `parties/session.ts:1574-1614`
- State recovery loads images separately
- **Problem**: If image storage fails or is incomplete, images are lost
- **Problem**: No retry mechanism for missing images

#### Issue D: Cast Updates Lose Images
**Location**: `parties/session.ts:606-863`
- When cast is updated, images are re-stored separately
- **Problem**: If a cast update happens before images are stored, images are lost
- **Problem**: No mechanism to preserve existing images during updates

## Solution Architecture

### Strategy: Separate Storage with Robust Recovery

1. **Store images separately** (already implemented, but needs fixes)
2. **Always load images during state recovery** (fix needed)
3. **Preserve images during cast updates** (fix needed)
4. **Add fallback mechanism** for missing images (new)

### Implementation Plan

#### Fix 1: Ensure Images Are Stored Before Cast
- **Current**: Images stored in parallel, but cast may be saved before images complete
- **Fix**: Ensure all image storage completes before saving cast
- **Location**: `parties/session.ts:686-741`

#### Fix 2: Preserve Existing Images During Updates
- **Current**: Cast updates may overwrite images
- **Fix**: Merge existing images from storage before updating cast
- **Location**: `parties/session.ts:606-863`

#### Fix 3: Robust State Recovery
- **Current**: Images loaded separately, but may fail silently
- **Fix**: Add error handling and retry logic
- **Location**: `parties/session.ts:1574-1614`

#### Fix 4: Client-Side Image Request API
- **New**: Add API endpoint to fetch individual character images
- **Purpose**: Fallback when images are missing from state recovery
- **Location**: New API route + client-side fetch

## Technical Constraints

### PartyKit Limitations
- ✅ **Can store**: Images separately per character (within 128 KiB each)
- ❌ **Cannot store**: Images in cast array (exceeds 128 KiB limit)
- ❌ **Cannot broadcast**: Images via WebSocket (message size limit)

### Data URL Viability
- ❌ **Not viable** for PartyKit storage in arrays
- ✅ **Viable** for separate storage (one per key, within 128 KiB)
- ✅ **Viable** for client-side display (no size limit)

## Recommended Approach

1. **Keep separate storage** (current approach is correct)
2. **Fix race conditions** (await all image storage before cast save)
3. **Preserve images on updates** (merge existing images)
4. **Add client-side fallback** (fetch images individually if missing)

## Alternative Approaches Considered

### Option A: External Image Storage (S3, Cloudinary, etc.)
- **Pros**: No size limits, better performance
- **Cons**: Additional infrastructure, cost, complexity
- **Verdict**: Overkill for current scale, but viable for future

### Option B: Compress Images Before Storage
- **Pros**: Fits within 128 KiB limit
- **Cons**: Quality loss, still may exceed limit for high-res images
- **Verdict**: Not recommended (quality degradation)

### Option C: Store Image URLs Instead of Data URLs
- **Pros**: Small size, fits in cast array
- **Cons**: Requires external storage (OpenAI URLs expire)
- **Verdict**: Not viable (OpenAI URLs are temporary)

## Conclusion

**Data URLs are NOT viable for PartyKit storage in arrays**, but **ARE viable for separate storage** (one per key). The current architecture is correct but needs fixes for:
1. Race condition handling
2. Image preservation during updates
3. Robust state recovery
4. Fallback mechanisms

The solution is to fix the implementation, not change the architecture.

## Implementation Fixes Applied

### Fix 1: Preserve Existing Images During Cast Updates
**Location**: `parties/session.ts:606-741`

**Problem**: When cast updates were received, existing images in storage were not preserved if the incoming cast didn't include image URLs.

**Solution**: 
- Load existing images from storage before processing cast update
- Merge incoming cast with existing images
- Preserve existing images for characters that don't have new images in the update
- Store all images (new + preserved) before saving cast

**Code Changes**:
```typescript
// Load existing images from storage
const existingCast = await this.room.storage.get<Character[]>('cast') || [];
const existingImages = new Map<string, string>();

// Load all existing images
for (const existingChar of existingCast) {
  const storageKey = `cast:image:${existingChar.id}`;
  const existingImage = await this.room.storage.get<string>(storageKey);
  if (existingImage) {
    existingImages.set(existingChar.id, existingImage);
  }
}

// Merge incoming cast with existing images
const castWithPreservedImages = cast.map((char) => {
  const incomingImageUrl = char.visualRepresentation?.imageUrl;
  const existingImageUrl = existingImages.get(char.id);
  const finalImageUrl = (incomingImageUrl && incomingImageUrl.length > 0) 
    ? incomingImageUrl 
    : existingImageUrl;
  // ... use finalImageUrl
});
```

### Fix 2: Robust State Recovery with Error Handling
**Location**: `parties/session.ts:1574-1614`

**Problem**: State recovery would fail silently if images couldn't be loaded, leaving characters without images.

**Solution**:
- Use `Promise.allSettled` instead of `Promise.all` to continue even if some images fail
- Log failures for debugging
- Return characters without images if loading fails (graceful degradation)
- Track success/failure counts for monitoring

**Code Changes**:
```typescript
// Use Promise.allSettled to handle failures gracefully
const castWithImagesResults = await Promise.allSettled(
  cast.map(async (char) => {
    try {
      const imageUrl = await this.room.storage.get<string>(`cast:image:${char.id}`);
      if (imageUrl && imageUrl.length > 0) {
        return { ...char, visualRepresentation: { ...char.visualRepresentation, imageUrl } };
      }
    } catch (err) {
      console.error('Failed to load image:', err);
    }
    return char; // Return without image on failure
  })
);

// Extract results and track failures
let imagesLoaded = 0;
let imagesFailed = 0;
// ... process results
```

### Fix 3: Improved Image Storage Verification
**Location**: `parties/session.ts:686-741`

**Problem**: Image storage verification was basic and didn't catch all failures.

**Solution**:
- Verify stored image length matches original
- Throw errors on verification failure (caught by Promise.allSettled)
- Better logging for debugging
- Track which images were preserved vs new

**Code Changes**:
```typescript
// Verify stored image
const stored = await this.room.storage.get<string>(storageKey);
if (!stored || stored.length !== imageUrl.length) {
  throw new Error(`Image storage verification failed for ${char.id}`);
}
```

## Testing Recommendations

1. **Test cast updates without images**: Update cast without image URLs, verify existing images are preserved
2. **Test state recovery**: Disconnect and reconnect, verify all images load
3. **Test partial image failures**: Simulate some images failing to store/load, verify graceful degradation
4. **Test race conditions**: Rapid cast updates, verify images aren't lost
5. **Monitor logs**: Check console logs for image storage/loading issues

## Monitoring

The following logs are now available for monitoring:
- `[PartyKit Server] Loaded existing image for preservation` - Images preserved during updates
- `[PartyKit Server] Image storage verified successfully` - Successful image storage
- `[PartyKit Server] Failed to load image for character` - Image loading failures
- `[PartyKit Server] Some images failed to store/load` - Summary of failures

## Final Solution: HTTP Endpoint for Images

### Problem: WebSocket Message Size Limit
Despite fixing storage and state recovery, images were still being sent via WebSocket in state recovery responses, causing:
```
Message is too large: 130916 > 576
```

### Solution: HTTP Endpoint + Stripped WebSocket Messages

**Architecture**:
1. **Store images in PartyKit storage** (separate keys, one per character)
2. **Strip images from ALL WebSocket messages** (state recovery, cast updates, broadcasts)
3. **Serve images via HTTP endpoint**: `/parties/main/{roomId}/image/{characterId}`
4. **Client fetches images via HTTP** after receiving cast updates

**Implementation**:

#### Server-Side (`parties/session.ts`)

1. **HTTP Image Endpoint** (lines ~1964-2030):
```typescript
// GET /parties/main/{roomId}/image/{characterId}
// Serves images from storage, converts data URLs to binary
```

2. **Strip Images from State Recovery** (line ~1791):
```typescript
const castWithoutImages = cast.map((char) => ({
  ...char,
  visualRepresentation: {
    ...char.visualRepresentation,
    imageUrl: undefined, // Strip data URLs
  },
}));
```

3. **Strip Images from Broadcasts** (already implemented, line ~836)

#### Client-Side

1. **Image URL Helper** (`src/lib/partykit/client.ts`):
```typescript
export function getCharacterImageUrl(sessionId: string, characterId: string): string {
  return `${host}/parties/main/${sessionId}/image/${characterId}`;
}
```

2. **Update Cast Handlers** (`src/app/join/[sessionCode]/page.tsx`, `src/app/director-desk/page.tsx`):
- Receive cast without images via WebSocket
- Generate HTTP URLs for each character
- Preserve existing data URLs from generation (director desk)
- Use HTTP URLs for images from PartyKit storage

### Benefits

1. **No WebSocket size limits**: Images served via HTTP (no 576 byte limit)
2. **Efficient**: Images cached by browser (1 year cache headers)
3. **Scalable**: HTTP endpoints handle large payloads
4. **Backward compatible**: Preserves data URLs from generation

### Image Flow

1. **Generation**: Director generates images → stored as data URLs → sent to PartyKit
2. **Storage**: PartyKit stores images separately (`cast:image:{characterId}`)
3. **Updates**: Cast updates sent via WebSocket WITHOUT images
4. **Recovery**: State recovery sent via WebSocket WITHOUT images
5. **Display**: Clients fetch images via HTTP: `/parties/main/{sessionId}/image/{characterId}`

## Next Steps (If Issues Persist)

If images are still lost after these fixes:

1. **Add retry logic**: Retry image storage/loading on failure
2. **Add image versioning**: Track image versions to detect stale images
3. **Consider external storage**: Move to S3/Cloudinary if PartyKit limits are too restrictive
4. **Add image compression**: Compress images before storage to reduce size
