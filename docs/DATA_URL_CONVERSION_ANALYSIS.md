# Data URL to HTTP URL Conversion Analysis

## Current State: **NOT 100% Converting**

### What We're Currently Doing

1. **Image Generation** (`src/app/api/openai/character-image/route.ts`):
   - Returns data URLs: `data:image/png;base64,...` or `data:image/jpeg;base64,...`
   - Also returns HTTP URLs if OpenAI provides them directly

2. **PartyKit Storage** (`parties/session.ts`):
   - **Stores data URLs** in separate keys: `cast:image:${characterId}`
   - Data URLs are stored as-is (not converted to HTTP URLs)
   - Example: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...` (100KB+)

3. **HTTP Endpoint** (`parties/session.ts` line 1986-2049):
   - Reads data URL from storage
   - Converts data URL to binary on-the-fly
   - Serves as binary with proper MIME type
   - Endpoint: `/parties/main/{sessionId}/image/{characterId}`

4. **Client-side** (`src/app/join/[sessionCode]/page.tsx`, `src/app/director-desk/page.tsx`):
   - Uses HTTP endpoint URLs: `getCharacterImageUrl(sessionId, characterId)`
   - Returns: `/parties/main/{sessionId}/image/{characterId}`
   - **Preserves data URLs** if they exist (from generation)

## The Problem

**We're storing data URLs but serving via HTTP URLs.** This means:
- ✅ Clients use HTTP URLs (good - avoids size limits)
- ❌ PartyKit storage contains data URLs (inefficient - large strings)
- ❌ HTTP endpoint converts data URL → binary on every request (inefficient)

## What Should We Do?

### Option 1: Convert Data URLs to HTTP URLs When Storing (Recommended)

**When storing images in PartyKit:**
1. If image is a data URL, convert it to HTTP URL reference
2. Store only the HTTP URL reference: `/parties/main/{sessionId}/image/{characterId}`
3. HTTP endpoint serves from storage (already works)

**Benefits:**
- Smaller storage (HTTP URLs are ~50 bytes vs 100KB+ for data URLs)
- Faster storage operations
- Clearer separation: storage = references, endpoint = binary

**Implementation:**
```typescript
// In parties/session.ts, when storing images:
const imageUrl = char.visualRepresentation?.imageUrl;
if (imageUrl && imageUrl.startsWith('data:')) {
  // Convert data URL to HTTP URL reference
  const httpImageUrl = `/parties/main/${sessionId}/image/${char.id}`;
  await this.room.storage.put(`cast:image:${char.id}`, imageUrl); // Still store data URL for endpoint
  // But in cast, use HTTP URL
  return { ...char, visualRepresentation: { ...char.visualRepresentation, imageUrl: httpImageUrl } };
}
```

**Wait, that doesn't work** - we need the data URL in storage for the HTTP endpoint to serve it.

### Option 2: Keep Current Approach (Store Data URLs, Serve via HTTP)

**Current approach:**
- Store data URLs in `cast:image:${characterId}` keys
- HTTP endpoint reads data URL and converts to binary
- Clients use HTTP URLs: `/parties/main/{sessionId}/image/{characterId}`

**This works but:**
- Data URLs are large (100KB+ each)
- Storage is inefficient
- But it's simple and works

### Option 3: Convert Data URLs to Binary When Storing (Best)

**Store binary data instead of data URLs:**
1. When receiving data URL, convert to binary
2. Store binary in PartyKit storage
3. HTTP endpoint serves binary directly (no conversion needed)

**Benefits:**
- Most efficient storage
- Fastest serving (no conversion)
- Smaller storage footprint

**Implementation:**
```typescript
// Convert data URL to binary when storing
if (imageUrl.startsWith('data:')) {
  const base64Match = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (base64Match) {
    const binaryString = atob(base64Match[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Store binary instead of data URL
    await this.room.storage.put(`cast:image:${char.id}`, bytes);
  }
}
```

**But PartyKit storage might not support binary directly** - need to check.

## Answer to Your Question

**Are we 100% converting all data URLs to HTTP URLs?**

**NO.** We're:
- ✅ Using HTTP URLs on the client side
- ❌ Storing data URLs in PartyKit storage
- ✅ Serving via HTTP endpoint (which converts data URL → binary)

**For .png files specifically:**
- Generated as: `data:image/png;base64,...`
- Stored as: `data:image/png;base64,...` (data URL)
- Served via: `/parties/main/{sessionId}/image/{characterId}` (HTTP endpoint)
- Client uses: HTTP URL (not data URL)

## Recommendation

**Current approach works but is inefficient.** We should:

1. **Keep current approach** (it works, clients use HTTP URLs)
2. **OR optimize storage** by converting data URLs to binary when storing
3. **OR document** that we store data URLs but serve via HTTP (current state)

The key point: **Clients are using HTTP URLs, not data URLs**, which is what matters for avoiding WebSocket size limits. The storage inefficiency is a minor issue.

## Files to Check

- `src/app/api/openai/character-image/route.ts` - Returns data URLs
- `parties/session.ts` line 742 - Stores data URLs
- `parties/session.ts` line 1995 - Reads data URLs from storage
- `parties/session.ts` line 2018-2042 - Converts data URL to binary on-the-fly
- `src/lib/partykit/client.ts` line 66 - Returns HTTP URLs to clients
