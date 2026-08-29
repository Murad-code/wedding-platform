# Client Deployment

How to turn this canonical platform into a real wedding deployment.

One wedding = one repository, one database, one domain, one deployment (ADR-001).
Nothing is shared between clients: not the database, not secrets, not volumes, not
backups. Several client stacks may share a VPS as separate Compose projects, and any
client can later be moved to their own infrastructure without code changes.

> Status: the workflow below is the target process. Steps depending on Phase 9 artefacts
> (production Dockerfile, Caddyfile, CI) are marked **[pending Phase 9]** and this
> document is validated by a dry run as part of that phase.

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

```bash
cp .env.example .env
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

Point the client's domain or subdomain at the VPS. Caddy obtains and renews TLS
automatically once the hostname is in its config. **[pending Phase 9]**

## 6. Deploy

```bash
docker compose --project-name sarah-and-adam up -d --build
```

The distinct project name is what keeps containers, networks, and volumes isolated on a
shared host. **[pending Phase 9]**

## 7. Run migrations

Migrations run as an explicit deploy step, never automatically on container start —
an auto-migrating container that restarts during an incident can compound the incident.

```bash
docker compose --project-name sarah-and-adam run --rm app pnpm payload migrate
```

## 8. Create the first organiser

Create the initial `admin` user through the documented bootstrap command, then have the
owner change the password immediately. Development seed credentials must never exist in a
production deployment.

## 9. Configure the wedding

In `/dashboard/settings`: couple names, date, timezone, venues, RSVP deadline, content,
theme, and enabled features. Everything client-specific lives here — **never in code**.

## 10. Smoke tests

- [ ] `GET /api/health` returns healthy (app + database)
- [ ] TLS valid; HTTP redirects to HTTPS
- [ ] Organiser can log in; anonymous access to `/dashboard` is refused
- [ ] Wedding settings render on the public site
- [ ] A test invitation party resolves at its `/invite/<token>` URL
- [ ] A test RSVP persists and appears on the dashboard
- [ ] A wrong token is rejected
- [ ] Media upload and retrieval work
- [ ] Security headers present
- [ ] A backup has been taken **and a restore has been tested**
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

- Automated nightly `pg_dump` per client, encrypted, retained off-host.
- Media durability is provided by the object store; buckets stay per-client.
- **Restores are tested, not assumed.** An untested backup is not a backup.
- Each client is independently restorable — recovering one wedding never touches another.

## 14. Future automation

This is intentionally a documented manual workflow, not a SaaS control plane. The steps
are ordered and side-effect-light so they can be scripted later
(`scripts/provision-client.sh`) without redesigning anything.
