# scripts agent rules

## Scope

Only scripts; typed contracts and root AGENTS.md.

## Forbidden

No hidden installs or service restarts. The only non-Samsung exception is a separately approved read-only `scripts/test-lab` browser/GET capture using the verified Mac Local Agent; never project QA suites, deploy or API writes.

## Gate

Follow the root `AGENTS.md` as the single authority: A8-only guarded deployment, exact live-SHA ownership checks, and **fresh owner approval naming a 40-character SHA and check categories** for every QA, lint, typecheck, format or test execution. A Git commit is not deployment evidence.
