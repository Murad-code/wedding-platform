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
