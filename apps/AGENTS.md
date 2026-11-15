# apps agent rules

## Scope

Only apps; typed contracts and root AGENTS.md.

## Forbidden

No foreign service changes, cross-module host internals or unrequested operations.

## Gate

Follow root **code → deploy → verify** in one A8 agent task. **QA is OFF, including full-stage closure.** Never use `--tests` (FAST FLOW rejects it) or run tests, lint, formatting, typecheck, smoke or documentation gates without fresh, explicit owner consent for that exact scope and SHA. A separately approved manual QA runner is independent of deployment. Exact live-SHA, ownership and health safeguards always apply; a source commit is not a deployed release.
