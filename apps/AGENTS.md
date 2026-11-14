# apps agent rules

## Scope

Only apps; typed contracts and root AGENTS.md.

## Forbidden

No foreign service changes, cross-module host internals or unrequested operations.

## Gate

Follow root **code → deploy → verify** in one A8 agent task. Owner expressly authorized focused tests **at full-stage closure** under `docs/MVP_EXECUTION_PLAN.md`, not for interim commits. Run guarded `--tests` only at that gate, report outcomes and obtain owner acceptance. No automatic tests/lint/QA during incomplete slices. Exact live-SHA, ownership and health safeguards always apply; a source commit is not a deployed release.
