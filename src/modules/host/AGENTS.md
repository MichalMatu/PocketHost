# src/modules/host agent rules

## Scope

Only src/modules/host; typed contracts and root AGENTS.md.

## Forbidden

Never operate on unowned services; validate PID, start ticks, paths and rollback.

## Gate

Follow the root `AGENTS.md` as the single authority: A8-only guarded deployment, exact live-SHA ownership checks, and **standing owner QA consent from root AGENTS.md**, with exact 40-character SHA and check categories for each execution. A Git commit is not deployment evidence.
