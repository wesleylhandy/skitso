# Character Image Storage Strategy

## Problem

Data URLs are **2.2MB+ per image**, but WebSocket has a **576-byte message limit**. We cannot send data URLs over WebSocket.

## Solution: HTTP-Only Image Storage

### Strategy

1. **Never send data URLs over WebSocket**
   - Always convert data URLs to HTTP endpoint URLs (`/parties/main/{sessionId}/image/{characterId}`) before sending cast updates
   - WebSocket messages should only contain HTTP endpoint URLs, never data URLs

2. **Store images via HTTP POST**
   - Use HTTP POST to send images to PartyKit server
   - Store images in PartyKit storage before sending cast updates
   - Images are stored in `cast:image:{characterId}` keys

3. **Two-phase update process**
   - **Phase 1**: Store images via HTTP POST (one at a time or in batch)
   - **Phase 2**: Send cast update via WebSocket with HTTP endpoint URLs only

### Implementation

#### Client Side (`src/lib/partykit/client.ts`)

```typescript
// 1. Store images via HTTP POST first
async function storeCharacterImageViaHttp(sessionId, characterId, imageUrl) {
  // POST to /parties/main/{sessionId}/image/{characterId}
  // Server stores in cast:image:{characterId}
}

// 2. Convert cast to use HTTP endpoint URLs
function convertCastDataUrlsToHttp(sessionId, cast) {
  // Replace data URLs with /parties/main/{sessionId}/image/{characterId}
  // Return cast with HTTP endpoint URLs only
}

// 3. Send cast update via WebSocket (small message)
function updateCast(sessionId, cast) {
  // Store images via HTTP first
  // Then send cast with HTTP endpoint URLs via WebSocket
}
```

#### Server Side (`parties/session.ts`)

```typescript
// New endpoint: POST /parties/main/{sessionId}/image/{characterId}
// Stores image in cast:image:{characterId}

// Existing handleCastUpdate already handles:
// - Extracting data URLs from incoming cast
// - Storing them in cast:image:{characterId}
// - Converting cast to use HTTP endpoint URLs
```

### Flow

```
1. Client generates image → data URL (2.2MB)
2. Client stores image via HTTP POST → PartyKit storage
3. Client converts cast → HTTP endpoint URLs only
4. Client sends cast update via WebSocket → Small message (<576 bytes)
5. Server receives cast → Uses HTTP endpoint URLs
6. Clients request images → GET /parties/main/{sessionId}/image/{characterId}
```

### Benefits

- ✅ WebSocket messages stay under 576-byte limit
- ✅ Images stored reliably via HTTP (no size limits)
- ✅ Images accessible via HTTP endpoint
- ✅ Works with existing server infrastructure

### Migration

1. Remove WebSocket-based image storage attempts
2. Implement HTTP POST image storage
3. Ensure all cast updates use HTTP endpoint URLs only
4. Test with multiple characters and large images
