---
name: security-review
description: Review a feature for authentication, authorisation, invitation-token leakage, PII exposure, validation, injection, abuse, rate limiting, logging, and secrets. Use after building anything touching auth, tokens, RSVP, guest data, uploads, or notifications.
---

# Security review

Review against `docs/SECURITY.md`. Report concrete findings with file and line, an
exploit path, and a fix. Do not pad the report with generic advice.

## Checklist

**Authentication & authorisation**

- Does every new route handler and server action check authorisation server-side?
- Are Payload collection `access` functions explicit, defaulting to deny?
- Can a `viewer` mutate anything? Can a non-admin reach `/admin` or change roles?
- Is any check UI-only? Hiding a control is not access control.

**Invitation tokens**

- Generated with a CSPRNG, ≥32 bytes?
- Only the hash stored, with a unique index?
- Absent from API responses, list views, logs, and error messages?
- Do invalid, malformed, and rotated tokens fail identically?
- Are `/invite/*` responses `noindex`, `no-referrer`, `no-store`?

**Guest data**

- Can a request reach a guest outside the resolved party?
- Is the party derived from the token server-side, never from a client parameter?
- Any endpoint that enumerates or searches guests?
- Is special-category data (dietary, allergies, accessibility) kept out of logs?

**Validation & injection**

- Zod on the server for every mutation?
- Deadline, ownership, plus-one allowance, and eligibility enforced server-side?
- Any string-built SQL? Any `dangerouslySetInnerHTML` on user-supplied content?
- Uploads: MIME, extension, and size validated?

**Abuse & operations**

- Rate limiting on invite lookup, RSVP, and login?
- Notification dedupe enforced by a database constraint, not application logic?
- SMS consent recorded and checked before sending?
- Any secret in code, git history, or CI logs?
- Audit events recorded for sensitive actions, without PII payloads?

## Output

Rank findings by severity with a concrete failure scenario for each. State plainly if
nothing significant was found — a clean review reported honestly is more useful than an
invented finding.
