---
status: active
owner: core
last_reviewed: 2026-11-09
purpose: Current proportional source checks, hardware/release gates and evidence rules
---

# PocketHost Quality Gates

## Evidence rules

**PASS applies only to an executed command, a terminal Local Agent
receipt, the exact source SHA, and its stated scope.** Publication of
a request, historical acceptance, a source commit or a clean plan
does not certify current code. State untested changes as UNVERIFIED
and unfinished release requirements as OPEN.

All project tests, lint, typechecks, installs and builds execute
**exclusively on the verified Samsung Termux via Local Agent**.
GitHub Connector is source/task transport, not an executor.
No GitHub Actions, Codex, Work or Mac/Linux fallback.

## Proportional DEV workflow

| Change                                    | Normal focused validation                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Docs only                                 | Documentation link/index check, changed Markdown lint and Prettier         |
| Visual CSS/copy                           | Existing Vite HMR and owner review; focused check only if behavior changed |
| Routes/controls                           | Affected Node/Vitest contracts and changed-file lint                       |
| Pure source/contract                      | Dependent Node tests, TypeScript incremental, boundaries                   |
| Host command, data, ownership, networking | Positive/negative targeted device checks and explicit risk review          |
| Milestone/public release                  | All applicable G0–G3, not just targeted checks                             |

On a clean verified checkout preview **npm run dev:changed --
--base=<last-verified-sha>** and execute with an added **--run**
through Local Agent only. Missing dependency mapping or infrastructure
changes require manual impact review; the selector never claims full
coverage automatically. Preserve dependencies and caches; avoid
duplicate successful tests.

## Optional external link review

The local `check:docs` gate checks repository-relative Markdown links.
For **public external HTTP(S) URLs**, `npm run check:links:external` uses
Lychee with conservative network limits, private-address exclusion and a
private GitHub transport-repo exclusion. Lychee is an **optional separately
installed Termux binary**; this command does not install it. Run manually
through the verified Samsung Local Agent at milestone/documentation review,
not in `check`, `check:all`, `dev:changed` or an always-on watcher.
A missing binary or public-site timeout is **UNVERIFIED**, not PASS;
triage external failures without suppressing all other URLs.
Auth-protected and historical checkpoint links are intentionally outside
this routine external scan. Do not change service/network configuration
for a link review.

## Defined gates

- **G0 / foundation:** **npm run check:foundation** — structure,
  documentation references/frontmatter, boundaries and Node tests.
  Run for onboarding or relevant milestone, not every DEV CSS edit.
- **G1 / source:** **npm run check** — G0, Markdownlint, Prettier,
  root ESLint and root TypeScript. Admin lint is separate.
- **G2 / complete source/UI:** **npm run check:all** — G1, Node
  coverage (75% lines, 78% branches/functions), admin lint/build,
  and Vitest UI interactions. It is not a hardware acceptance.
- **G3 / physical release:** verify actual source on Samsung,
  owned process identity and listening interface, browser workflows,
  protected services before/after, rollback, error/unknown handling,
  service recovery and data integrity as relevant. Public ingress or
  migration needs additional explicit authorization.

A normal restart of the owner-approved **PocketHost DEV panel only**
is not a G3 public-product release. Vite HMR is preferred.
Existing Termux runit panel supervision (ADR-0014) does not grant
ownership of hosted sites or external processes. No automatic
package migration, global upgrades, WAN or foreign service control.

## Native evidence at historical SHAs

- Historical S22 M0: 196/196 Node and 18/18 scoped checks on an
  earlier source; 55/55 UI at 0f5291d7.
- Historical focused M1: UID/umask and TypeScript at 9fb7db9;
  ownership 3/3 at 22245f13; rollback plan 3/3 at 4fa08631.
- At 9b478177, Markdownlint was clean but Prettier failed on
  tests/quality/hosting-registry-restore.test.mjs (task
  pockethost-m0-m1-markdown-format-closeout-9b478177-20261109-v1).
  This is not a full current-source PASS.
- Final-source G1/G2 and fresh physical G3 for the newer main
  remain OPEN unless later **terminal** evidence explicitly closes
  each gate.

For full command/results chronology use the
[historical M0/M1 checkpoint](checkpoints/2026-11-09-m0-m1-complete-checkpoint-next-chat.md),
[latest M1 details](checkpoints/2026-11-09-m0-m1-ownership-and-canonical-style.md),
and [checkpoint archive](checkpoints/README.md).
The pre-cleanup extended quality ledger is recoverable from Git
history at 685daea477ab5e4de63e8bd99bf20c10c7647bd9.

## Mandatory invariants

Discovery is not ownership. A host command requires a typed, explicitly
authorized target and scope; unknown PID/start identity fails closed.
Use negative tests for traversal, symlink, stale revision/owner,
service collision, interrupted operation, secrets and rollback where
applicable. External CLI reuse needs version/license/Termux evidence,
not just an upstream feature claim. Full physical backup/restore
cannot be proven by a source unit test. See
[reuse decisions](UPSTREAM_REUSE_STRATEGY.md) and
[host security boundaries](SECURITY_MODEL.md).
