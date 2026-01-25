# Security Audit Report (T198)

## Scope

- Skitso Next.js application (`src/app`, `src/components`)
- PartyKit real-time server (`parties/session.ts`)
- OpenAI integration (`src/lib/openai/*`)
- Client-side state and persistence (`src/state`, `src/lib/utils/*`)

## Summary

- **Authentication**: Session codes act as shared secrets; no user accounts yet.
- **Authorization**: PartyKit validates session membership and vote constraints.
- **Input Validation**: Zod schemas on API routes plus additional sanitization helpers.
- **Rate Limiting**: OpenAI endpoints limited to 10 req/user/hour.
- **Security Headers**: CSP, HSTS, XFO, XCTO, Referrer-Policy configured in `next.config.ts`.

### Findings

- No hard-coded API keys or secrets in client bundles.
- Session codes generated with sufficient entropy and tested probabilistically.
- Real-time messages validated on the PartyKit server, including vote category and ranges.
- Wrap party votes locked to a single vote per participant/category.

## Controls Implemented

- **T199**: `tests/security/security.test.ts` validates sanitization helpers.
- **T200**: `tests/security/session-code-security.test.ts` validates code format and uniqueness across 5,000 samples.
- **T201**: `tests/security/data-exposure.test.ts` checks that secrets are not exposed via NEXT_PUBLIC env vars.
- **T202**: `next.config.ts` adds CSP, X-Frame-Options, HSTS, Referrer-Policy, and X-Content-Type-Options.
- **T203**: `src/lib/security/input-sanitizer.ts` provides reusable sanitization utilities.
- **T204**: `tests/security/rate-limiting.test.ts` verifies rate limiting behaviour for the OpenAI client.

## Recommended Next Steps

- Integrate sanitization helpers at API boundaries that accept user-authored text beyond existing Zod validation.
- Monitor CSP report violations in production and tighten directives once front-end integrations stabilize.
- Add automated dependency scanning (e.g. GitHub Dependabot or Snyk) to catch vulnerable transitive packages.

