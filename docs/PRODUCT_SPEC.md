# Product Specification

## 1. Vision

A wedding platform that carries a couple from "we need to organise this" through to the
wedding day itself — then gets out of the way.

Two experiences, deliberately different:

- **Organiser application** — a private dashboard. Dense, fast, confidence-inspiring.
  It answers "what still needs doing?" without the couple assembling spreadsheets.
- **Guest application** — a premium mobile wedding website and personalised invitation.
  It must never feel like an admin system.

The differentiator is the **wedding-day layer**: a live photo queue that removes the
single most chaotic half hour of a typical wedding, when a photographer shouts names
across a lawn and nobody knows whether they are needed.

This repository is the canonical platform. Individual weddings are deployments generated
from it (ADR-001).

## 2. Personas

**Sarah — the couple.** Not technical. Uses her phone at lunch and a laptop in the
evening. Anxious about forgetting something. Needs the system to tell her what is
outstanding, not to be interrogated.

**Adam — the partner.** Lower engagement, dips in occasionally. Needs to be useful within
30 seconds of opening the dashboard.

**Priya — the helper** (planner, sibling, maid of honour). Given `viewer` or `organiser`
access. Must not be able to delete the guest list.

**Murad — the guest.** Receives a link. Wants to RSVP in under a minute on a phone,
possibly for his whole family, possibly on a train. Later, on the day, wants to know when
he is needed for photos.

**Ellen — a guest with needs.** Coeliac, or uses a wheelchair. Wants to state this once,
privately, without a phone call, and be confident it was received.

## 3. Functional requirements

Requirements are `MUST` (MVP), `SHOULD` (MVP if affordable), `LATER` (backlog).

### 3.1 Organiser foundation

- MUST authenticate organisers with roles `admin | organiser | viewer`.
- MUST enforce authorisation server-side on every collection and route.
- MUST provide a dashboard shell with navigation and an authenticated layout.
- MUST show: days until wedding, invited, attending, declined, awaiting RSVP,
  meal-selection progress, dietary alerts, seating completion, unassigned guests,
  photo groups, RSVP deadline.
- MUST provide meaningful empty states — a brand-new wedding has zero of everything, and
  that is the first screen every customer sees.
- SHOULD surface upcoming planning actions.

### 3.2 Wedding settings

- MUST store all wedding configuration in a single `WeddingSettings` global.
- MUST expose it through `getWeddingSettings()`; no component reads it directly.
- MUST cover couple names, date, timezone, ceremony, reception, venues, addresses, map
  links, RSVP deadline, dress code, welcome text, contacts, accommodation, parking,
  travel, FAQs, hero imagery, theme, and enabled features.
- MUST NOT hardcode any client-specific value anywhere in the codebase.

### 3.3 Guests and invitation parties

- MUST model `InvitationParty` (people invited together) and `Guest`.
- MUST support create, edit, archive/delete for both.
- MUST support plus-one configuration, adults vs children, email, phone, tags, and
  internal notes.
- MUST support search, filter, and sort. Filters: attending, declined, awaiting RSVP,
  dietary requirements, missing meal selection, unassigned seating, table, party, tags.
- MUST support CSV import and CSV export.
- SHOULD support bulk update (tag, delete, assign table).

### 3.4 Invitations and RSVP

- MUST issue a cryptographically secure opaque token per party; URL `/invite/<token>`.
- MUST store only a hash of the token.
- MUST never expose database IDs or names in invitation URLs.
- MUST show only the resolved party's guests on the invitation page.
- MUST support per-guest attending/declined within one party — partial household
  attendance is the normal case, not an edge case.
- MUST capture dietary requirements, allergies, and a message to the couple.
- MUST support plus-one details, meal selection where enabled, accessibility needs where
  configured, and contact confirmation.
- MUST show a confirmation screen and allow editing before the RSVP deadline.
- MUST enforce the deadline server-side.
- MUST reflect RSVPs on the organiser dashboard immediately.

### 3.5 Wedding website

- MUST be mobile-first and genuinely attractive.
- MUST support: landing, couple names, date, countdown, ceremony, reception, itinerary,
  venue, maps, travel, parking, accommodation, menu, FAQs, RSVP entry, contacts.
- MUST let organisers enable/disable sections.
- MUST separate structured content from presentation so themes can reuse the data.
- MUST NOT expose a guest directory (see `docs/SECURITY.md`).

### 3.6 Menu

- MUST support fixed menus, selectable courses, no-advance-selection, and a children's
  menu.
- MUST attach selections to individual guests.
- MUST report option totals, missing selections, dietary requirements, and allergies.
- MUST provide a caterer-oriented export.

### 3.7 Seating

- MUST support creating tables with name and capacity, assigning and moving guests,
  showing unassigned guests, occupancy, and over-capacity warnings.
- MUST support drag and drop, **with a keyboard-accessible equivalent**.
- MUST store assignments relationally, not as a JSON blob.
- LATER: floor-plan/CAD editing.

### 3.8 Itinerary

- MUST support ordered items with title, description, start, optional end, location,
  visibility, and organiser reordering.
- MUST render excellently on mobile.

### 3.9 Photo queue

- MUST let organisers define ordered photo groups with assigned guests, description, and
  optional estimated duration.
- MUST support statuses `queued | get_ready | now | completed | skipped`.
- MUST provide a wedding-day controller: Previous, Call Next, Complete, Skip.
- MUST provide a guest screen showing NOW, UP NEXT, the guest's own groups, and how many
  groups away their nearest one is.
- MUST update without a manual refresh, and recover automatically from a dropped
  connection — venue wifi is unreliable and this runs outdoors.
- SHOULD tell a guest when to start making their way over.

### 3.10 Notifications

- MUST use a `NotificationProvider` abstraction; email via Resend, SMS via Twilio.
- MUST send asynchronously, never blocking an organiser request.
- MUST deduplicate, enforced by a database constraint.
- MUST record guest, type, provider, status, provider message id, attempts, and timestamps.
- MUST require recorded opt-in consent before SMS.

### 3.11 Contacts

- MUST support named contacts with role, phone, WhatsApp, email, and guest visibility.

## 4. Key journeys

**Organiser first run.** Log in → guided wedding settings → add first invitation party →
add guests → generate invitation link → share.

**Guest RSVP.** Open link → see own names and wedding details → respond per person →
meal and dietary where enabled → message → confirm → may edit until the deadline.

**Caterer handoff.** Filter to attending → review dietary alerts → export → send.

**Seating.** Open planner → see unassigned list → drag guests to tables → resolve
over-capacity warnings → confirm nobody is unassigned.

**Wedding day, organiser.** Open controller on a phone → Call Next → group is notified →
Complete → repeat.

**Wedding day, guest.** Open the site → see who is being photographed now, who is next,
and that their group is three away → get a nudge when they are next.

## 5. MVP scope

In: organiser auth, wedding settings, dashboard, guests and parties, CSV, invitation
tokens, RSVP, wedding website, menu, seating, itinerary, contacts, photo queue with SSE,
email and SMS notifications, Docker deployment.

Out (backlog): multiple themes, QR invitations, WhatsApp, guest check-in, guest photo
uploads, shared galleries, checklists, vendors, budget, gift registry, multi-event
weddings, multilingual, PWA, push notifications, analytics, SaaS multi-tenancy.

## 6. Acceptance criteria (MVP gate)

The first end-to-end milestone is complete only when all of the following are
demonstrably true, verified by automated tests:

1. The application runs from a clean checkout with documented commands.
2. An organiser can authenticate; an anonymous user cannot reach organiser routes.
3. An organiser can configure wedding settings and they appear on the guest site.
4. An organiser can create an invitation party and its guests.
5. A secure invitation URL is generated, containing no database id or name.
6. A guest can open that URL and see only their own party.
7. A guest can submit a partial-household RSVP with dietary requirements.
8. The RSVP is persisted to PostgreSQL in a single transaction.
9. The organiser dashboard reflects the RSVP.
10. A wrong, malformed, or rotated token cannot access any invitation.
11. RSVP after the deadline is rejected server-side.
12. Lint, typecheck, unit tests, E2E, and a production build all pass.

"Files were created" is not completion (see `CLAUDE.md`, Definition of Done).
