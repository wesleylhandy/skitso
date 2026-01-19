# Quick Start Guide: Skitso Platform Development

**Version:** 1.0.0  
**Last Updated:** 2025-01-27

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- TypeScript 5+
- Git
- OpenAI API key (for AI generation features)

## Initial Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd skitso

# Install dependencies
npm install socket.io socket.io-client
# or
yarn add socket.io socket.io-client
# or
pnpm add socket.io socket.io-client
```

### 2. Environment Variables

Create `.env.local` file:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Database (Post-MVP)
DATABASE_URL=postgresql://...
```

### 3. Configure TypeScript

Ensure `tsconfig.json` has strict mode enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 4. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Visit `http://localhost:3000`

## Project Structure

```
skitso/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (routes)/          # Route groups
│   │   │   ├── vibe-selection/
│   │   │   ├── director-desk/
│   │   │   ├── casting-couch/
│   │   │   ├── stage/
│   │   │   └── wrap-party/
│   │   ├── api/                # API routes
│   │   │   ├── openai/
│   │   │   └── sessions/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                 # Shadcn-like accessible components
│   │   ├── vibes/              # Theme-specific wrappers
│   │   ├── director/           # Director configuration UI
│   │   └── teleprompter/       # Teleprompter component
│   ├── state/                  # Jotai atoms
│   │   ├── atoms.ts
│   │   └── vibe-atoms.ts
│   ├── lib/
│   │   ├── openai/             # OpenAI integration
│   │   │   ├── prompts.ts
│   │   │   └── client.ts
│   │   └── hooks/              # Custom hooks
│   │       └── use-vibe.ts
│   └── styles/
│       └── globals.css          # CSS variables for vibes
├── public/                      # Static assets
├── .specify/                    # Specification files
└── specs/                       # Feature specifications
```

## Development Workflow

### 1. VibeContext System

Start by implementing the VibeContext infrastructure:

```typescript
// src/state/vibe-atoms.ts
import { atomWithStorage } from 'jotai/utils';

export type VibeType = 
  | 'VIRAL_NEON'
  | 'INDIE_A24'
  | 'SITCOM_STUDIO'
  | 'BRAINROT_THEATER'
  | 'QUIET_STUDIO';

export const vibeAtom = atomWithStorage<VibeType>('vibe', 'VIRAL_NEON');
```

### 2. Theme Provider

Create theme provider component:

```typescript
// src/components/vibes/theme-provider.tsx
'use client';

import { useAtomValue } from 'jotai';
import { vibeAtom } from '@/state/vibe-atoms';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const vibe = useAtomValue(vibeAtom);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', vibe);
  }, [vibe]);

  return <>{children}</>;
}
```

### 3. CSS Variables

Define vibe-specific CSS variables:

```css
/* src/styles/globals.css */
[data-theme='VIRAL_NEON'] {
  --color-bg: #0A0A0A;
  --color-primary: #8AFB17;
  --color-accent: #BF40BF;
  /* ... */
}

[data-theme='INDIE_A24'] {
  --color-bg: #141414;
  --color-primary: #CC7722;
  --color-accent: #FFFFFF;
  /* ... */
}
```

### 4. OpenAI Integration

Set up OpenAI client:

```typescript
// src/lib/openai/client.ts
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### 5. Socket.io Setup

Set up Socket.io server and client:

```typescript
// src/lib/socket/server.ts
import { Server } from 'socket.io';

export function initializeSocket(server: any) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Handle session joins, state sync, etc.
  });

  return io;
}
```

```typescript
// src/lib/socket/client.ts
import { io } from 'socket.io-client';

export const socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
  transports: ['websocket', 'polling']
});
```

**Reference:** https://context7.com/websites/socket_io/llms.txt?tokens=10000

### 6. API Routes

Create API route handlers:

```typescript
// src/app/api/openai/characters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { generateCharacterPrompt } from '@/lib/openai/prompts';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Validate with Zod schema
  // Generate characters
  // Return response
}
```

## Testing

### Run Tests

```bash
npm run test
# or
yarn test
```

### Test VibeContext Switching

1. Navigate to vibe selection page
2. Select different vibes
3. Verify instant visual transformation (<100ms per constitution Principle 5)
4. Check that all UI elements adapt

### Test AI Generation

1. Configure session (theme, tone, participants, chaos level)
2. Submit configuration
3. Verify script/characters generated within 30 seconds
4. Check that content matches selected vibe

### Test Synchronization

1. Create session as Director
2. Join session as Actor (different device/browser)
3. Verify VibeContext syncs immediately
4. Test script advancement synchronization

## Common Tasks

### Adding a New Vibe

1. Add vibe type to `VibeType` enum
2. Define CSS variables in `globals.css`
3. Add linguistic tone definitions
4. Update AI prompt templates
5. Add vibe preview assets

### Debugging State

Use Jotai DevTools:

```typescript
import { useAtomDevtools } from 'jotai-devtools';

// In component
useAtomDevtools(vibeAtom, 'vibe');
```

### Checking localStorage

Open browser DevTools → Application → Local Storage → Check atom keys

## Troubleshooting

### VibeContext Not Updating

- Check that `ThemeProvider` is in root layout
- Verify `vibeAtom` is being updated
- Check browser console for errors
- Verify CSS variables are defined

### AI Generation Failing

- Check OpenAI API key is set
- Verify rate limits not exceeded
- Check network connectivity
- Review error logs in API route

### Synchronization Issues

- Verify Socket.io connection established (check browser console for connection events)
- Check server logs for sync errors
- Verify session code is valid
- Check network connectivity
- Socket.io automatically falls back to polling if WebSocket fails - check connection transport type

## Next Steps

1. Implement VibeContext system (Phase 1)
2. Build Director configuration form (Phase 2)
3. Integrate OpenAI API (Phase 2)
4. Create Casting Couch lobby (Phase 3)
5. Build Teleprompter interface (Phase 4)
6. Implement Wrap Party (Phase 5)

See `plan.md` for detailed implementation steps.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Jotai Documentation](https://jotai.org/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
