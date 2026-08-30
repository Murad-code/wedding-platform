# Migrations

Payload writes migrations here. The directory is tracked (rather than created on demand)
so `payload migrate` finds it and reports "no migrations to run" instead of an error.

Development uses Payload's `push` to keep the schema in step. Production never does:
migrations are generated deliberately and run as an explicit deploy step
(`docs/CLIENT_DEPLOYMENT.md` §7).

Generate one after any collection or global change:

```bash
pnpm payload migrate:create <name>
```
