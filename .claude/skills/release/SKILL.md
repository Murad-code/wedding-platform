---
name: release
description: Prepare a stable release — verify tests, build, migrations, environment docs, changelog, deployment docs, and rollback concerns. Use when cutting a release or tagging a version of the platform.
---

# Release

## 1. Verify

Run the `verify` skill in full, including E2E. Do not proceed with a failing check.

## 2. Migrations

- Are all schema changes captured in committed migrations?
- Does a migration run cleanly against a **copy of production-shaped data**, not just an
  empty dev database?
- Is each migration backward-compatible enough that the previous release could still run
  briefly during a rollout? If not, say so explicitly in the release notes.
- Is there a documented path back?

## 3. Environment

- Does `.env.example` list every variable the code now reads?
- Are new variables documented in `docs/CLIENT_DEPLOYMENT.md`?
- Any secret in the diff or in git history?

## 4. Security

Run the `security-review` skill over the changes since the last release.

## 5. Documentation

- `docs/IMPLEMENTATION_PLAN.md` reflects reality.
- ADRs recorded for significant decisions.
- `docs/DATA_MODEL.md` matches the collections.
- `CHANGELOG.md` updated: added, changed, fixed, and **breaking** — including anything a
  client repository must do when merging this upgrade.

## 6. Rollback

State what happens if this release is reverted: destructive migrations, changed token
handling, altered environment requirements. A release without a known rollback path must
say so out loud.

## 7. Client upgrade impact

Client repositories merge from this platform. Call out anything requiring manual action:
new environment variables, new settings fields, changed feature-flag defaults.
