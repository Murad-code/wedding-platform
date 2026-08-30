# Client Deployment

How to turn this canonical platform into a real wedding deployment.

One wedding = one repository, one database, one domain, one deployment (ADR-001).
Nothing is shared between clients: not the database, not secrets, not volumes, not
backups. Several client stacks may share a VPS as separate Compose projects, and any
client can later be moved to their own infrastructure without code changes.

> Status: validated end to end by a dry run on 2026-08-30 — a fresh Compose project from
> an empty database through migrations, the bootstrap organiser, the guest site, the smoke
> tests, and a backup with a verified restore. What that dry run has **not** covered is
> Caddy and TLS, which need a real domain and a public host; the Caddyfile is written but
> unexercised. CI has still never executed, because this repository has no remote.
>
> The dry run changed two things it found: the documented migration command could not
> work (ADR-028), and `/api/health` reported a deployment with no schema as healthy.

## 1. Create the client repository

```bash
git clone https://github.com/<org>/wedding-platform.git sarah-and-adam
cd sarah-and-adam
git remote rename origin platform      # keep the upstream for future upgrades
git remote add origin https://github.com/<org>/sarah-and-adam.git
git push -u origin main
```

Keeping `platform` as a remote is what makes upgrades practical:

```bash
git fetch platform
git merge platform/main
```

For that merge to stay boring, **client repositories must not modify core domain logic**.
Client differences belong in environment variables, `WeddingSettings` content, theme
tokens, feature flags, and assets. If a client genuinely needs new behaviour, implement it
in the canonical platform behind a feature flag and pull it down.

## 2. Configure the environment

Two environment files, deliberately:

- `.env` at the repository root — local development only.
- `deploy/.env` — the deployment. Copy it from `deploy/.env.example`; it is git-ignored.

```bash
cp deploy/.env.example deploy/.env
```

Generate a unique secret per client — never reuse one across weddings, or one wedding's
session cookies would validate against another's:

```bash
openssl rand -base64 32
```

| Variable                 | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `DATABASE_URL`           | Postgres connection string (isolated per client) |
| `PAYLOAD_SECRET`         | Unique per deployment, ≥32 bytes                 |
| `NEXT_PUBLIC_SERVER_URL` | Public origin, e.g. `https://sarah-and-adam.com` |
| `S3_*` / `R2_*`          | Media storage bucket and credentials             |
| `RESEND_API_KEY`         | Email (optional until notifications are enabled) |
| `TWILIO_*`               | SMS (optional)                                   |
| `NODE_ENV`               | `production`                                     |

`.env` is git-ignored and must never be committed. Store the authoritative copy in a
password manager or secret store.

## 3. Provision PostgreSQL

Either an isolated Postgres service inside the client's Compose project (default), or an
isolated managed database. The application only knows `DATABASE_URL`, so this is a
deployment decision, not a code decision.

Requirements: dedicated database and role per client, least-privilege grants, a private
network or TLS, and automated backups.

## 4. Configure media storage

Development writes to local disk. Production uses S3-compatible storage; give each client
their **own bucket** (preferred) or at minimum an isolated prefix with credentials scoped
to it.

## 5. Configure the domain

Point the client's domain or subdomain at the VPS and set `SITE_DOMAIN` and `TLS_EMAIL`
in `deploy/.env`. Caddy (`deploy/Caddyfile`) obtains and renews the certificate itself
once the name resolves.

Two details in that file are not decoration. `flush_interval -1` disables response
buffering, without which the photo queue's server-sent events would be held in a buffer
and every guest's screen would look frozen for the entire wedding. `Strict-Transport-
Security` is set at the proxy rather than in the application, because it is meaningless
over plain HTTP and a local development server must never send it.

## 6. Deploy

```bash
cd deploy
docker compose --project-name sarah-and-adam --env-file .env up -d --build
```

The distinct project name is what keeps containers, networks, and volumes isolated on a
shared host. Neither Postgres nor the application publishes a port: Caddy is the only way
in, so TLS cannot be bypassed by hitting the origin directly, and one wedding's database
is not reachable from another's.

## 7. Run migrations

Migrations run as an explicit deploy step, never automatically on container start —
an auto-migrating container that restarts during an incident can compound the incident.

The runtime image carries only the traced production bundle: five packages and no
`node_modules/.bin`, so the Payload CLI is not in it. Migrations run from a separate
image built from the same Dockerfile, which exists to run once and exit:

```bash
docker compose --project-name sarah-and-adam --profile tools run --rm migrate
```

## 8. Create the first organiser

Create the initial `admin` user through the documented bootstrap command, then have the
owner change the password immediately. Development seed credentials must never exist in a
production deployment.

## 9. Configure the wedding

In `/dashboard/settings`: couple names, date, timezone, venues, RSVP deadline, content,
theme, and enabled features. Everything client-specific lives here — **never in code**.

## 10. Smoke tests

Everything checkable without credentials is scripted, because each of these has a wrong
answer that would be a security incident:

```bash
./scripts/smoke.sh https://sarahandadam.example.com
```

It covers: health, HTTP→HTTPS redirect, HSTS, the four site-wide security headers, the
no-referrer and noindex headers on token URLs, an anonymous request to `/dashboard`, every
guest-listing API being closed to anonymous requests, the guest CSV export being
unreachable, and wrong tokens being refused at both `/invite` and `/photos`.

The rest stay manual, because they write data to a real wedding:

- [ ] Organiser can log in
- [ ] Wedding settings render on the public site
- [ ] A test invitation party resolves at its `/invite/<token>` URL
- [ ] A test RSVP persists and appears on the dashboard
- [ ] Media upload and retrieval work
- [ ] A backup has been taken **and a restore has been tested** (see §13)
- [ ] Test data removed before handover

## 11. Handover

Create the couple's organiser accounts, remove test data, confirm the RSVP deadline, and
walk them through the dashboard. Record which sub-processors are in use (Resend, Twilio,
storage) so their privacy notice is accurate — see `docs/SECURITY.md` §7.

## 12. Post-wedding

Guest PII should not be kept indefinitely. Agree a retention period with the couple, and
run the documented purge once they have what they need. The platform does not delete
automatically; that is the couple's decision.

## 13. Backup and recovery

```bash
COMPOSE_PROJECT=sarah-and-adam ./scripts/backup.sh /var/backups/sarah-and-adam
COMPOSE_PROJECT=sarah-and-adam ./scripts/verify-restore.sh /var/backups/sarah-and-adam/<file>.dump
```

- `backup.sh` takes a `pg_dump -Fc` and **refuses to keep a zero-byte file** — the classic
  silent backup failure is a command that "succeeded" and wrote nothing.
- `verify-restore.sh` restores into a scratch database beside the real one, compares exact
  row counts table by table, and drops the scratch database again. It counts rather than
  reading table statistics, because statistics are estimates that go stale and would make
  the comparison pass or fail for the wrong reason. The live database is only read.
- **Restores are tested, not assumed.** An untested backup is a file, not a backup. Run
  the verification as part of the nightly job, not only at handover.
- Media durability is provided by the object store; buckets stay per-client. The
  `media` volume is the fallback when local disk is used.
- Each client is independently restorable — recovering one wedding never touches another.

## 14. Future automation

This is intentionally a documented manual workflow, not a SaaS control plane. The steps
are ordered and side-effect-light so they can be scripted later
(`scripts/provision-client.sh`) without redesigning anything.
