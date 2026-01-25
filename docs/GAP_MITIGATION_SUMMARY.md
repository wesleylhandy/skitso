# Gap Mitigation Summary

Quick reference for the gap mitigation plan. See [GAP_MITIGATION_PLAN.md](./GAP_MITIGATION_PLAN.md) for full details.

## Priority Order

1. **Director Disconnection** - Allow performance to continue
2. **Connectivity Sync** - Fix participant/assignment state issues
3. **Character Assignment States** - Add requested/rejected, improve UI
4. **Image Storage** - Migrate fully to Cloudinary
5. **Event Replay** - Remove limits, improve idempotency
6. **Vibe Locking** - Documentation only

## Quick Fixes

### Director Disconnection
- **File**: `parties/session.ts:420-462`
- **Change**: Remove state revert when director disconnects during performance
- **Add**: `performance:end` message type for intentional ending

### Connectivity Sync
- **Files**: `parties/session.ts`, `src/lib/partykit/client.ts`, `src/components/director/casting-couch.tsx`
- **Changes**: 
  - Increase event log limits (1000 events, 24 hours)
  - Improve state-based deduplication
  - Fix participant tracking in state recovery

### Character Assignment
- **Files**: `src/state/types/session.ts`, `parties/session.ts`
- **Changes**:
  - Add `requested` and `rejected` states
  - Add `assignment:reject` message type
  - Add UI indicators for locked assignments

### Image Storage
- **Files**: `src/app/api/openai/character-image/route.ts`, `parties/session.ts`
- **Changes**:
  - Require Cloudinary (no data URL fallback)
  - Remove PartyKit image storage endpoints
  - Use Cloudinary URLs directly in cast

## Implementation Checklist

- [ ] Phase 1: Director disconnection + connectivity sync
- [ ] Phase 2: Character states + image storage
- [ ] Phase 3: Event replay + documentation

## Testing Checklist

- [ ] Director disconnects → performance continues
- [ ] Reconnection → all participants visible
- [ ] Event replay → no duplicates
- [ ] Assignment states → all transitions work
- [ ] Images → all in Cloudinary

## Documentation

- [ ] Create 4 new mitigation docs
- [ ] Update event sequence diagram
- [ ] Update existing reconnection docs
