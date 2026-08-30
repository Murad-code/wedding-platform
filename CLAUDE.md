# wedding-platform

Canonical, reusable wedding platform. Individual client weddings are separate deployments
generated from this repository — **this repo is a template, not a SaaS app**.

Two experiences in one codebase: a private **organiser dashboard** (dense, desktop-first)
and a public **guest wedding site** (beautiful, mobile-first).

## Commands

```bash
pnpm dev              # Next.js + Payload dev server
pnpm db:up            # Postgres via Docker Compose
pnpm verify           # format + lint + typecheck + unit tests + build
pnpm test             # Vitest
pnpm test:e2e         # Playwright
pnpm payload migrate  # run migrations
pnpm seed             # deterministic dev data (never runs in production)
```

Package manager is **pnpm**. Do not use npm or yarn.

## Architecture rules

- **One wedding per deployment.** No `weddingId`, no tenant scoping, no multi-tenant
  queries. Do not add them speculatively.
- **All wedding configuration flows through `getWeddingSettings()`.** Never import the
  settings global directly in a component; that accessor is what keeps a future
  multi-wedding version from being a rewrite.
- **Never hardcode client-specific content** — no couple names, venues, or dates in code.
  It belongs in `WeddingSettings`, theme tokens, or feature flags.
- **Dependency direction is one-way:** `app → components → domain → payload`.
  `src/domain/` contains business logic and must not import React or Next.
- **Payload collections are the schema source of truth.** Changing one means a migration
  and an update to `docs/DATA_MODEL.md`.
- Payload Admin (`/admin`) is a developer/maintenance tool restricted to the `admin` role.
  The customer-facing organiser product is the custom dashboard at `/dashboard`.
- Server Components by default; Client Components only where interaction requires them.
- Real-time and notification providers sit behind abstractions — do not call Resend,
  Twilio, or an SSE implementation directly from feature code.

## Security rules

- **Never log raw invitation tokens.** Never return `tokenHash` from an API.
- Invitation tokens are 32 random bytes; only their SHA-256 hash is stored.
- **Authorisation is always server-side.** Hiding a UI control is not access control.
  Single tenancy does not mean authorisation can be skipped.
- **Every mutation validates with Zod on the server**, regardless of client validation.
  Deadlines, ownership, and eligibility are server-enforced.
- Never expose a guest directory or any enumerable guest endpoint.
- Never commit secrets. `.env` is git-ignored; document variables in `.env.example`.
- Avoid logging guest PII. Dietary/allergy/accessibility data is special-category under
  GDPR — treat it accordingly.

## Testing expectations

Tests must verify behaviour, not inflate coverage. Priorities: invitation-token security,
RSVP (including partial household attendance), organiser authorisation, server-side
validation, seating constraints, photo-queue transitions, notification deduplication.

Playwright covers high-value journeys, chiefly:
organiser creates party → invitation generated → guest RSVPs → organiser sees it.

## Conventions

- Strict TypeScript. Avoid `any`.
- Every data-driven view handles loading, empty, error, and populated states.
- Semantic HTML and keyboard accessibility. Drag-and-drop always needs a keyboard path.
- Comments explain non-obvious _why_, not obvious _what_.
- Cohesive commits; inspect the diff and check for staged secrets before committing.

## Where things live

| Doc                           | Contents                                                 |
| ----------------------------- | -------------------------------------------------------- |
| `docs/USER_GUIDE.md`          | How to actually use the application, for an organiser    |
| `docs/PRODUCT_SPEC.md`        | Vision, personas, requirements, MVP, acceptance criteria |
| `docs/ARCHITECTURE.md`        | System design, boundaries, stack, real-time, deployment  |
| `docs/DATA_MODEL.md`          | Entities, relationships, indexes, ER diagram             |
| `docs/SECURITY.md`            | Threat model, tokens, PII, GDPR, rate limiting           |
| `docs/UX.md`                  | Page map, journeys, UI states, responsive, accessibility |
| `docs/IMPLEMENTATION_PLAN.md` | **Live checklist — the resume point for a new session**  |
| `docs/DECISIONS.md`           | ADRs                                                     |
| `docs/CLIENT_DEPLOYMENT.md`   | Turning this platform into a client wedding              |
| `docs/SMS_PROVIDERS.md`       | SMS vendor plan: console / Twilio / optional Textbee     |

Detailed product requirements live in `/docs`, not here.

## Definition of done

A task is done when the behaviour exists, tests pass, lint and typecheck pass, failure
states are handled, docs reflect any architectural change, and
`docs/IMPLEMENTATION_PLAN.md` is updated. Creating files is not completion.
Never disable a check or delete a test to make CI green — fix the cause.

## Session start

The repository is the source of truth, not conversation history. Read
`docs/IMPLEMENTATION_PLAN.md` first to find the current state and next task.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
