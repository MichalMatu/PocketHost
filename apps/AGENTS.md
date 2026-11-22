# apps agent rules

## Scope

Only apps; typed contracts and root AGENTS.md.

## Forbidden

No foreign service changes, cross-module host internals or unrequested operations.

## Gate

Follow root **code → guarded deploy → verify**, with a separate targeted A8 QA task. The owner granted **standing consent for necessary non-destructive QA, tests, lint, formatting, typechecks and builds across all future PocketHost sprints until revoked**. Do not ask for fresh consent per category, sprint or SHA: choose the check scope, independently pin the exact SHA and execute through the guarded A8 `verify-changed.mjs` runner. Never use `fast-flow --tests`; tests remain separate from deployment. Preserve exact live-SHA, verified ownership, PID/start ticks, health, rollback and protected-service checks. External/real-data/destructive/device-reboot/public changes still require distinct consent.
