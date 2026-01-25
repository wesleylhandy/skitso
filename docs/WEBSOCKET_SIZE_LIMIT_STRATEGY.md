# WebSocket Size Limit Strategy

## Problem

PartyKit WebSocket has a **576-byte message limit**, but even minimal character updates are **661-670 bytes** per character.

## Current Status

### What We've Done

1. ✅ **Convert data URLs to HTTP endpoint URLs** - Images stored via HTTP POST, not WebSocket
2. ✅ **Minimal character objects** - Only send essential fields (id, participantId, isLocked, imageUrl)
3. ✅ **Intelligent server merging** - Server preserves existing fields when incoming fields are empty
4. ✅ **Character merging** - Server merges incoming characters with existing cast (prevents overwriting)
5. ✅ **CORS headers** - Added to POST endpoint for image storage
6. ✅ **Chunking logic** - Splits large casts into individual character updates

### Remaining Issue

Even with minimal fields, a single character update is **661 bytes**:
- JSON structure overhead (~200 bytes)
- Field names (~100 bytes)
- Values (~360 bytes)
  - `id`: "char-0" (~7 bytes)
  - `sessionId`: "87YgELpfas" (~12 bytes) - **DUPLICATE** (also in data.sessionId)
  - `participantId`: null (~4 bytes)
  - `isLocked`: false (~5 bytes)
  - `visualRepresentation.imageUrl`: "/parties/main/87YgELpfas/image/char-0" (~50 bytes)
  - JSON structure for nested objects (~50 bytes)

## Options Moving Forward

### Option 1: Accept Chunking (Current Approach)
**Pros:**
- Works with existing infrastructure
- Server handles merging correctly
- Images stored via HTTP (no size limit)

**Cons:**
- Single characters still exceed limit (661 > 576)
- May fail if WebSocket limit is strict
- Multiple messages for one cast update

**Status:** ⚠️ **May not work if limit is strict**

### Option 2: Create Minimal Update Message Type
Create a new message type that only sends changed fields:

```typescript
type MinimalCastUpdate = {
  type: 'cast:update:minimal';
  data: {
    sessionId: string;
    updates: Array<{
      id: string;
      p?: string | null; // participantId
      l?: boolean; // isLocked
      i?: string; // imageUrl
    }>;
  };
};
```

**Pros:**
- Much smaller messages (~150 bytes per character)
- Only sends what changed
- Backward compatible (can keep existing type)

**Cons:**
- Requires server changes to handle new message type
- More complex merge logic

**Status:** ✅ **Recommended**

### Option 3: Use HTTP for All Cast Updates
Instead of WebSocket, use HTTP POST for cast updates:

```typescript
// POST /parties/main/{sessionId}/cast
await fetch(`${host}/parties/main/${sessionId}/cast`, {
  method: 'POST',
  body: JSON.stringify({ cast }),
});
```

**Pros:**
- No size limits
- Simpler (no chunking needed)
- More reliable

**Cons:**
- Loses real-time WebSocket benefits
- Need to poll or use WebSocket for notifications only
- More HTTP requests

**Status:** ⚠️ **Loses real-time benefits**

### Option 4: Hybrid Approach
- Use HTTP POST for initial cast creation/updates
- Use WebSocket only for small updates (assignments, locks)
- Use WebSocket for notifications (cast:updated events)

**Pros:**
- Best of both worlds
- Real-time for small updates
- No size limits for large updates

**Cons:**
- More complex architecture
- Need to handle both HTTP and WebSocket

**Status:** ✅ **Best long-term solution**

## Recommendation

**Short-term:** Implement **Option 2** (Minimal Update Message Type)
- Quick to implement
- Keeps WebSocket benefits
- Solves size limit issue

**Long-term:** Consider **Option 4** (Hybrid Approach)
- Use HTTP for large updates (cast creation, full updates)
- Use WebSocket for small updates (assignments) and notifications
- More scalable and reliable

## Implementation Plan for Option 2

1. Add new message type: `cast:update:minimal`
2. Update client to use minimal format when chunking
3. Update server to handle minimal updates
4. Keep existing `cast:update` for backward compatibility
5. Test with multiple characters

## Current Workaround

For now, we're using chunking with minimal characters. The server correctly merges characters, so this should work even if individual messages are slightly over the limit (some WebSocket implementations are flexible). If it fails, we'll need to implement Option 2 or 4.
