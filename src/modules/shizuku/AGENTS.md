# src/modules/shizuku agent rules

## Scope

Only src/modules/shizuku; typed contracts and root AGENTS.md.

## Forbidden

No invented Android privileges or unauthorized Binder operations.

## Gate

Follow the root `AGENTS.md` as the single authority: A8-only guarded deployment, exact live-SHA ownership checks, and **fresh owner approval naming a 40-character SHA and check categories** for every QA, lint, typecheck, format or test execution. A Git commit is not deployment evidence.
