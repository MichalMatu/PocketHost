# tests agent rules

## Scope

Only tests; typed contracts and root AGENTS.md.

## Forbidden

No foreign service changes, cross-module host internals or unrequested operations.

## Gate

Follow root **code → deploy → verify** in one agent task. Do not run tests, lint, formatting, typecheck, QA, smoke or documentation checks until the owner explicitly says it is time for tests. Deployment safety gates and read-only live-SHA verification still apply. A source commit alone is not a deployed release.
