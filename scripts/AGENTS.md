# Scripts Agent Instructions

## Scope

Local structure/documentation quality gates and the one-shot pinned upstream UI import. The import script must be invoked only from an isolated PocketHost checkout through the Termux Local Agent host-command lane; no generic host management.

## Forbidden

Never mutate physical host services, execute GitHub Actions, or auto-install OS packages. The UI import may use a temporary isolated Git clone and add only absent `apps/admin` files inside the checkout, while retaining the MIT notice and refusing to overwrite existing files.

## Gate

Checks must be deterministic, dependency-free for Gate 0 and tested with negative fixtures.
