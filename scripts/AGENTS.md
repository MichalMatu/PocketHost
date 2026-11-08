# Scripts Agent Instructions

## Scope

Local structure/documentation quality gates and the one-shot pinned upstream UI import. The import script must be invoked only from an isolated PocketHost checkout through the Termux Local Agent host-command lane; no generic host management.

## Forbidden

Never mutate physical host services, execute GitHub Actions, or auto-install OS packages. The UI import may use a temporary isolated Git clone and add only absent `apps/admin` files inside the checkout, while retaining the MIT notice and refusing to overwrite existing files.

## Gate

Checks must be deterministic, dependency-free for Gate 0 and tested with negative fixtures.

## DEV-only UI sync

`scripts/dev/ui-sync.mjs` may be started manually inside the existing,
verified PocketHost-owned DEV checkout. It may fetch the approved GitHub
`main` and update only an otherwise clean PocketHost working tree when
the exact recorded panel PID/start ticks/cwd still match. It does not restart,
kill or adopt services, manage packages or enable public listeners. Other
files and backends require explicit review. Never daemonize the watcher at
boot or enroll it as a system service.
