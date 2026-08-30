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

---

## ADR-014 — CSV parsing is hand-written, not a dependency

**Status:** Accepted (2026-08-29)

**Context.** Guest lists arrive as spreadsheets. Real files carry a UTF-8 BOM from Excel,
CRLF endings, quoted fields containing commas ("Kamali, Murad"), doubled quotes, and
trailing blank rows.

**Decision.** `src/domain/guests/csv.ts` implements parsing and serialising directly,
covered by 34 unit tests.

**Rationale.** The requirement is narrow — one known column set, one file at a time — and
the parser is about 80 lines. A dependency would add supply-chain surface for a wedding
platform that handles personal data, and would still need the same wrapper for our
column mapping, per-row error reporting, and duplicate detection. Revisit if we ever need
streaming or multi-gigabyte files, which a wedding will not produce.

**Notable behaviour.** Export prefixes values starting `=`, `+`, `-`, or `@` with a
quote. Without it, opening the file runs the cell as a formula — corrupting the data and
providing a well-known CSV injection vector.

---

## ADR-015 — Import previews before it writes

**Status:** Accepted (2026-08-29)

**Context.** An import that silently creates two hundred wrong records is far worse than
one that asks first, and the organiser cannot easily undo it.

**Decision.** Two steps. The first parses, validates, and returns a preview plus per-row
errors, writing nothing. The second re-parses the same CSV server-side — never trusting a
client-supplied row list — and applies it.

**Consequences.** Parties are matched by name and created on demand, since spreadsheets
name households rather than referencing ids. Guests already present in a party are
skipped rather than duplicated, so re-importing a corrected file is safe — which is what
people actually do.

---

## ADR-016 — Rate limiting is shaped around shared guest IPs

**Status:** Accepted (2026-08-30)

**Context.** The invitation page originally limited lookups to 30 per minute per IP. The
E2E suite tripped it, which surfaced the real problem: at a wedding, most of the guest
list is behind one NAT — the venue wifi, or a mobile carrier. A per-IP limit on ordinary
lookups would lock out a whole room the moment the link was shared.

**Decision.**

- Successful invitation lookups are not rate limited. A 256-bit token already proves the
  holder was given the link.
- **Failed** lookups are limited per IP. Enumeration produces failures; honest guests do
  not.
- RSVP submissions are limited per **token**, so one hammered invitation cannot affect
  another household, with a deliberately generous per-IP ceiling behind it.

**Rationale.** The thing worth throttling is guessing, not reading. Keying the primary
limit on the token rather than the address also matches the actual unit of abuse.

**Consequences.** A rate-limited lookup returns the same "not found" response as an
unknown token, so throttling does not become an oracle. Login remains per-IP and
per-account, because passwords are low-entropy and that threat genuinely is address-shaped.

**Found by:** the test suite exceeding the platform's own limit — a useful reminder that
load-shaped bugs surface under parallel tests before they surface in production.

---

## ADR-017 — Meal selections are their own collection

**Status:** Accepted (2026-08-30)

**Context.** A guest's meal choices could have been an array field on `Guest`. The data
model committed to `UNIQUE (guest, course)` because both the RSVP form and the organiser
dashboard write them.

**Decision.** `GuestMealSelections` is a separate collection with a compound unique index
on `(guest, course)`.

**Rationale.** An array field gives no database constraint; enforcing "one choice per
course" in a hook would not survive two concurrent writers, which is exactly the case the
constraint exists for. Verified present in Postgres as `guest_course_idx`, rather than
assumed from the config.

**Consequences.** Writing choices is delete-then-insert inside the RSVP transaction,
which is the only way to express "these are now the choices" including a course the guest
has backed out of. Payload's foreign keys are `ON DELETE SET NULL`, so `Guests`,
`MenuCourses`, and `MenuOptions` all delete dependent selections explicitly — otherwise a
deleted guest's meal would still be counted in the caterer's totals.

---

## ADR-018 — Seating capacity warns, never blocks

**Status:** Accepted (2026-08-30)

**Context.** An eight-seat table with nine guests could be treated as an error to reject.

**Decision.** Every capacity rule produces a warning; none prevent the assignment.

**Rationale.** An organiser adding a ninth chair knows their venue better than we do.
Refusing the move would force them to lie about the capacity to get their real plan into
the software, at which point the number stops meaning anything. Warnings are ordered
worst-first, and "there are more guests than seats" comes before individual tables because
no amount of rearranging fixes it.

---

## ADR-019 — Drag and drop is an addition to the keyboard path, not the other way round

**Status:** Accepted (2026-08-30)

**Context.** `docs/UX.md` §3.3 requires seating to be operable without a mouse.

**Decision.** Every guest row carries a labelled `<select>` naming its destination, which
is the primary way to seat someone. dnd-kit is layered on top with both pointer and
keyboard sensors, and a live region announces the outcome of every move — including the
resulting occupancy, and whether the table is now over capacity.

**Rationale.** Drag-only seating excludes keyboard and screen-reader users outright, and
is awkward on a touchscreen besides. Building the accessible path first means it is the
one that is actually exercised, rather than a fallback nobody tests. The E2E suite drives
the select, so the accessible path is the tested path.

**Consequence.** Both routes call one server action, so there is a single place where
authorisation and validation happen.

---

## ADR-020 — The photo queue is guarded by a revision counter, not a lock

**Status:** Accepted (2026-08-30)

**Context.** At a real wedding the controller is open on more than one screen — the
couple's planner has it, and so does whoever is standing next to the photographer. Both
press _Call next_ when the group forms up.

**Decision.** `PhotoQueueState.revision` increments on every change. A controller sends
the revision it was displaying; if it no longer matches, the press is refused and the
screen is handed the current state instead. The transition itself runs in a database
transaction.

**Rationale.** Two presses landing as two advances means a group is never photographed —
the exact failure the feature exists to prevent. A row lock would serialise the writes
but still apply both. Refusing the stale press is the behaviour a person expects: the
button did nothing because someone else had already done it, and the screen says so.

**Consequence.** The same counter does double duty as the resync mechanism for guests
(ADR-006): a phone applies a snapshot only when its revision is newer, so a duplicate or
out-of-order delivery after a reconnect is harmless.

---

## ADR-021 — The live queue is public; membership never leaves the server

**Status:** Accepted (2026-08-30)

**Context.** The guest screen must show _your_ group and how far away it is. The obvious
implementation streams the groups with their members and lets the browser find itself.

**Decision.** The stream and its polling fallback carry group name, description, order,
status, and estimate — never member ids or names. A guest's own groups are resolved
server-side from their invitation token into a list of group **ids**, which is rendered
into their page. The browser computes distance from ids alone.

**Rationale.** A stream carrying membership would be a guest directory available to
anyone who opened the wedding site — precisely what `docs/SECURITY.md` §3 forbids. Group
_names_ are the photographer's call-outs and are meant to be read aloud to a field of
guests; who is in them is not. Sending ids also keeps the distance calculation in one
pure function shared by both surfaces, so the server and the phone cannot disagree.

**Consequence.** The organiser's controller needs the names, so its page fetches them
server-side and merges them with the stream by group id. The public page never can.

---

## ADR-022 — Stream connections are capped globally, not per address

**Status:** Accepted (2026-08-30)

**Context.** A long-lived SSE connection per guest is an obvious thing to rate-limit per
IP.

**Decision.** The endpoint refuses new subscribers past a global ceiling with `503` and
`Retry-After`; there is no per-address limit.

**Rationale.** The same reasoning as ADR-016. Every guest is on the venue's wifi, so a
per-address limit would shut out the entire room at exactly the moment the feature
matters. A global cap protects the server, and anyone turned away falls back to polling
rather than seeing a broken screen.

---

## ADR-023 — Deduplication is a unique index, not a check in code

**Status:** Accepted (2026-08-30)

**Context.** The same guest must not be told twice that their photograph is next. The
obvious implementation asks "have we already sent this?" before sending.

**Decision.** Every notification carries a `dedupeKey` of `type:subject:guest` under a
`UNIQUE` index. Sending is attempted by inserting; a lost race surfaces as a duplicate-key
error and is treated as "already handled".

**Rationale.** A read-then-write check has a window between the two, and this is exactly
the code that runs concurrently: two organisers on two controllers, a retry pass, and an
in-process timer can all decide to send the same message. The database is the only place
that can settle it. An integration test proves it with three simultaneous callers on one
key producing one row.

**Consequence.** The `catch` must distinguish a duplicate key from any other failure — a
database that is down would otherwise look like "already sent" and the guest would never
be told. A guest who cannot be reached gets no row at all, so adding their email ten
minutes later still works rather than being silently deduplicated away.

---

## ADR-024 — Wedding-day messages expire instead of retrying patiently

**Status:** Accepted (2026-08-30)

**Context.** Standard delivery retry backs off over minutes or hours to survive a
provider outage.

**Decision.** Four attempts at 1s, 4s, and 16s, and every message carries a maximum age —
five minutes for "you are up now", ten for "you are next". A message older than that is
abandoned and recorded as failed.

**Rationale.** "Start making your way over" delivered twenty minutes late is not a late
success, it is a wrong instruction: the guest walks over to an empty spot and the
photographer has moved on. The usefulness of these messages is measured in minutes, so
retrying past that window would deliver harm rather than value.

**Consequence.** The organiser's controller reports how many guests could not be reached
at the moment the group was called, because a message that will never arrive is something
a person has to fix by walking over and saying so.

---

## ADR-025 — Delivery is scheduled with `after()` and an in-process timer

**Status:** Accepted (2026-08-30)

**Context.** Sending must not block an organiser's request, and retries need something to
wake them up. A job runner (BullMQ, a worker container, a hosted queue) is the
conventional answer.

**Decision.** The action returns; `after()` runs a dispatch pass once the response has
gone out; anything still queued is picked up by a single in-process timer. An
organiser-only `POST /api/notifications/dispatch` forces a pass.

**Rationale.** One wedding runs one container (ADR-001), so a queue service would be new
infrastructure to deploy, monitor, and pay for on behalf of work that amounts to a few
dozen messages across one afternoon. The failure mode of the simple version is bounded:
a restart mid-backoff loses a pending retry, and ADR-024 means those messages were close
to worthless anyway.

**Consequence.** This is explicitly best-effort, and the endpoint exists so a person or an
external scheduler can recover. If notifications ever become something a couple depends on
outside the wedding day — invitations, reminders — this decision should be revisited
before that work starts, not after.
