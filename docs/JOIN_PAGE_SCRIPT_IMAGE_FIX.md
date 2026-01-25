# Join Page Script & Image Loading Fix

## Issues Fixed

### 1. Script Not Loading from PartyKit

**Problem**: Script was stored in PartyKit but not being loaded on join page even though it existed in PartyKit storage.

**Root Cause**: 
- Script was being sent in `state:recovered` message correctly
- But there was insufficient logging to debug why it wasn't being received
- No retry logic if script was missing during state recovery

**Fix**:
- Added detailed logging for script loading in both client and server
- Added retry logic if script is missing when session is in 'casting' or 'performing' state
- Enhanced script update listener logging

### 2. Images Not Being Handled on Join Page

**Problem**: Character images weren't loading on join page even though PartyKit had them.

**Root Cause**:
- Images are stripped from WebSocket messages (to avoid size limits)
- Clients should use HTTP endpoint: `/parties/main/{sessionId}/image/{characterId}`
- But the logic wasn't properly checking if existing URLs were data URLs vs HTTP URLs
- Typo: `castWithImages` instead of `castWithImageUrls` on line 326

**Fix**:
- Fixed typo: `castWithImages` → `castWithImageUrls`
- Improved image URL handling to properly detect data URLs vs HTTP URLs
- Added logging for image URL assignment
- Ensured HTTP endpoint URLs are used when images aren't data URLs

## Changes Made

### `src/app/join/[sessionCode]/page.tsx`

1. **Fixed typo** (line 326):
   ```typescript
   // Before: castWithImages.length === 0
   // After: castWithImageUrls.length === 0
   ```

2. **Enhanced script loading logging**:
   ```typescript
   console.log('[JoinPage] Updating script from PartyKit state recovery', {
     sessionId: recoveredData.sessionId,
     hasScript: recoveredData.script !== null && recoveredData.script !== undefined,
     scriptTitle: recoveredData.script?.title || null,
     scriptScenes: recoveredData.script?.scenes?.length || 0,
     scriptData: recoveredData.script ? { ... } : null,
   });
   ```

3. **Added script retry logic**:
   ```typescript
   // If session is in 'casting' or 'performing' state but script is missing, retry recovery
   if ((recoveredData.status === 'casting' || recoveredData.status === 'performing') && !recoveredData.script) {
     console.warn('[JoinPage] Session is in', recoveredData.status, 'state but script not provided - retrying state recovery in 1 second');
     setTimeout(() => {
       // Retry state recovery
     }, 1000);
   }
   ```

4. **Improved image URL handling**:
   ```typescript
   // Check if existing URL is a data URL before using HTTP endpoint
   const httpImageUrl = existingImageUrl && existingImageUrl.length > 0 && existingImageUrl.startsWith('data:')
     ? existingImageUrl
     : getCharacterImageUrl(recoveredData.sessionId, char.id);
   ```

5. **Added image URL logging**:
   ```typescript
   console.log('[JoinPage] Setting image URL for character:', {
     characterId: char.id,
     characterName: char.name,
     hasExistingUrl: Boolean(existingImageUrl && existingImageUrl.length > 0),
     existingUrlType: existingImageUrl?.startsWith('data:') ? 'data-url' : existingImageUrl?.startsWith('http') ? 'http-url' : 'none',
     httpImageUrl,
   });
   ```

6. **Enhanced script update listener logging**:
   ```typescript
   console.log('[JoinPage] Script update received via PartyKit:', {
     sessionId: data.sessionId,
     scriptTitle: data.script?.title || null,
     scriptScenes: data.script?.scenes?.length || 0,
   });
   ```

### `parties/session.ts`

1. **Added storage retrieval logging**:
   ```typescript
   console.log('[PartyKit Server] State recovery - storage retrieval:', {
     sessionId: data.sessionId,
     roomId: this.room.id,
     castLength: cast.length,
     hasScript: script !== null,
     scriptTitle: script?.title || null,
     scriptScenes: script?.scenes?.length || 0,
   });
   ```

## Debugging

### Check Script Loading

1. **Browser Console**: Look for `[JoinPage] Updating script from PartyKit state recovery` logs
2. **PartyKit Logs**: Look for `[PartyKit Server] State recovery - storage retrieval` logs
3. **Network Tab**: Check if `state:recovered` WebSocket message contains script data

### Check Image Loading

1. **Browser Console**: Look for `[JoinPage] Setting image URL for character` logs
2. **Network Tab**: Check if image requests to `/parties/main/{sessionId}/image/{characterId}` are successful
3. **PartyKit Logs**: Check if images are stored in `cast:image:{characterId}` keys

### Common Issues

1. **Script Missing**: 
   - Check PartyKit storage has script: `await room.storage.get('script')`
   - Verify script was saved after generation
   - Check if state recovery is happening before script is saved

2. **Images Not Loading**:
   - Verify image endpoint is accessible: `GET /parties/main/{sessionId}/image/{characterId}`
   - Check if images are stored in PartyKit: `await room.storage.get('cast:image:{characterId}')`
   - Verify HTTP endpoint URL format matches expected pattern

## Testing

1. **Create a new session** and generate script + cast
2. **Open join page** in a new tab/window
3. **Check browser console** for script and image loading logs
4. **Verify script appears** in the UI
5. **Verify character images load** correctly

## PartyKit Localhost

**Question**: Do we need to clear PartyKit running on localhost?

**Answer**: Usually not necessary, but if you're seeing stale data:

1. **Restart PartyKit dev server**: `npm run dev:partykit`
2. **Clear PartyKit storage** (if using local dev):
   - PartyKit dev server uses in-memory storage by default
   - Restarting clears all data
3. **Check for multiple PartyKit instances**: Make sure only one is running

**If issues persist**:
- Check PartyKit logs for errors
- Verify storage keys are correct
- Ensure state recovery is being called
- Check WebSocket connection is established
