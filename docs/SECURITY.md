# Security & Privacy

Wedding guest data is personal data: names, contact details, dietary requirements,
allergies, and accessibility needs. The last three are **special-category data under
GDPR Article 9** (health). This raises the bar above a typical CRUD app, and shapes the
decisions below.

## 1. Threat model

Assets, ranked: guest PII (especially health data) → invitation tokens → organiser
credentials → wedding content → media.

| #   | Threat                                      | Actor                  | Mitigation                                                                            |
| --- | ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| T1  | Guest list harvesting                       | Curious guest, scraper | No guest directory, no enumerable IDs, no list endpoint on the guest surface          |
| T2  | Invitation token brute force                | Opportunist            | 256-bit tokens; rate limiting; generic failure response                               |
| T3  | Token leak via referrer/logs/screenshot     | Accidental             | `Referrer-Policy: no-referrer` on invite routes; token redaction in logs; `noindex`   |
| T4  | Party A reading Party B's invitation        | Guest                  | Server-side scoping by resolved party; never trust a client-supplied party id         |
| T5  | Unauthenticated access to organiser APIs    | Anyone                 | Payload access control + `requireOrganiser()` + middleware                            |
| T6  | Privilege escalation (`viewer` → `admin`)   | Insider                | Role changes restricted to `admin`; users cannot edit their own role                  |
| T7  | RSVP tampering after the deadline           | Guest                  | Deadline enforced server-side, not by hiding the button                               |
| T8  | Stored XSS via rich text or guest free-text | Guest/organiser        | Rich text stored structured (Lexical), never `dangerouslySetInnerHTML` on guest input |
| T9  | SQL injection                               | Anyone                 | Parameterised queries via Drizzle; no string-built SQL                                |
| T10 | CSRF on organiser mutations                 | Anyone                 | `SameSite=Lax` cookies + Payload CSRF allowlist + no state-changing GETs              |
| T11 | Malicious file upload                       | Organiser account      | MIME + extension + size validation; images re-processed; no execution from media      |
| T12 | SMS/email abuse (cost, spam)                | Compromised account    | Per-guest dedupe key, send caps, consent flag required                                |
| T13 | Secrets in the repository                   | Accident               | `.env` git-ignored, `.env.example` only, secret scanning in CI                        |
| T14 | Backup exposure                             | Infrastructure         | Encrypted backups, restricted access, isolated per client                             |

Explicitly **out of scope** for MVP: DDoS absorption (delegated to Cloudflare), and
insider misuse by a legitimately authorised organiser (mitigated by audit logging, not
prevented).

## 2. Invitation tokens

This is the most security-sensitive part of the product, because the token replaces
authentication entirely.

- **Generation:** 32 bytes from `crypto.randomBytes`, base64url-encoded (~43 chars).
- **Storage:** only `SHA-256(token)`, in a column with a unique index. The raw token is
  never persisted. Rationale for SHA-256 over bcrypt/argon2 is in ADR-005 — briefly, slow
  hashes protect low-entropy passwords, not 256-bit random values, and would prevent the
  indexed lookup.
- **Transport:** path segment, not a query parameter, so it stays out of most analytics
  and proxy query logs.
- **Rotation:** organisers can rotate a token; `tokenVersion` increments and the old link
  stops working immediately.
- **Display:** shown to organisers only on the invitation-link screen. List views never
  include it. API responses never include `tokenHash`.
- **Logging:** a redaction layer strips anything matching a token pattern before any log
  is written. **Never log a raw token.**
- **Headers on `/invite/*`:** `Referrer-Policy: no-referrer`,
  `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`.

An unknown token and a rotated token both return the same generic "invitation not found"
page, and both take a comparable amount of time, so responses do not distinguish
"never existed" from "revoked".

## 3. Guest enumeration

The brief requires no publicly enumerable guest directory, and we go further:

- No endpoint accepts a guest name and returns matches.
- No sequential or guessable identifiers appear in guest-facing URLs.
- The invitation page returns **only** the guests in the resolved party — the party is
  derived server-side from the token, never from a request parameter.
- If guest search is ever added, it must require a token, be rate limited per token, and
  return only within-party results. Recorded as a backlog constraint, not a feature.

## 4. Rate limiting

| Endpoint             | Limit                                   |
| -------------------- | --------------------------------------- |
| `GET /invite/:token` | per IP, sliding window; generic failure |
| `POST /api/rsvp`     | per token and per IP                    |
| Organiser login      | per IP and per account, with backoff    |
| CSV import/export    | per authenticated user                  |

MVP uses an in-process limiter — correct here because one wedding runs one container, and
consistent with ADR-006. Moving to a shared store would be required only if replicas are
introduced; the limiter is behind an interface for that reason.

## 5. Authentication & authorisation

- Organisers: Payload auth, HTTP-only `Secure` `SameSite=Lax` cookie. Passwords hashed by
  Payload; never logged; strength enforced on set.
- Guests: no accounts, no sessions, no password reset surface to attack.
- **Authorisation is server-side, always.** Hiding a button is not access control.
  Every collection defines explicit `access` functions; the default posture is deny, and
  public read is granted only to the specific fields the guest site needs.
- Anonymous users can never reach: organiser APIs, guest administration, full RSVP data,
  seating administration, invitation administration, or notification administration.
- Single tenancy does not reduce these requirements — the audience for a wedding site
  includes everyone the couple invited, which is precisely the population most motivated
  to peek at the guest list.

## 6. Input validation

Every mutation validates with a Zod schema **on the server**. Client-side validation is a
UX affordance and is never trusted. Validation covers type, length bounds, and enum
membership; free-text fields are length-capped to bound storage and log volume.

Server-side checks that must not be client-only: RSVP deadline, party ownership of a
guest, plus-one allowance, children's-menu eligibility, and table capacity warnings.

## 7. PII handling and GDPR

- **Minimisation:** we collect only what serves the wedding. Phone numbers are optional
  unless SMS is enabled. No date of birth — `ageGroup` is sufficient for catering.
- **Purpose limitation:** guest data is used for this wedding only, never shared between
  client deployments. Isolation is architectural (ADR-001), not procedural.
- **Lawful basis:** legitimate interest for invitation and catering; **explicit opt-in
  consent** for SMS, recorded with a timestamp.
- **Access & portability:** organisers can export guest data as CSV/JSON.
- **Erasure:** deleting a guest removes the record and their meal selections; audit events
  retain the action but not the PII payload.
- **Retention:** guest PII should be deleted after the wedding. The platform ships a
  documented purge procedure and a post-wedding reminder; it does not delete data
  automatically, because that is the couple's decision to make.
- **Logging:** never log passwords, secrets, raw invitation tokens, or unnecessary PII.
  IP addresses in audit events are stored salted-hashed.
- **Processors:** Resend, Twilio, and the storage provider are sub-processors and must be
  listed in the couple's privacy notice.

## 8. Secrets

Never committed. `.env` is git-ignored; `.env.example` documents required variables with
placeholder values. `PAYLOAD_SECRET` must be unique per client deployment — reuse would
let one wedding's cookies validate against another's. CI scans for secrets and fails the
build on a hit.

## 9. Transport & headers

TLS terminated at Caddy, HSTS enabled. Baseline headers: `Content-Security-Policy` with
no `unsafe-eval`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` (tightened to `no-referrer` on invite
routes).

## 10. Audit logging

Append-only `AuditEvents` for: login success and failure, guest create/update/delete,
RSVP submission, token generation and rotation, seating changes, photo queue transitions,
notification dispatch, and data export. Records actor, action, entity, timestamp, and a
hashed IP — never the token, never the full changed PII payload.

## 11. Pre-release checklist

- [ ] No secrets in git history
- [ ] `PAYLOAD_SECRET` unique and ≥32 bytes
- [ ] Default/seed organiser credentials removed or rotated
- [ ] Seed script cannot run against production
- [ ] Payload Admin restricted to `admin` role
- [ ] Rate limiting active on invite, RSVP, and login
- [ ] Security headers verified in production
- [ ] Token redaction verified in logs
- [ ] Backups run and a restore has actually been tested
- [ ] Privacy notice lists all sub-processors
