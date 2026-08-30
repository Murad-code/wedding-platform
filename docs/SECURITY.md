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
| T15 | Guest list harvesting via the live queue    | Anyone                 | The stream carries group names only; membership is resolved server-side (ADR-021)     |
| T16 | Resource exhaustion via open SSE streams    | Anyone                 | Global subscriber ceiling with `503` + `Retry-After`, never a per-IP limit (ADR-022)  |

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
- The wedding-day photo queue is **public but membership-free**. The SSE stream and its
  polling fallback carry each group's name, description, order, status, and estimate, and
  nothing else. Who is in a group is resolved server-side from the invitation token into
  a list of group ids; the browser never receives a guest id or a name (ADR-021). Group
  names are the photographer's call-outs, meant to be read aloud to the whole field.
- The `photo-groups` collection itself is closed to anonymous reads, so the membership is
  not reachable by the Payload REST API either. An E2E test asserts both halves: that a
  member's name appears nowhere in the public page or the snapshot, and that the
  collection refuses an anonymous request.
- If guest search is ever added, it must require a token, be rate limited per token, and
  return only within-party results. Recorded as a backlog constraint, not a feature.

## 4. Rate limiting

**Guests at a wedding share an IP.** The venue's wifi, or a mobile carrier's NAT, puts
most of the guest list behind one address. A naive per-IP limit on invitation lookups
would therefore lock out an entire room the moment the link was shared — a self-inflicted
outage during the event. The limits below are shaped around that.

| Surface                                      | Key                    | Limit        | Rationale                                                                                                  |
| -------------------------------------------- | ---------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `GET /invite/:token` — **successful** lookup | not limited            | —            | A 256-bit token already proves the holder was given the link. Re-reading your own invitation is not abuse. |
| `GET /invite/:token` — **failed** lookup     | per IP                 | 20 / min     | Enumeration produces a stream of _failures_; honest guests essentially never generate them.                |
| `POST /api/rsvp`                             | per token              | 20 / min     | One hammered invitation cannot affect another household.                                                   |
| `POST /api/rsvp`                             | per IP                 | 300 / min    | Ceiling against scripted flooding, sized so a coach party replying at once is unaffected.                  |
| Organiser login                              | per IP and per account | with backoff | Credentials are low-entropy; this one genuinely is per-IP.                                                 |
| CSV import/export                            | per authenticated user | —            |                                                                                                            |
| `GET /api/photo-queue/stream`                | global subscriber cap  | 500 open     | Per-IP would shut out a whole venue on one wifi; those refused fall back to polling (ADR-022).             |
| `GET /photos/:token` — **failed** lookup     | per IP                 | 20 / min     | Same enumeration signal, same limiter, as the invitation page.                                             |

A rate-limited invitation lookup returns exactly the same "not found" page as an unknown
token, so throttling does not become an oracle either.

MVP uses an in-process limiter — correct here because one wedding runs one container, and
consistent with ADR-006. Moving to a shared store would be required only if replicas are
introduced; the limiter sits behind an interface for that reason.

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
