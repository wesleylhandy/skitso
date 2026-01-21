# Architecture Analysis: Multi-Instance & Deployment Considerations

## Current Architecture Issues

### 1. **In-Memory State Stores**
- **Problem**: Two separate in-memory `Map` stores:
  - `sessionStore` in `/api/sessions/[sessionId]/route.ts` (API routes)
  - `socketSessionStore` in `/lib/socket/session-store.ts` (Socket.io server)
- **Impact**: 
  - State is **not shared** across server instances
  - State is **lost** on server restart
  - State is **isolated** per process/container

### 2. **Custom Server with Socket.io**
- **Current**: `server.ts` creates a custom HTTP server with Socket.io
- **Problem**: 
  - **Does NOT work on Vercel** (serverless functions are stateless)
  - Requires persistent connection (WebSockets), which serverless can't maintain
  - Each deployment creates a new isolated instance

### 3. **Vercel Deployment Model**
- **Serverless Functions**: 
  - Each API route = separate serverless function
  - Functions are **stateless** and **ephemeral**
  - No persistent connections possible
  - Multiple instances can handle different requests
  - **No shared memory** between instances

### 4. **Multi-Device Access Issues**
- **Scenario**: Director on Device A, Actor on Device B
- **Problem**: 
  - If requests hit different server instances, they won't see the same session
  - Socket connections are instance-specific
  - Session created on Instance 1 won't be visible to Instance 2

## Deployment Architecture Options

### Option 1: Separate Socket.io Server (Recommended for MVP)

**Architecture:**
```
┌─────────────────┐         ┌──────────────────┐
│   Vercel        │         │  Socket Server   │
│   (Next.js)     │────────▶│  (Railway/Render)│
│                 │  REST   │                  │
│  - API Routes   │         │  - Socket.io     │
│  - Static Pages │         │  - Redis Store   │
└─────────────────┘         └──────────────────┘
       │                            │
       │                            │
       └──────────┬─────────────────┘
                  │
            ┌─────▼─────┐
            │   Redis   │
            │  (Shared) │
            └───────────┘
```

**Implementation:**
- **Next.js App**: Deploy to Vercel (API routes for REST, static pages)
- **Socket.io Server**: Separate Node.js server (Railway, Render, Fly.io, or DigitalOcean)
- **Shared State**: Redis for session storage (shared across all instances)
- **Database**: PostgreSQL/Prisma for persistent storage (optional for MVP)

**Pros:**
- ✅ Works with Vercel (no custom server needed)
- ✅ Scalable (multiple Socket.io instances can share Redis)
- ✅ Real-time WebSocket support
- ✅ Shared state across all instances
- ✅ Can use Redis adapter for Socket.io clustering

**Cons:**
- ❌ Requires managing two deployments
- ❌ Additional infrastructure cost (~$5-20/month)
- ❌ Need to handle CORS between domains
- ❌ More complex deployment pipeline

**Cost Estimate:**
- Vercel: Free tier (hobby) or $20/month (pro)
- Socket Server: $5-10/month (Railway/Render)
- Redis: $0-5/month (Upstash free tier or Railway addon)
- **Total: $5-35/month**

---

### Option 2: Full Vercel Deployment with Polling/SSE

**Architecture:**
```
┌─────────────────┐         ┌──────────────┐
│   Vercel        │         │   Database   │
│   (Next.js)     │────────▶│  (Supabase/  │
│                 │  REST   │   Vercel DB) │
│  - API Routes   │         │              │
│  - Polling/SSE  │         │  - Sessions  │
└─────────────────┘         │  - State     │
                            └──────────────┘
```

**Implementation:**
- **Next.js App**: Deploy to Vercel
- **Real-time**: Use Server-Sent Events (SSE) or polling instead of WebSockets
- **State**: Database (Supabase, Vercel Postgres, or PlanetScale)
- **No Socket.io**: Replace with SSE or polling

**Pros:**
- ✅ Single deployment (simpler)
- ✅ Works natively with Vercel
- ✅ No separate server to manage
- ✅ Database provides persistence

**Cons:**
- ❌ SSE has limitations (one-way, no binary data)
- ❌ Polling is less efficient (higher latency, more requests)
- ❌ Not true real-time (slight delay)
- ❌ More database queries (cost)

**Cost Estimate:**
- Vercel: Free tier or $20/month
- Database: $0-25/month (Supabase free tier or Vercel Postgres)
- **Total: $0-45/month**

---

### Option 3: Self-Hosted Full Stack

**Architecture:**
```
┌─────────────────────────────┐
│   Single Server             │
│   (Railway/Render/Fly.io)   │
│                             │
│  - Next.js App              │
│  - Socket.io Server         │
│  - Database (PostgreSQL)    │
│  - Redis (optional)         │
└─────────────────────────────┘
```

**Implementation:**
- **Single Deployment**: Use `server.ts` (already exists)
- **Database**: PostgreSQL for persistence
- **Redis**: Optional for session caching
- **Socket.io**: Native support (not serverless)

**Pros:**
- ✅ Single deployment (simplest)
- ✅ Full control over infrastructure
- ✅ Native Socket.io support
- ✅ Shared state in single process (or Redis)

**Cons:**
- ❌ Can't use Vercel's edge network/CDN
- ❌ Need to manage server yourself
- ❌ Scaling requires load balancer + Redis
- ❌ Less "serverless" benefits

**Cost Estimate:**
- Server: $5-20/month (Railway/Render/Fly.io)
- Database: $0-10/month (included or separate)
- **Total: $5-30/month**

---

### Option 4: Hybrid with Managed Real-time Service

**Architecture:**
```
┌─────────────────┐         ┌──────────────────┐
│   Vercel        │         │  Managed Service │
│   (Next.js)     │────────▶│                  │
│                 │  REST   │  - Pusher        │
│  - API Routes   │         │  - Ably          │
│                 │         │  - Supabase RT   │
└─────────────────┘         └──────────────────┘
       │                            │
       └──────────┬─────────────────┘
                  │
            ┌─────▼─────┐
            │  Database │
            └───────────┘
```

**Implementation:**
- **Next.js App**: Deploy to Vercel
- **Real-time**: Use Pusher, Ably, or Supabase Realtime
- **State**: Database (same as real-time service or separate)
- **No Socket.io**: Use managed WebSocket service

**Pros:**
- ✅ Works with Vercel
- ✅ Managed real-time infrastructure
- ✅ Built-in scaling
- ✅ Less infrastructure to manage

**Cons:**
- ❌ Vendor lock-in
- ❌ Additional cost
- ❌ Less control
- ❌ Need to learn new API

**Cost Estimate:**
- Vercel: Free tier or $20/month
- Pusher/Ably: $49/month (starter) or free tier (limited)
- Supabase: Free tier (500MB) or $25/month
- **Total: $0-74/month**

---

## Recommended Solution for MVP

### **Option 1: Separate Socket.io Server + Redis**

**Why:**
1. ✅ Maintains current Socket.io implementation (minimal code changes)
2. ✅ True real-time WebSocket support
3. ✅ Scalable architecture (can add more Socket.io instances)
4. ✅ Works with Vercel for Next.js app
5. ✅ Redis provides shared state across instances
6. ✅ Cost-effective for MVP ($5-15/month)

**Implementation Steps:**

1. **Create Socket.io Server** (separate repo/service):
   ```typescript
   // socket-server/index.ts
   import { Server } from 'socket.io';
   import { createAdapter } from '@socket.io/redis-adapter';
   import { createClient } from 'redis';
   
   const io = new Server(3001, {
     cors: { origin: process.env.NEXT_PUBLIC_APP_URL }
   });
   
   // Use Redis adapter for multi-instance support
   const pubClient = createClient({ url: process.env.REDIS_URL });
   const subClient = pubClient.duplicate();
   await Promise.all([pubClient.connect(), subClient.connect()]);
   io.adapter(createAdapter(pubClient, subClient));
   
   // Use Redis for session storage
   // ... existing socket handlers
   ```

2. **Update Next.js App**:
   - Remove `server.ts` (or keep for local dev only)
   - Update Socket.io client to connect to separate server
   - Keep API routes for REST endpoints
   - Use Redis in API routes for session storage

3. **Deploy**:
   - Next.js → Vercel
   - Socket.io Server → Railway/Render
   - Redis → Upstash (serverless Redis) or Railway addon

**Migration Path:**
- Phase 1: Add Redis to current stores (shared state)
- Phase 2: Extract Socket.io to separate server
- Phase 3: Update client to connect to new server
- Phase 4: Deploy separately

---

## Alternative: Quick Fix for Development

If you need something working **now** for development/testing:

### **Option 5: Single Instance Development Server**

**For local/dev only:**
- Use `npm run dev:server` (current setup)
- Works fine for single developer
- **Don't deploy to production** with this setup

---

## Recommendations by Use Case

| Use Case | Recommended Solution | Why |
|---------|-------------------|-----|
| **Local Development** | Current `server.ts` | Simplest, works fine |
| **MVP/Production** | Option 1 (Separate Socket Server) | Scalable, real-time, cost-effective |
| **Quick Prototype** | Option 2 (SSE/Polling) | Fastest to implement, single deploy |
| **Enterprise Scale** | Option 1 + Database | Full control, scalable |
| **Budget Constrained** | Option 2 (SSE) | Lowest cost, acceptable latency |

---

## Immediate Action Items

1. **Decision Required**: Choose deployment architecture
2. **If Option 1**: 
   - Set up Redis (Upstash free tier)
   - Create separate Socket.io server repo
   - Update session stores to use Redis
3. **If Option 2**:
   - Set up database (Supabase/Vercel Postgres)
   - Replace Socket.io with SSE or polling
   - Update client to use new real-time method
4. **Migration**: Plan gradual migration from in-memory to shared state

---

## Questions to Consider

1. **Budget**: What's your monthly infrastructure budget?
2. **Scale**: How many concurrent sessions do you expect?
3. **Latency**: Is true real-time critical, or is 1-2s delay acceptable?
4. **Complexity**: How much infrastructure management are you comfortable with?
5. **Timeline**: Do you need production-ready now, or can you iterate?

---

## Next Steps

**Please provide:**
1. Your preferred deployment option
2. Budget constraints
3. Timeline requirements
4. Any specific platform preferences (Vercel, Railway, etc.)

I'll then provide detailed implementation steps for your chosen approach.
