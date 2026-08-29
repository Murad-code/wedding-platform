# Architecture Decision Records

Each ADR records a decision, its context, and its consequences. ADRs are append-only:
supersede rather than delete.

---

## ADR-001 — Single-tenant deployment, canonical template repository

**Status:** Accepted (2026-08-29)

**Context.** The product serves individual weddings. A multi-tenant SaaS would require
tenant scoping on every record and query, cross-tenant authorisation tests, and a control
plane — substantial complexity before the first wedding is served.

**Decision.** One wedding = one isolated deployment. This repository is the canonical
platform; client weddings are generated from it. No `weddingId`, no tenant scoping.

**Consequences.**

- Blast radius of a bug or breach is one wedding.
- Per-client cost is higher (a database and container per wedding).
- Upgrades must be propagated to client repos — mitigated by keeping all reusable logic
  here and client repos limited to configuration and content.
- To keep a future SaaS migration viable, wedding configuration is read exclusively
  through `getWeddingSettings()`. Adding a parameter later would not touch consumers.

**Rejected:** multi-tenant from day one (premature), a monorepo of client packages
(couples deployment lifecycles).

---

## ADR-002 — Payload CMS as the application backend

**Status:** Accepted (2026-08-29)

**Context.** We need an admin-capable data layer, authentication, media handling,
migrations, and a typed API, without hand-building all of it.

**Decision.** Payload CMS 3.88 running inside the Next.js application (same process,
same deployment). Payload's Local API is used from server components and route handlers,
avoiding an HTTP hop.

**Consequences.**

- Collections are the schema source of truth; types are generated.
- Payload Admin remains available at `/admin` for platform/developer administration.
  It is **not** the customer-facing product — organisers get a purpose-built dashboard
  (see ADR-003).
- We are coupled to Payload's migration tooling and Drizzle underneath.

**Version note.** Payload 4 exists only as `canary`. Payload 3.88 declares support for
`next >=16.2.6 <17`, which is why Next 16 is viable today.

---

## ADR-003 — Custom organiser dashboard rather than Payload Admin

**Status:** Accepted (2026-08-29)

**Context.** Payload Admin is a competent CMS UI but exposes collection internals,
relationship pickers, and CMS vocabulary. Organisers are non-technical couples.

**Decision.** Build a purpose-built organiser dashboard at `/dashboard`. Payload Admin is
restricted to `admin`-role users and treated as a maintenance tool.

**Consequences.** More UI to build, but the product is coherent: task-oriented screens
(guest list, seating planner, wedding-day controller) instead of CRUD tables.

---

## ADR-004 — PostgreSQL

**Status:** Accepted (2026-08-29)

**Decision.** PostgreSQL via `@payloadcms/db-postgres` (Drizzle).

**Rationale.** The domain is relational (parties → guests → meal selections → tables).
We want real foreign keys, unique constraints, and transactional RSVP submission.
Document stores would push that integrity into application code.

**Consequences.** `DATABASE_URL` is the only coupling point, so a client may run Postgres
in their own compose project or on managed infrastructure.

---

## ADR-005 — Opaque, hashed invitation tokens

**Status:** Accepted (2026-08-29)

**Context.** Guests must not create accounts, yet invitation data must be private.
The token _is_ the credential.

**Decision.**

- 32 bytes from a CSPRNG, base64url-encoded, as the URL path segment: `/invite/<token>`.
- The database stores only `tokenHash` = SHA-256(token), with a unique index.
- Lookup is a direct indexed equality match on the hash.
- Raw tokens are never logged, never returned by list endpoints, and shown to organisers
  only on the invitation-link screen.

**Why SHA-256 and not bcrypt/argon2.** Slow hashes exist to protect _low-entropy_ human
passwords. A 256-bit random token is not brute-forceable regardless of hash speed, and a
slow hash would forbid the indexed lookup we need. Timing attacks are irrelevant because
we compare a hash inside the database, not the secret itself.

**Consequences.** A leaked token grants access to that party's invitation until rotated;
therefore token rotation must exist, and invite endpoints must be rate limited.

---

## ADR-006 — Server-Sent Events for wedding-day real-time

**Status:** Accepted (2026-08-29)

**Context.** The photo queue pushes state from organiser to many guest phones. Traffic is
overwhelmingly server → client, on flaky venue wifi, for a few hours.

**Decision.** SSE over a plain HTTP endpoint, behind a `RealtimeTransport` abstraction,
with automatic reconnection and polling fallback.

**Rationale.** SSE reconnects natively, traverses proxies as ordinary HTTP, and needs no
extra infrastructure. WebSockets would add a stateful protocol for a one-way problem.
Ably/Pusher/Redis would add cost and a dependency for an audience of ~100 phones.

**Consequences.**

- Single-process broadcast only. Running multiple app replicas would require a shared
  bus; this is acceptable because one wedding is served by one container.
- The abstraction means swapping to a hosted provider later is contained.

---

## ADR-007 — Provider abstractions for notifications and storage

**Status:** Accepted (2026-08-29)

**Decision.** Email, SMS, and file storage are consumed through interfaces
(`NotificationProvider`, storage adapter config). Initial implementations: Resend (email),
Twilio (SMS), local disk (development) and S3-compatible storage such as Cloudflare R2
(production).

**Rationale.** These are the parts most likely to differ per client or change on price.
A no-op/console provider also keeps development and CI free of external calls and cost.

---

## ADR-008 — TypeScript 5.9, not 7.0

**Status:** Accepted (2026-08-29)

**Context.** TypeScript 7.0.2 (the native port) is the current `latest` tag.

**Decision.** Pin TypeScript 5.9.3.

**Rationale.** Verified against the registry: `typescript-eslint@8.68` declares
`typescript >=4.8.4 <6.1.0`. Adopting TS 7 would mean abandoning type-aware linting,
which is a materially larger loss than the compile-speed gain. TS 6.0.x is published but
is a transitional line and is not the `latest` tag.

**Revisit when** `typescript-eslint` ships TS 7 support. The upgrade is expected to be a
version bump plus a lint-config change, not a code migration.

---

## ADR-009 — Current RSVP state on `Guest`, submissions recorded separately

**Status:** Accepted (2026-08-29)

**Context.** The brief lists an `RSVPResponses` entity. Modelling every response as a row
_and_ reading current status from it makes every dashboard query an aggregate over
history, and invites the classic bug where two sources of truth disagree.

**Decision.** `Guest.rsvpStatus` is the single source of current truth. Each submission
additionally writes an `AuditEvent`, giving history without duplicating state.

**Consequences.** "What did they originally say?" is answered from the audit log rather
than the hot path. Dashboard counts stay simple indexed queries.

---

## ADR-010 — Seating and photo membership as relations, not JSON blobs

**Status:** Accepted (2026-08-29)

**Decision.** A guest's table is a foreign key on `Guest`. Photo group membership is a
relationship. Neither the seating plan nor the queue is stored as one JSON document.

**Rationale.** Enables "unassigned guests", occupancy counts, and over-capacity checks as
database queries, and prevents lost updates when two organisers edit concurrently.

---

## ADR-011 — Route protection split between `proxy.ts` and server guards

**Status:** Accepted (2026-08-29)

**Context.** Next.js 16 deprecated `middleware.ts` in favour of `proxy.ts`, and documents
that proxy code may be deployed to a CDN edge and "should not attempt relying on shared
modules or globals". That rules out verifying a Payload session there.

**Decision.** `src/proxy.ts` performs only a coarse check — is an auth cookie present? —
and redirects to `/login` if not. All real authorisation happens in `requireOrganiser()`
(and its role variants) and in Payload collection `access` functions.

**Rationale.** A cookie's presence proves nothing; it can be forged. Treating proxy as the
security boundary would be a classic mistake. Its job here is purely to avoid rendering a
dashboard shell for an obviously anonymous visitor.

**Consequences.** Authorisation is asserted in more than one place by design
(docs/ARCHITECTURE.md §4). Tests assert the negative cases directly against the API, not
through the UI, so a proxy misconfiguration cannot mask a missing server-side check.

---

## ADR-012 — End-to-end tests run against a production build

**Status:** Accepted (2026-08-29)

**Context.** Running Playwright against `next dev` produced intermittent timeouts on the
heavier journeys. The cause was Turbopack compiling routes on first request: with two
browser projects in parallel, the first hit to a route could exceed the assertion timeout.

**Decision.** Playwright's `webServer` runs `pnpm build && pnpm start`. Set
`PLAYWRIGHT_BASE_URL` to point at an already-running dev server when iterating locally.

**Rationale.** It removes a class of flakiness whose cause is the dev server rather than
the product, and it exercises the artefact that actually ships — which is how the
production-only `Cache-Control: no-store` behaviour on dynamic pages was confirmed.

**Consequences.** A full E2E run pays a one-off build cost. Worth it: retries that mask
timing flakiness also mask real regressions.

---

## ADR-013 — Per-worker test accounts

**Status:** Accepted (2026-08-29)

**Context.** Parallel tests signing in as the same organiser failed intermittently: they
were redirected back to the login page mid-test. Reproduced deliberately —
`--repeat-each=3` failed 2 of 3 in parallel and passed 3 of 3 with `--workers=1`.

**Cause.** Concurrent logins as one user race on that user's session list in Payload, and
one login can invalidate another's session.

**Decision.** Each Playwright worker gets its own `admin`, `organiser`, and `viewer`
account, keyed by `parallelIndex`. Test data names use a random suffix rather than
`Date.now()`, which collided when parallel tests started in the same millisecond.

**Rationale.** Removes the contention instead of hiding it behind retries. Retries would
have made this look fixed while leaving the underlying race in place.

**Note for production.** The same race means one organiser signing in on two devices at
the same instant could drop a session. Low impact — each organiser has their own account
and simply signs in again — but recorded here rather than forgotten.
