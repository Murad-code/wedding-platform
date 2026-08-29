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
