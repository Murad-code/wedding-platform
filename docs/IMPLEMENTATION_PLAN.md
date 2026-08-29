# Implementation Plan

Working checklist. **Only tick a box when the behaviour is implemented AND verified**
(see Definition of Done in `CLAUDE.md`). Keep this current — a fresh session resumes from
this file, not from conversation history.

Status: `[ ]` todo · `[~]` in progress · `[x]` done & verified

---

## Phase 0 — Engineering foundation

### 0.1 Planning artefacts

- [x] Inspect repository, confirm empty
- [x] Verify package versions against the npm registry (not copied from the brief)
- [x] `docs/DECISIONS.md` — ADR-001..010
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/DATA_MODEL.md` + Mermaid ER diagram
- [x] `docs/SECURITY.md` + threat model
- [x] `docs/PRODUCT_SPEC.md`
- [x] `docs/UX.md` + page map
- [x] `docs/IMPLEMENTATION_PLAN.md`
- [x] `docs/CLIENT_DEPLOYMENT.md`
- [x] Root `CLAUDE.md`
- [x] `.claude/` skills, rules, agents

### 0.2 Scaffold

- [x] `package.json`, pnpm, Node/pnpm version pinning
- [x] Next.js 16 App Router + TypeScript strict (`noUncheckedIndexedAccess` on)
- [x] Payload 3.88 wired into Next (`(payload)` route group, `payload.config.ts`)
- [x] Postgres adapter + `DATABASE_URL`
- [x] `.env.example`; `.env` confirmed git-ignored
- [x] Tailwind 4 + design tokens for the two visual systems
- [~] shadcn/ui primitives + Lucide — deps installed (`lucide-react`, `clsx`, `cva`,
  `tailwind-merge`) and a `cn()` helper is in use; no shadcn components have been
  generated yet, as hand-written components have covered every case so far
- [x] Route groups — `(guest)`, `(organiser)`, `(payload)`
- [x] `src/domain/` boundary enforced by ESLint `no-restricted-imports`

### 0.3 Developer environment

- [x] `docker-compose.yml` for Postgres (dev, port 5433 to avoid collisions)
- [~] Migration commands — `pnpm payload migrate` is wired and development uses Payload's
  `push`. No migration is committed yet; the first is generated before the first real
  deployment (Phase 9), which is also when the migrate-on-deploy step gets exercised
- [x] `/api/health` endpoint (app + database readiness)
- [x] README quickstart — **verified end to end** against a clean `postgres:17-alpine`
      via `pnpm db:up`: empty database → Payload created all 17 tables → `/api/health`
      healthy → `pnpm create-admin` → full test suite green. Data survived a container
      restart, confirming the named volume

### 0.4 Quality gates

- [x] ESLint 9 + eslint-config-next 16 flat config (+ domain boundary rule)
- [x] Prettier
- [x] Vitest 4 + React Testing Library
- [x] Playwright 1.62 (Chromium + WebKit; guest experience is iPhone-first)
- [x] `pnpm verify` composite script — **passing**
- [~] GitHub Actions CI written (lint, typecheck, test, build, E2E, secret scan);
  not yet executed — the repository has no remote
- [x] Secret scanning step (gitleaks) in CI

**Phase 0 verification (2026-08-29):** `pnpm verify` passes end to end; Playwright green
on Chromium and WebKit; `/api/health` reports `database: ok`; Payload created its schema;
guest page renders with the guest theme.

**Re-verified on the documented Docker path (2026-08-29):** the whole suite — 148 unit
tests and 84 Playwright tests — passes against a clean `postgres:17-alpine` started with
`pnpm db:up`, from an empty database.

---

## Phase 1 — Wedding & organiser foundation

- [x] `Users` collection with roles `admin | organiser | viewer`
- [x] Access-control helpers (`canRead`, `canMutate`, `isAdmin`, `canManageTeam`) + tests
- [x] Role field is admin-only to update (blocks self-promotion, T6)
- [x] Restrict Payload Admin to `admin`
- [x] `/login` + session handling (generic error, no account enumeration)
- [x] `sanitiseRedirect()` prevents open redirect via `?next=` + tests
- [x] `requireOrganiser()` / `requireMutator()` / `requireAdmin()` guards
- [x] `proxy.ts` protecting `/dashboard/*` (Next 16 renamed `middleware.ts` → `proxy.ts`)
- [x] Test: anonymous request to organiser API is rejected (403)
- [x] Test: `viewer` cannot mutate (403)
- [x] `WeddingSettings` global (couple, date, timezone, venues, deadline, content, features)
- [x] `getWeddingSettings()` domain accessor — the only read path
- [x] Feature flag helper + tests
- [x] Dashboard shell: header, stat cards, auth state
- [x] First-run setup checklist / empty state
- [x] `AuditEvents` collection (append-only, writes denied to everyone) + `recordAuditEvent()`
- [x] Audit metadata sanitiser strips tokens and PII + tests
- [x] `scripts/create-admin.ts` bootstrap (credentials via env, never logged)

**Phase 1 verification (2026-08-29):** `pnpm verify` passes; 46 unit tests and 32
Playwright tests pass on Chromium and WebKit. Verified by hand against a live database:
anonymous `/dashboard` → 307 to `/login`; wrong password → 401; correct password sets
`payload-token` and renders the dashboard; `organiser` role is refused Payload Admin.

**Deferred to Phase 2+:** dashboard navigation beyond the overview, and the settings
editor UI (`/dashboard/settings` is linked but not yet built).

---

## Phase 2 — Guests ✅

- [x] `InvitationParties` collection (cascade-deletes its guests)
- [x] `Guests` collection (party FK, indexed on party and RSVP status)
- [x] `Tags` collection + many-to-many
- [x] Create party / add guest via authorised server actions
- [x] Creating a party lands on it, so guests can be added immediately
- [x] Guest list with dense table, dietary alerts, and empty states
- [x] Guest detail and edit (contact, catering, accessibility, plus-one, notes)
- [x] Search across name and email, debounced
- [x] Filters: RSVP, age group, party, tag, dietary needs, plus-ones
- [x] Sorting (name, party, RSVP, recently added) — multi-key so families read in order
- [x] URL-reflected filter state, so a filtered view survives a refresh and is shareable
- [x] Pagination on the guest list and the party list
- [x] Bulk actions: mark attending / declined / awaiting, delete
- [x] CSV export, honouring the current filter, authorised and never cached
- [x] CSV import: preview before writing, per-row errors, duplicate reporting
- [x] Re-importing a corrected file skips existing guests rather than duplicating
- [x] Tests: 54 unit tests for CSV parsing and filters; 15 E2E journeys

**Deferred (needs a later phase):**

- Bulk "assign to table" — depends on Tables (Phase 6).
- Tag creation and assignment from the guest list; the collection and filter exist, but
  there is no UI to create or attach a tag yet.
- The "unassigned seating" filter is defined but is a no-op until Phase 6.

**Phase 2 verification (2026-08-29):** `pnpm verify` passes; 148 unit tests and 84
Playwright tests across Chromium and WebKit, green on three consecutive full runs.

---

## Phase 3 — Invitations & RSVP ← first end-to-end vertical slice ✅

- [x] `generateInvitationToken()` — 32 random bytes, base64url
- [x] `hashInvitationToken()` — SHA-256
- [x] Unique index on `tokenHash`; field unreadable through the API
- [x] `tokenVersion` + rotation via "create a new link"
- [x] `findPartyByToken()` — indexed lookup, generic failure for every failure mode
- [x] `isPlausibleToken()` shape guard keeps scanning traffic off the database
- [x] Test: valid token resolves the correct party
- [x] Test: invalid / malformed / rotated tokens all fail identically
- [x] Test: token hash never appears in an API response
- [x] Organiser invitation-link screen (shown once, never stored)
- [x] Rate limiter (interface + in-process) on `/invite` and `/api/rsvp`
- [x] `/invite/[token]` page — party-scoped, `noindex`, `no-referrer`, not cacheable
- [x] RSVP form: per-guest attend/decline, dietary, allergies, accessibility,
      message to couple, contact confirmation
- [x] Zod schemas shared client/server; **server-side validation authoritative**
- [x] `submitRsvp()` in a single transaction
- [x] Party status derivation (`pending | partial | complete`) + tests
- [x] Deadline enforced server-side (`isRsvpOpen`) + tests
- [x] Confirmation state; editable until the deadline
- [x] Dashboard RSVP statistics reflecting submissions
- [x] Audit event on submission (counts only — no names, contacts, or health data)
- [x] **E2E:** organiser creates party → invitation generated → guest RSVPs →
      organiser sees it → wrong token blocked

**Milestone verified (2026-08-29):** all twelve acceptance criteria in
`docs/PRODUCT_SPEC.md` §6 pass. 94 unit tests and 54 Playwright tests across Chromium and
WebKit, green on three consecutive full runs.

**Deferred:** plus-one self-naming on the RSVP form, and the meal-selection step
(Phase 5, gated on the menu feature).

---

## Phase 4 — Wedding website

- [ ] Guest layout, typography, and theme tokens
- [ ] Landing + countdown (timezone-correct)
- [ ] Ceremony / reception / venue / maps / travel / parking / accommodation
- [ ] Itinerary (guest view)
- [ ] FAQs
- [ ] Contacts (respecting visibility)
- [ ] Section visibility driven by settings
- [ ] Organiser website content editor
- [ ] Responsive + accessibility pass (WCAG 2.2 AA)
- [ ] Lighthouse check on mobile

---

## Phase 5 — Menu

- [ ] `MenuCourses` + `MenuOptions` collections
- [ ] Meal selections with `UNIQUE (guest, course)`
- [ ] Children's menu eligibility rule + tests
- [ ] Menu configuration UI
- [ ] Selection capture in the RSVP flow
- [ ] Totals, missing selections, dietary and allergy report
- [ ] Caterer export

---

## Phase 6 — Seating

- [ ] `Tables` collection
- [ ] Assignment via `Guest.table`
- [ ] Planner UI: unassigned pane + table cards
- [ ] dnd-kit drag and drop
- [ ] **Keyboard-accessible assignment path** + live-region announcements
- [ ] Occupancy and over-capacity warnings (warn, never block)
- [ ] Tests: capacity, unassigned query, move semantics

---

## Phase 7 — Photo queue

- [ ] `PhotoGroups` + membership
- [ ] `PhotoQueueState` global with revision counter
- [ ] State machine `queued → get_ready → now → completed | skipped` + transition tests
- [ ] Group management UI
- [ ] Wedding-day controller (Previous / Call Next / Complete / Skip)
- [ ] `RealtimeTransport` abstraction + in-process SSE implementation
- [ ] `/api/photo-queue/stream` SSE endpoint
- [ ] Guest queue screen (NOW / UP NEXT / YOUR GROUP / distance)
- [ ] Reconnection + revision-based resync
- [ ] Polling fallback
- [ ] Tests: transitions, nearest-group calculation, reconnect resync

---

## Phase 8 — Notifications

- [ ] `NotificationProvider` interface
- [ ] Console provider (dev/CI, no network, no cost)
- [ ] Resend email provider
- [ ] Twilio SMS provider
- [ ] `Notifications` collection with `UNIQUE dedupeKey`
- [ ] Async dispatch queue + retry with backoff
- [ ] Photo-queue alerts ("you're next", "make your way over")
- [ ] SMS consent flag enforced before send
- [ ] Tests: dedupe under concurrency, retry, failure recording

---

## Phase 9 — Production readiness

- [ ] Production Dockerfile (multi-stage, non-root, standalone output)
- [ ] Production `docker-compose.yml` + Caddyfile
- [ ] Structured logging + token/PII redaction (tested)
- [ ] Error reporting wrapper (Sentry-ready)
- [ ] Backup + verified restore procedure
- [ ] Full security review pass
- [ ] Deployment smoke tests
- [ ] CI/CD pipeline
- [ ] `docs/CLIENT_DEPLOYMENT.md` validated by an actual dry run

---

## Cross-cutting

- [ ] Deterministic seed data — Sarah & Adam, 20–30 guests, mixed RSVP states, dietary
      needs, menu, tables, itinerary, contacts, photo groups
- [ ] Seed script guarded against running in production
- [ ] `pnpm db:reset` for local development — E2E runs currently accumulate guest rows
      indefinitely, which makes a dev database noisy over time (harmless, but untidy)
- [ ] Keep this file, ADRs, and docs current as work lands

## Backlog

Themes · custom domains · QR invitations · WhatsApp · check-in · guest photo uploads ·
galleries · checklists · vendors · budget · registry · multi-event · multilingual · PWA ·
push · analytics · SaaS multi-tenancy.

Any guest search feature must satisfy the enumeration constraints in `docs/SECURITY.md` §3.
