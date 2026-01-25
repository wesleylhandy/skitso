# OWASP Security Evaluation

**Scope:** Skitso Next.js app, PartyKit real-time server, OpenAI integration, client-side state (localStorage).  
**Reference:** [OWASP Top 10 2021](https://owasp.org/Top10/2021/), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/).  
**Assessment date:** 2025-01-24.

---

## Executive Summary

**Are we endangering our application or our users?**

**Yes, in specific ways.** The app does not store passwords or payment data, and session codes are shareable by design. **Application integrity and user trust are at risk** due to:

1. **Broken Access Control (A01)** — PartyKit accepts privileged actions (script/cast/state/wrap-party updates, assignment approve/suggest) from **any** connected client. Actors or attackers who obtain a session link can overwrite script, cast, session state, and wrap-party data. Vote and participant identity are client-asserted; impersonation is possible.
2. **Identification and Authentication Failures (A07)** — Session join over WebSocket trusts client-supplied `participantId`. An attacker can “take over” another participant’s identity by sending `session:join` with the victim’s ID, overwriting their `connectionId` on the server.
3. **Security Misconfiguration (A05)** — CSP uses `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, severely weakening XSS protection. localStorage (session codes, participant data) is readable by any same-origin script; a single XSS could steal session access.
4. **Insecure Design (A04)** — Rate limiting keys off `x-user-id` (or `anonymous`). The header is client-controlled and easily spoofed; attackers can bypass rate limits by rotating identifiers.

**User-facing harm today:** Session hijacking, vote impersonation, script/cast/state tampering, wrap-party overwrite. **Indirect harm:** Weakening defenses (CSP, rate limiting) increases risk of abuse and future XSS impact.

**What is in good shape:** No API keys in client bundles; session code entropy and format validated; director-only checks for `performance:start` and `character:assign`; vote category/value validation and duplicate-vote checks; Zod on API routes; HSTS, XFO, X-Content-Type-Options, Referrer-Policy; sanitization for OpenAI prompts (prompt injection); safe-storage handling of SSR/quota.

---

## OWASP Top 10 2021 Mapping

| ID | Category | Findings | Severity |
|----|----------|----------|----------|
| **A01** | Broken Access Control | Privileged PartyKit messages not restricted to director; vote/participant identity not bound to connection | **High** |
| **A02** | Cryptographic Failures | Sensitive data (session code, participant) in localStorage unencrypted | **Medium** |
| **A03** | Injection | User input (join name, deviceInfo) not sanitized at API boundary; React escaping mitigates XSS | **Medium** |
| **A04** | Insecure Design | Rate limit identity spoofable via `x-user-id` | **Medium** |
| **A05** | Security Misconfiguration | CSP `unsafe-inline` / `unsafe-eval`; lenient `img-src`/`connect-src` | **High** |
| **A06** | Vulnerable and Outdated Components | No automated dependency scanning (Dependabot/Snyk) per audit | **Low** |
| **A07** | Identification and Authentication Failures | WebSocket `session:join` allows participant impersonation | **High** |
| **A08** | Software and Data Integrity Failures | No integrity checks on client-supplied PartyKit payloads beyond schema | **Low** |
| **A09** | Security Logging and Monitoring | No CSP reporting; authZ failures not consistently logged or shipped | **Low** |
| **A10** | SSRF | No user-controlled URL fetches; N/A | **N/A** |

---

## Detailed Findings

### A01:2021 – Broken Access Control

**1. PartyKit privileged messages not restricted to director**

- **Handlers:** `handleScriptUpdate`, `handleCastUpdate`, `handleSessionStateUpdate`, `handleWrapPartyUpdate`, `handleAssignmentApprove`, `handleAssignmentSuggest`.
- **Observation:** These handlers do **not** receive or check the sender. Any client connected to the room (including actors or someone with only the shareable link) can send:
  - `script:update` → overwrite script.
  - `cast:update` → overwrite cast (including character assignments).
  - `session:state:update` → change session status (e.g. force `performing` or `completed`).
  - `wrap-party:update` → overwrite votes, awards, feedback.
  - `assignment:approve` / `assignment:suggest` → assign characters arbitrarily.
- **Impact:** Full compromise of session content and flow; spoofed wrap-party results.
- **OWASP:** [Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/).

**2. Vote and participant identity not bound to connection**

- **Votes:** `handleWrapPartyVote` checks `sessionState.participants.has(vote.participantId)` but does **not** verify that the **sender’s connection** corresponds to `vote.participantId`. A client can submit votes using another participant’s ID.
- **Impact:** Vote impersonation; distorted wrap-party outcomes.
- **Participant takeover:** Sending `session:join` with an existing `participantId` overwrites that participant’s `connectionId` with the sender’s. The legitimate user is effectively disconnected from the server’s perspective; the attacker receives their traffic.
- **OWASP:** Same as above; also overlaps A07.

**Recommendation:**

- ~~Restrict `script:update`, `cast:update`, `session:state:update`, `wrap-party:update`, `assignment:approve`, and `assignment:suggest` to the **director** (resolve sender → participant, enforce `role === 'director'`).~~ **Done (2025-01-24):** `requireDirector` helper added; all six handlers now verify sender is director before processing.
- For `wrap-party:vote`, ensure the sender’s `connectionId` maps to `vote.participantId` (or derive participant from connection and ignore client-supplied `participantId` for attribution).
- For `session:join`, do not overwrite an existing participant’s `connectionId` when the join comes from a **different** connection; either reject or support explicit “rejoin” flows without usurping identity.

---

### A02:2021 – Cryptographic Failures

**1. Sensitive data in localStorage unencrypted**

- **Stored:** `session_code`, `participant` (id, name, deviceInfo, etc.), `cast`, `current_script`, `wrap_party_data`, and related keys.
- **Observation:** All data is plaintext. Same-origin JavaScript (including any XSS) can read and modify it.
- **Impact:** The session code acts as a shared secret for join/auth. Theft via XSS enables unauthorized access; device/malware access exposes PII-adjacent data.
- **OWASP:** [Cryptographic Failures](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/) (focus on sensitive data at rest).

**Recommendation:**

- Keep avoiding storage of tokens/passwords in localStorage.
- For current scope, document the risk and enforce strong XSS defenses (see A05, A03). If you later store more sensitive data, consider encryption or moving it server-side.

---

### A03:2021 – Injection

**1. User input not sanitized at API boundary**

- **Endpoints:** Join API (`name`, `deviceInfo`), PartyKit POST `/join` (same fields). Zod validates types and length (`name` 1–50 chars) but **no** `sanitizePlainText` / `sanitizeIdentifier` / `escapeForHtml`.
- **Usage:** `name` and related fields are stored (localStorage, PartyKit) and rendered in React. React’s default escaping reduces XSS risk, but sanitization at ingress is still best practice.
- **OWASP:** [Injection](https://owasp.org/Top10/A03_2021-Injection/) (includes XSS); [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).

**2. `dangerouslySetInnerHTML`**

- **Location:** `VibeLogo` uses `config.logo.svg` from bundled `VIBE_CONFIGS`. Source is app-controlled, not user input—**lower risk**, but worth tracking.
- **Recommendation:** Continue to avoid `dangerouslySetInnerHTML` for any user-controlled or stored data.

**Recommendation:**

- Apply `sanitizePlainText` (or `sanitizeIdentifier` for identifiers) to `name` and `deviceInfo` in the Next.js join route **before** forwarding to PartyKit or persisting. Align with existing audit recommendation to integrate sanitization at API boundaries.

---

### A04:2021 – Insecure Design

**1. Rate limit identity is client-controlled**

- **Implementation:** OpenAI rate limiting uses `x-user-id` (or `anonymous`). The client sends `x-user-id` as `sessionId` / `sessionCode` in director-config-form.
- **Observation:** The header is fully client-controlled. Attackers can rotate `x-user-id` (e.g. per request or per batch) to bypass the 10 req/hour limit.
- **Impact:** Rate limiting provides little protection against abuse of OpenAI endpoints.
- **OWASP:** [Insecure Design](https://owasp.org/Top10/A04_2021-Insecure_Design/).

**Recommendation:**

- Use a **server-derived** identifier for rate limiting: e.g. IP + `Forwarded`/`X-Forwarded-For` (with appropriate parsing and abuse awareness), or a stable session token issued by your backend. Do not rely on `x-user-id` or other client-supplied values for enforcement.

---

### A05:2021 – Security Misconfiguration

**1. Content-Security-Policy**

- **Current:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: https: blob:`; `connect-src` includes `https:` (and in dev, `ws://localhost:*`).
- **Observation:** `unsafe-inline` and `unsafe-eval` largely negate CSP’s value against XSS. Any injected script can run; thus any XSS can read localStorage (session codes, participant data).
- **OWASP:** [Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/); [CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

**Recommendation:**

- Move to nonces or hashes for `script-src` / `style-src` and remove `unsafe-inline` / `unsafe-eval` where feasible. Restrict `img-src` and `connect-src` to specific origins. Add `report-uri` or `report-to` and monitor violations.

---

### A06–A10 (concise)

- **A06:** Introduce automated dependency scanning (e.g. Dependabot, Snyk) as in the audit. **Low** priority relative to A01/A05/A07.
- **A07:** Covered above (participant impersonation via `session:join`, vote impersonation). **High**.
- **A08:** No integrity verification of PartyKit message payloads beyond parsing. **Low** for current threat model; revisit if you add sensitive server-side actions driven entirely by those payloads.
- **A09:** Add CSP reporting; log and (where possible) ship authZ failures and security-relevant events. **Low** but improves detectability.
- **A10:** SSRF not applicable; no user-controlled fetches.

---

## Are We Endangering Our Application or Our Users?

| Dimension | Assessment |
|-----------|------------|
| **Application integrity** | **Yes.** Unrestricted script/cast/state/wrap-party updates and assignment approve/suggest allow any participant (or attacker with link) to tamper with session content and wrap-party results. |
| **User identity & consent** | **Yes.** Participant takeover via `session:join` and vote impersonation undermine identity and fairness. |
| **Data confidentiality** | **Partially.** No passwords or payment data; but session codes and participant data in localStorage are exposed to XSS and device/malware access. |
| **Abuse / cost** | **Yes.** Rate limiting is bypassable; OpenAI usage can be abused. |
| **Future XSS impact** | **Elevated.** CSP is weak; any XSS can read localStorage and hijack sessions. |

**Verdict:** The application **does** create meaningful security risk today. The most impactful improvements are:

1. **A01 / A07:** ~~Restrict privileged PartyKit actions to the director;~~ bind votes and `session:join` to the actual connection. *(Director-only restriction for script/cast/state/wrap-party/assign-approve/assign-suggest implemented 2025-01-24.)*
2. **A05:** Harden CSP (remove `unsafe-inline` / `unsafe-eval`, tighten directives, add reporting).
3. **A04:** Rate limit using server-derived identifiers.
4. **A03:** Sanitize join `name` and `deviceInfo` at the API boundary.

---

## Positive Controls (No Change Recommended)

- No `NEXT_PUBLIC_*` exposure of API keys; T201.
- Session code generation (`crypto.getRandomValues`), format validation, and uniqueness testing; T200.
- Director-only enforcement for `performance:start` and `character:assign`.
- Vote category whitelist, value ranges, and duplicate-vote checks.
- Zod validation on API routes.
- Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- Sanitization of director-supplied inputs to OpenAI prompts.
- Safe-storage handling of SSR, privacy mode, and quota.

---

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/2021/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- Internal: `docs/security/audit-report.md`, `AGENTS.md`
