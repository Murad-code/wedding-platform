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

### Signing in for the first time

**There are no default credentials, and there never will be.** A shipped username and
password is the single most common way a deployment gets breached, and this repository is
copied to make real weddings.

Create your own account:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at-least-12-characters' ADMIN_NAME='Your Name' pnpm create-admin
```

Then sign in at http://localhost:3000/dashboard. The password is read from the
environment so it never lands in your shell history or a process listing, and it is never
logged.

If you have run the end-to-end tests, they will also have created throwaway accounts you
can sign in with — `e2e-admin-0@example.test`, `e2e-organiser-0@example.test`, or
`e2e-viewer-0@example.test`, all with the password `e2e-only-password-123`. They are handy
for seeing what each role can do. They exist only in a local or CI database: the setup
that creates them refuses to run when `NODE_ENV=production`.

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
| [USER_GUIDE](docs/USER_GUIDE.md)                   | How to use the application, for an organiser        |
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
