# Changelog

All notable changes to the wedding platform. Client repositories merge from here, so
**breaking** entries must state what a client deployment has to do when upgrading.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Planning and architecture documentation: product spec, architecture, data model,
  security threat model, UX page map, implementation plan, ADRs, client deployment guide.
- Claude Code configuration: root `CLAUDE.md`, skills (`implement-phase`, `verify`,
  `security-review`, `release`), path rules, and review subagents.
- Next.js 16 + Payload CMS 3.88 + PostgreSQL scaffold with strict TypeScript.
- Tailwind 4 design tokens for the two visual systems (guest and organiser).
- `Users` collection with `admin | organiser | viewer` roles, and `Media` with MIME
  restrictions.
- Environment validation (`src/lib/env.ts`) that fails fast on misconfiguration.
- Baseline security headers, with stricter no-referrer/noindex/no-store on `/invite/*`.
- `/api/health` readiness endpoint.
- Quality gates: ESLint (incl. a domain-boundary import rule), Prettier, Vitest,
  Playwright on Chromium and WebKit, a `pnpm verify` pipeline, and GitHub Actions CI
  with secret scanning.
- Development `docker-compose.yml` for PostgreSQL on port 5433.

### Added (Phase 1)

- Organiser authentication with `admin | organiser | viewer` roles, server-side guards,
  and coarse route protection via `proxy.ts`.
- `WeddingSettings` global and the `getWeddingSettings()` accessor — the single read path
  for wedding configuration.
- Feature flags with safe defaults (SMS off, since it costs money and needs consent).
- Organiser dashboard shell with a first-run setup checklist instead of empty tables.
- Append-only `AuditEvents` with metadata sanitising and salted IP hashing.
- `pnpm create-admin` bootstrap script for the first organiser account.

### Security

- Login failures are generic, so organiser email addresses cannot be enumerated.
- `?next=` post-login redirects are restricted to same-site paths (open-redirect guard).
- The `role` field is admin-only to update, preventing self-promotion.
- Payload Admin is restricted to the `admin` role.

### Added (Phases 2–3 — first end-to-end vertical slice)

- `InvitationParties`, `Guests`, and `Tags` collections, with guests cascade-deleted
  alongside their party.
- Cryptographic invitation tokens: 32 random bytes, base64url, stored only as a SHA-256
  hash under a unique index; issued once and never persisted in raw form.
- Guest invitation page at `/invite/<token>`, scoped strictly to the resolved party.
- Mobile-first RSVP supporting partial household attendance, dietary requirements,
  allergies, accessibility needs, and a message to the couple — editable until the
  deadline.
- Transactional RSVP submission with derived party status.
- Organiser party management, invitation-link issuing and rotation, and live dashboard
  RSVP statistics.
- In-process rate limiting on invitation lookup and RSVP submission.

### Security

- Unknown, malformed, and rotated tokens all fail identically, so the endpoint is not an
  oracle.
- Submitted guest ids are checked against the resolved party — a valid token cannot be
  used to edit another party's responses.
- The RSVP deadline is enforced server-side, not by hiding the form.
- `tokenHash` is unreadable through the API, and audit metadata records counts only.

### Fixed

- React Testing Library renders now clean up between tests; without it, queries matched
  earlier tests' output.

### Added (Phase 2 — guest management)

- Guest list with search, filters (RSVP, age, party, tag, dietary needs, plus-ones),
  multi-key sorting, and pagination. All filter state lives in the URL, so a filtered
  view survives a refresh and can be shared.
- Guest detail and editing, covering contact, catering, accessibility, and internal notes.
- Bulk actions: mark attending, declined, or awaiting, and delete.
- CSV export honouring the current filter, and a two-step CSV import that previews and
  reports per-row errors before writing anything.
- Pagination on the invitation party list.

### Changed

- Creating an invitation party now opens it, so guests can be added immediately instead
  of hunting for it in a paginated list.
- Guest "name" sorting orders by surname then forename, so families read in a stable order.

### Security

- The CSV export is authorised like any other organiser endpoint and is never cached.
- Exported values beginning `=`, `+`, `-`, or `@` are escaped, closing a CSV injection
  vector and preventing spreadsheets from evaluating guest data as formulas.
- Import re-parses the uploaded file server-side rather than trusting the previewed rows.

### Verified

- The documented quickstart now runs end to end on `postgres:17-alpine` via `pnpm db:up`:
  an empty database, Payload creating its schema, `pnpm create-admin`, and the full test
  suite green. Data survives a container restart, confirming the named volume.

### Added (Phase 4 — wedding website)

- Public guest site: landing page with a timezone-correct countdown, ceremony and
  reception details, venue and travel information, FAQs, contacts, and an RSVP page that
  explains the personal link without offering a guest lookup.
- `ItineraryItems` with three visibility levels — public, invited guests, internal —
  filtered server-side so supplier timings never reach a browser. Guests-only items
  appear on the personal invitation.
- `WeddingContacts` with tel, WhatsApp, and email links; hidden by default so supplier
  numbers can live alongside guest-facing ones.
- Organiser editors for wedding settings, the itinerary, and contacts.

### Fixed

- `/dashboard/settings` was linked from the dashboard but did not exist.
- `daysUntilWedding` counted calendar days in UTC, so any wedding far from UTC showed the
  wrong number — a 17:00 Los Angeles ceremony read as "tomorrow" all morning.
- Phone links now drop the bracketed trunk prefix in numbers like `+44 (0)20 …`, which
  otherwise produced an undialable `tel:` link.
- Checkboxes use explicit `label for` rather than wrapping the input, avoiding the
  double-toggle some engines exhibit with nested inputs.

### Security

- Rate limiting reshaped around the fact that wedding guests share an IP: successful
  invitation lookups are unthrottled, failed ones are throttled per IP, and RSVP
  submissions are throttled per token (ADR-016). The previous per-IP limit would have
  locked out a venue full of guests on one wifi connection.

### Added (Phase 5 — menu)

- `MenuCourses`, `MenuOptions`, and `GuestMealSelections`, the last with a real
  `UNIQUE (guest, course)` index (ADR-017).
- Meal choices in the RSVP flow, offered per attending guest and validated server-side
  against the real menu — an option posted against the wrong course, or a children's
  course posted by an adult, is rejected.
- Organiser menu configuration with dietary flags, live choice tallies, a "still to
  choose" chase list, and a dietary and allergy report.
- Caterer CSV export: one row per attending guest with their choices spelled out.
- Public `/menu` page, shown only when the menu feature is enabled.

### Fixed

- Deleting a guest left their meal choices behind as orphan rows that would still have
  been counted in the caterer's totals.
- Declining after choosing a meal now clears the choice, so nothing is plated for someone
  who is not coming.

### Added (Phase 6 — seating)

- `Tables` with unique names and advisory capacity; deleting a table returns its guests
  to the unassigned pane.
- Seating planner with an unassigned pane, table cards, live occupancy, and warnings
  ordered worst-first.
- Drag and drop via dnd-kit, layered over a labelled select on every guest that is the
  primary keyboard path, with a live region announcing every move (ADR-019).
- Bulk "seat selected guests at" from the guest list.
- A "Saving…" indicator while a seating change is being written.

### Changed

- The `unassigned` guest filter now filters on the real relationship; it was a documented
  no-op until seating existed.
- Bulk guest actions report how many guests were updated.

### Fixed

- Deleting a table left its guests displayed at it until a manual reload.
- dnd-kit logged a hydration mismatch on every draggable; fixed with a stable context id.

### Testing

- E2E global setup clears accumulated login sessions. Payload stores sessions as an array
  and rewrites it on every login; after hundreds of logins, concurrent sign-ins began
  dropping each other's sessions and bouncing tests to the login page.

### Added (Phase 7 — wedding-day photo queue)

- `PhotoGroups` with unique names, an organiser-defined running order, an optional
  duration estimate, and membership; `PhotoQueueState` global holding a revision counter.
- Photo queue state machine (`queued → get_ready → now → completed | skipped`) in
  `src/domain/photo-queue/`, with `get_ready` derived on read as well as on write.
- Group management at `/dashboard/photos`: add, reorder from the keyboard, add and remove
  members, delete.
- Wedding-day controller at `/dashboard/photos/run` — Previous, Call next, Complete,
  Skip — with large targets for one-handed outdoor use.
- `RealtimeTransport` abstraction with an in-process broadcaster, and an SSE endpoint at
  `/api/photo-queue/stream` with `/api/photo-queue` as a JSON polling fallback.
- Guest queue screen at `/photos`, and at `/photos/<token>` with the guest's own
  photographs and how far away each one is. Emphasis rises with proximity.
- Connection state shown plainly ("Live" / "Reconnecting…" / "Live (slow connection)"),
  with automatic reconnection, revision-based resync, and a polling fallback after three
  consecutive stream failures.
- A link from the invitation page to the guest's own queue, for guests who are attending.

### Security

- The live queue is public but carries **no membership**: the stream and its fallback
  send group names, descriptions, order, status, and estimates only. A guest's own groups
  are resolved server-side from their invitation token into group ids (ADR-021, T15).
- Stream connections are capped globally rather than per address, because every guest at
  a venue shares one (ADR-022, T16).
- A stale controller is refused rather than applied, so two organisers pressing Call next
  cannot advance the queue twice and skip a group entirely (ADR-020).
- Deleting a guest now also removes them from every photo group.

### Fixed

- The duplicate-name error said "photo" where the rest of the feature says "photograph".

### Testing

- The `menu` E2E spec now waits for the RSVP form's router refresh to land before
  reloading, matching the guard the `rsvp` spec already had. Adding a link to the
  invitation page widened the latent race enough to fail reliably.

### Added (development tooling)

- `pnpm seed` — deterministic, idempotent development data: six parties, sixteen guests
  covering every RSVP state along with plus-one, child, infant, dietary, allergy, and
  accessibility cases, and five photo groups. Refuses to run when `NODE_ENV=production`.

### Added (Phase 8 — notifications)

- `NotificationProvider` abstraction with console, Resend, and Twilio implementations.
  The console provider is chosen automatically when a real one is not configured, so
  development and CI never make a network call, incur a cost, or text a real person.
- `Notifications` collection with a `UNIQUE dedupeKey`, closed to every write but the
  application's own.
- Wedding-day photo alerts: guests in the group being photographed are told they are up,
  and the group after them is told to start making their way over.
- Asynchronous delivery — the organiser's action returns immediately and sending happens
  afterwards — with retry, backoff, and a per-message expiry.
- `/dashboard/notifications`: what has been sent, what failed and why, and a manual retry.
- `POST /api/notifications/dispatch` for an external scheduler or a manual drain.
- Per-guest SMS consent with a timestamp, captured on the RSVP form and the organiser's
  guest form.

### Security

- SMS requires recorded opt-in consent, checked in one place before any provider is
  reached. Consent is never inherited from the party, and consent posted to a wedding with
  SMS switched off is discarded rather than stored.
- The RSVP form asks for a phone number **only** when the wedding sends texts.
- Delivery records hold no email address or phone number; the address is read from the
  guest at send time. Deleting a guest deletes their notifications, which carry the
  rendered message.
- Sending is a mutation: the dispatch endpoint and the manual retry are organiser-only.

### Fixed

- Duplicate detection matched Payload's error by class name, which a production build
  minifies away. The real application therefore rethrew, the server action never returned,
  and the wedding-day controller's _Previous_ button hung. Detection is now by error shape.
- An alerting failure could call `rollbackTransaction` on an already-committed
  transaction. Alerts are now queued after the transaction has settled, and a failure
  there is logged rather than failing the organiser's press.
- The controller now exposes `data-pending`, so a second press cannot be dispatched at a
  DOM node React is in the middle of replacing.

### Testing

- First integration tests (`tests/int/`): deduplication under three concurrent callers,
  eligibility, delivery, party contact fallback, erasure, photo-queue alerts, and RSVP
  consent.
- Two photo-queue E2E tests were racing the server — `click()` returns when the click is
  dispatched, not when the server action completes.
