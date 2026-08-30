# Wedding Platform

A reusable wedding platform: a private **organiser dashboard** for planning and running
the day, and a **guest wedding website** with personalised invitations, RSVP, and a live
wedding-day photo queue.

This repository is the **canonical platform**. Individual weddings are separate
deployments generated from it — each with its own database, domain, and data
(see [`docs/CLIENT_DEPLOYMENT.md`](docs/CLIENT_DEPLOYMENT.md)).

## Quickstart

Requires Node ≥ 20.9, pnpm 10, and Docker.

```bash
pnpm install
cp .env.example .env      # then set PAYLOAD_SECRET
pnpm db:up                # Postgres on port 5433
pnpm dev
```

- Guest site — http://localhost:3000
- Organiser dashboard — http://localhost:3000/dashboard
- Payload Admin (maintenance) — http://localhost:3000/admin
- Health — http://localhost:3000/api/health

The dev database uses port **5433** so it never collides with a Postgres you may already
be running on 5432.

## Commands

| Command                       | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `pnpm dev`                    | Development server                             |
| `pnpm verify`                 | format + lint + typecheck + tests + build      |
| `pnpm test`                   | Unit and integration tests (Vitest)            |
| `pnpm test:e2e`               | End-to-end tests (Playwright)                  |
| `pnpm db:up` / `pnpm db:down` | Start/stop the dev database                    |
| `pnpm payload migrate`        | Run migrations                                 |
| `pnpm generate:types`         | Regenerate Payload types after a schema change |
| `pnpm seed`                   | Load deterministic development data            |
| `pnpm smoke <url>`            | Deployment smoke tests against a running site  |
| `pnpm backup [dir]`           | Back up a wedding's database                   |
| `pnpm backup:verify <dump>`   | Restore a backup into a scratch database       |

## Deploying a wedding

`deploy/` holds the production Compose project, Caddyfile, and environment template.
`docs/CLIENT_DEPLOYMENT.md` is the step-by-step guide and records what has and has not
been verified.

## Stack

Next.js 16 · React 19 · Payload CMS 3 · PostgreSQL 17 · TypeScript 5.9 · Tailwind 4 ·
Vitest 4 · Playwright · Docker

Version choices — including why TypeScript is pinned to 5.9 rather than 7 — are recorded
in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Documentation

| Document                                           | Contents                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| [PRODUCT_SPEC](docs/PRODUCT_SPEC.md)               | Vision, personas, requirements, acceptance criteria |
| [ARCHITECTURE](docs/ARCHITECTURE.md)               | System design, boundaries, stack, real-time         |
| [DATA_MODEL](docs/DATA_MODEL.md)                   | Entities, relationships, indexes, ER diagram        |
| [SECURITY](docs/SECURITY.md)                       | Threat model, invitation tokens, PII, GDPR          |
| [UX](docs/UX.md)                                   | Page map, journeys, UI states, accessibility        |
| [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) | Live build checklist                                |
| [DECISIONS](docs/DECISIONS.md)                     | Architecture decision records                       |
| [CLIENT_DEPLOYMENT](docs/CLIENT_DEPLOYMENT.md)     | Creating a client wedding deployment                |

## Conventions

- One wedding per deployment. No tenant scoping.
- No client-specific content in code — it belongs in wedding settings.
- Business logic lives in `src/domain/` and never imports React or Next.
- Authorisation is server-side, always.
- Invitation tokens are never logged.

See [`CLAUDE.md`](CLAUDE.md) for the working rules used when developing this repository.
