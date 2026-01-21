# Skitso Platform

Skitso is an AI-assisted collaborative performance platform that enables groups to create, perform, and share theatrical skits. Built with Next.js 16+, PartyKit for real-time synchronization, and OpenAI for AI-generated content.

## Features

- 🎭 **VibeContext System**: Five production styles (Viral Neon, Indie A24, Sitcom Studio, Brainrot Theater, Quiet Studio) that transform the entire app's aesthetic
- 🤖 **AI-Generated Content**: Automated script, character, and visual generation using OpenAI
- ⚡ **Real-Time Synchronization**: Multi-device synchronization powered by PartyKit
- 🎬 **Teleprompter**: Synchronized script advancement with Director controls
- 🎉 **Wrap Party**: Voting and social sharing after performances

## Getting Started

### Prerequisites

- Node.js 20+ and npm/yarn/pnpm
- TypeScript 5+
- OpenAI API key (for AI generation features)
- PartyKit account (for real-time features - free tier available)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd skitso

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
```

### Development

Start the development servers:

```bash
# Option 1: Run both Next.js and PartyKit dev servers concurrently
npm run dev:all

# Option 2: Run separately in different terminals
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: PartyKit dev server
npm run dev:partykit
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment Variables

Required environment variables in `.env.local`:

```env
# OpenAI API (required for AI generation)
OPENAI_API_KEY=your_openai_api_key_here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PartyKit Configuration (for local dev, uses localhost:1999 by default)
# NEXT_PUBLIC_PARTYKIT_HOST=http://localhost:1999
```

For production, see [Deployment](#deployment) section below.

## Deployment

### PartyKit Server Deployment

Skitso uses PartyKit for real-time WebSocket synchronization, which is required for multi-device collaboration. The PartyKit server must be deployed separately from the Next.js app.

#### Manual Deployment

1. **Generate PartyKit Access Token** (one-time setup):

   ```bash
   npx partykit token generate
   ```

   This opens your browser for GitHub authentication and saves `PARTYKIT_LOGIN` and `PARTYKIT_TOKEN` values locally. **Save these values securely** - you'll need them for CI/CD automation.

2. **Deploy PartyKit Server**:

   ```bash
   npx partykit deploy
   ```

   You'll be prompted to log in (if not already authenticated). The deployment will output your PartyKit host URL, e.g.:
   ```
   https://skitso.[your-username].partykit.dev
   ```

3. **Save PartyKit Host URL**:

   Save the PartyKit host URL - you'll need it for Vercel configuration.

#### Automated Deployment (CI/CD)

1. **Configure GitHub Secrets**:

   In your GitHub repository, go to Settings → Secrets and variables → Actions, and add:
   - `PARTYKIT_LOGIN`: Your GitHub username (from token generation)
   - `PARTYKIT_TOKEN`: The generated token value (from token generation)

   ⚠️ **Never commit these values to source control.**

2. **GitHub Actions Workflow**:

   The project includes `.github/workflows/deploy-partykit.yml` which automatically deploys the PartyKit server on push to `main` branch when PartyKit-related files change.

   The workflow triggers when changes are made to:
   - `parties/**` files
   - `partykit.json`
   - The workflow file itself

3. **Verify Automated Deployment**:

   After pushing to `main`, check the GitHub Actions tab to verify the deployment succeeded. The PartyKit host URL will be logged in the workflow output.

### Vercel Deployment (Next.js App)

1. **Deploy to Vercel**:

   ```bash
   # Install Vercel CLI (if not already installed)
   npm i -g vercel

   # Deploy
   vercel
   ```

   Or connect your repository to Vercel through the [Vercel Dashboard](https://vercel.com/new).

2. **Configure Environment Variables in Vercel**:

   In your Vercel project settings, add the following environment variables:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   NEXT_PUBLIC_PARTYKIT_HOST=https://skitso.[your-username].partykit.dev
   ```

   ⚠️ **Important**: Replace `[your-username]` with your actual PartyKit username from the deployment output.

3. **Redeploy**:

   After adding environment variables, trigger a new deployment in Vercel (or push a commit to trigger automatic deployment).

### Verifying Deployment

1. **Test PartyKit Connection**:

   - Open your deployed Vercel app
   - Open browser DevTools → Network tab
   - Filter by "WS" (WebSocket)
   - You should see a connection to your PartyKit host URL

2. **Test Real-Time Features**:

   - Open the app in multiple browser tabs/devices
   - Create a session and join from multiple devices
   - Verify that VibeContext changes, script updates, and performance progress synchronize across all devices within 500ms

### Troubleshooting

#### PartyKit Connection Issues

**Problem**: WebSocket connection fails, "PartyKit not connected" errors

**Solutions**:
- Verify `NEXT_PUBLIC_PARTYKIT_HOST` is set correctly in Vercel environment variables
- Ensure the PartyKit server is deployed and accessible
- Check PartyKit server logs: `npx partykit tail` (requires authentication)
- Verify CORS settings if using a custom domain

#### Deployment Fails with "Unauthorized"

**Problem**: GitHub Actions deployment fails with authentication errors

**Solutions**:
- Verify `PARTYKIT_LOGIN` and `PARTYKIT_TOKEN` are correctly set in GitHub Secrets
- Ensure the token hasn't expired (tokens don't expire, but double-check the values)
- Try regenerating the token: `npx partykit token generate`

#### Real-Time Features Not Working

**Problem**: Changes don't synchronize across devices

**Solutions**:
- Verify both Next.js app and PartyKit server are deployed
- Check browser console for WebSocket connection errors
- Ensure `NEXT_PUBLIC_PARTYKIT_HOST` points to the correct PartyKit server
- Test with PartyKit dev server locally first: `npm run dev:all`

#### PartyKit Server Not Deploying

**Problem**: Manual or automated deployment fails

**Solutions**:
- Verify `partykit.json` exists and is correctly configured
- Check that `parties/session.ts` exists and has no syntax errors
- Ensure PartyKit account is active (free tier: 10 projects max)
- Check PartyKit status page for service issues

### Environment Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI generation | `sk-...` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your Next.js app | `https://skitso.vercel.app` |
| `NEXT_PUBLIC_PARTYKIT_HOST` | Yes | PartyKit server host URL | `https://skitso.user.partykit.dev` |
| `PARTYKIT_LOGIN` | CI/CD only | GitHub username for automated deployment | `your-username` |
| `PARTYKIT_TOKEN` | CI/CD only | PartyKit access token for automated deployment | `pk_...` |

### PartyKit Free Tier Limits

- **10 projects max**: Free tier allows up to 10 PartyKit projects
- **24-hour storage**: Session data expires after 24 hours (matches MVP requirement)
- **Domain pattern**: Projects use the pattern `[project-name].[github-username].partykit.dev`

For production scaling beyond free tier, consider upgrading or migrating to a self-hosted WebSocket solution.

## Project Structure

```
skitso/
├── parties/              # PartyKit server (real-time WebSocket)
│   └── session.ts       # Session management and synchronization
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   ├── lib/             # Utilities and integrations
│   │   ├── partykit/   # PartyKit client wrapper
│   │   └── openai/     # OpenAI API integration
│   └── state/           # Jotai state management
├── public/              # Static assets
└── specs/               # Project specifications and documentation
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [PartyKit Documentation](https://docs.partykit.io)
- [Jotai State Management](https://jotai.org)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## Development Documentation

See the `specs/001-skitso-platform/` directory for detailed specifications:
- `spec.md` - Full feature specification
- `plan.md` - Technical implementation plan
- `quickstart.md` - Development setup guide
- `tasks.md` - Implementation task breakdown

## License

[Add your license here]
