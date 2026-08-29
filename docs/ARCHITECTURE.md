# Architecture

## 1. Shape of the system

One wedding is served by one deployment: a single Next.js process that embeds Payload CMS,
talking to a dedicated PostgreSQL database. There is no separate API service, no message
broker, and no cache tier. This is deliberate — see ADR-001 and ADR-006.

```mermaid
flowchart TB
    subgraph Clients
        G["Guest phone<br/>(mobile-first site)"]
        O["Organiser<br/>(desktop dashboard)"]
    end

    CF["DNS / Cloudflare"]
    CD["Caddy :443<br/>TLS, HTTP/2"]

    subgraph VPS["VPS — one compose project per wedding"]
        APP["Next.js 16 + Payload 3<br/>App Router, RSC"]
        DB[("PostgreSQL 17<br/>isolated volume")]
    end

    R2["R2 / S3<br/>media"]
    RS["Resend<br/>email"]
    TW["Twilio<br/>SMS"]

    G --> CF
    O --> CF
    CF --> CD
    CD --> APP
    APP --> DB
    APP --> R2
    APP -.async.-> RS
    APP -.async.-> TW
    APP -- SSE --> G
```

## 2. Application boundaries

The rule that keeps this maintainable: **UI never talks to the database, and domain logic
never imports React.**

```
src/
  app/
    (guest)/            Public wedding site + invitation pages. Mobile-first.
    (organiser)/        Authenticated dashboard. Desktop/tablet-first.
    (payload)/admin/    Payload Admin — platform maintenance, admin role only.
    api/                Route handlers (RSVP submission, SSE stream, exports).
  collections/          Payload collection configs = schema source of truth.
  globals/              WeddingSettings, PhotoQueueState.
  domain/               Business logic. No React, no Next imports. Unit-tested.
    wedding/            getWeddingSettings(), feature flags.
    invitations/        Token generation, hashing, lookup, rotation.
    rsvp/               Submission, validation, status derivation.
    seating/            Assignment rules, capacity, unassigned queries.
    photo-queue/        State machine and transitions.
    notifications/      Provider interface + dispatch/dedupe.
  lib/
    realtime/           RealtimeTransport abstraction (SSE implementation).
    auth/               Session helpers, requireOrganiser().
    validation/         Zod schemas shared by client and server.
  components/
    guest/  organiser/  ui/     (ui/ = shadcn primitives)
```

Dependency direction is one-way: `app → components → domain → payload`. `domain` may not
import from `app` or `components`. This is what makes the domain unit-testable without a
browser or a running Next server, and it is what a future SaaS migration would reuse.

### Why the domain layer exists at all

Without it, "is this guest allowed to pick the children's menu?" ends up written three
times — in the RSVP form, in the organiser editor, and in the caterer export — and they
drift. Rules live once, in `domain/`, and every surface calls them.

## 3. Rendering strategy

- **Server Components by default.** The guest site and dashboard read via Payload's
  **Local API**, which runs in-process — no HTTP round trip to our own API.
- **Client Components only where interaction demands it**: the RSVP form, the seating
  planner (dnd-kit), the wedding-day controller, and the live photo queue.
- **Route handlers** are used for mutations from client components, SSE, and file exports.

Guest pages are dynamic but cheap; wedding content changes rarely and is cached with
tag-based revalidation invalidated by Payload hooks on `WeddingSettings` and content
collections.

## 4. Authentication and authorisation

Payload's built-in auth for organisers (HTTP-only cookie, JWT). Guests never authenticate;
their invitation token _is_ their capability.

Authorisation is enforced in three places, deliberately redundant:

1. Payload collection `access` functions — the backstop that covers the Local API,
   REST, GraphQL, and Admin at once.
2. `requireOrganiser()` in organiser layouts and route handlers.
3. Middleware for coarse route protection.

The guest surface never receives an authenticated Payload user, so a guest request cannot
reach organiser data even if a query were written carelessly. Detail in `docs/SECURITY.md`.

## 5. Real-time (photo queue)

```mermaid
sequenceDiagram
    participant O as Organiser controller
    participant API as Route handler
    participant DB as PostgreSQL
    participant B as In-process broadcaster
    participant G as Guest phone (SSE)

    O->>API: POST /api/photo-queue/next
    API->>DB: transition state (transaction)
    DB-->>API: committed
    API->>B: publish(queue.updated)
    B-->>G: event: queue.updated
    G->>G: re-render NOW / UP NEXT / YOUR GROUP
    Note over G: on disconnect, EventSource retries;<br/>after N failures, fall back to polling
```

The broadcaster is in-process (a subscriber registry). That is sound because one wedding
runs one container. It is hidden behind `RealtimeTransport` so replacing it with Redis
Pub/Sub or Ably is a single-file change if replicas ever become necessary (ADR-006).

Events carry a monotonic revision number; clients that reconnect and find a newer revision
refetch state rather than replaying missed events. This keeps the server stateless about
per-client delivery.

## 6. Notifications

Interactive requests never block on Resend or Twilio. Organiser actions enqueue work; a
Payload job/worker performs delivery with retry and backoff. Deduplication is a **unique
`dedupeKey` in Postgres**, so two concurrent workers cannot double-send — the second
insert simply fails.

`NotificationProvider` has a console implementation used in development and CI, so tests
never make network calls or incur cost.

## 7. Storage

Media goes through Payload's upload handling. Development writes to local disk; production
uses S3-compatible storage (Cloudflare R2) selected by environment variable. Uploads are
validated on MIME type and size, and served with restrictive content headers.

## 8. Verified technology choices

Versions confirmed against the npm registry on 2026-08-29, not copied from the brief.

| Concern                | Choice                                    | Note                                      |
| ---------------------- | ----------------------------------------- | ----------------------------------------- |
| Framework              | Next.js 16.3                              | Payload 3.88 declares `next >=16.2.6 <17` |
| Runtime                | Node 24 LTS                               | Next requires `>=20.9`                    |
| UI                     | React 19.2                                |                                           |
| CMS/backend            | Payload 3.88                              | Payload 4 is `canary` only — not adopted  |
| Database               | PostgreSQL 17 + `@payloadcms/db-postgres` | Drizzle underneath                        |
| Language               | TypeScript 5.9.3                          | **Not 7.0** — see ADR-008                 |
| Styling                | Tailwind CSS 4                            | CSS-first config                          |
| Components             | shadcn/ui + Lucide                        |                                           |
| Drag & drop            | dnd-kit 6.3                               | with keyboard-accessible fallback         |
| Forms                  | React Hook Form 7 + Zod 4                 | Zod schemas shared client/server          |
| Unit/integration tests | Vitest 4 + React Testing Library          |                                           |
| E2E                    | Playwright 1.62                           |                                           |
| Package manager        | pnpm 10                                   |                                           |
| Infrastructure         | Docker Compose, Caddy                     | no Kubernetes, no Redis                   |

**Server-side validation is mandatory regardless of client validation.** Zod schemas are
defined in `lib/validation/` and executed on the server; the client merely reuses them for
fast feedback.

## 9. Deployment model

Each wedding is an independent Docker Compose project with its own database, volumes,
secrets, and domain. Several may share a VPS; none share state. Migrations run as an
explicit step on deploy, never automatically at container start. See
`docs/CLIENT_DEPLOYMENT.md`.

## 10. Observability

Structured JSON logging with a redaction layer that drops invitation tokens, passwords,
and unnecessary PII before serialisation. `/api/health` reports application and database
readiness for Caddy and uptime checks. Error reporting is routed through a thin wrapper so
Sentry can be added later without touching call sites.
