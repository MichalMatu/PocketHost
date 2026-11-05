---
status: in-progress
owner: runtime
last_reviewed: 2026-11-05
purpose: Define initial P3 ownership-isolated single-site implementation, safety gates and required native acceptance
---

# P3 — Single Owned Test Site (implementation branch)

Source branch: `feat/p3-owned-site-v1-20261105`.

The first functional capability manages only the fixed `pockethost-demo` instance on loopback port **18787**, under the dedicated PocketHost-owned directory below Termux home `Projects/PocketHost-OwnedSites`. It cannot adopt, operate, restart or delete discovered services.

The host adapter alone implements filesystem operations, Node child process lifecycle, stable ownership marker (`id` + random instance + PID + Linux process start ticks + executable script path + exact cwd) and log reads. Runtime requires `ownership: pockethost` for every lifecycle action. The two safe site versions contain built-in static content; publish switches versions and rollback restores the previous content. No arbitrary archive upload, shell execution, user-specified port, document root or external ingress.

The Vite API is compiled behind `POCKETHOST_ENABLE_OWNED_SITE_DEV=1` and is **disabled by default**; enabling is a deliberate manual CLI action, never an autostart. Mutation requests require validated Host, loopback peer, same-origin `Origin`, an explicit `X-PocketHost-Intent: owned-demo` header, no request payload, and an allowlisted action. Read-only API retains existing protections. This is **not** production authentication.

## Acceptance before exposing P3 actions

- Native Termux Gate 0 / root TypeScript / admin build and lint on exact branch SHA.
- Native isolated tests: explicit creation, start, GET/HEAD, logs, switch version, rollback and verified stop. Port collision and forged/reused PID must fail closed. Test directories are allocated only under Termux's test temporary directory.
- Negative HTTP tests for foreign Host/Origin, missing action header, disabled flag, wrong method, arbitrary action and unexpected request body.
- Physical browser control testing when ADB/CDP is available; otherwise label as pending, not PASS.
- Do not enable the feature in the currently accepted preview or launch permanent server processes until all gates and manual host ownership checks are green. Existing IleStoi.pl and Local Agent remain untouched.

## Integration cross-reference (2026-11-05)

The initial P3 branch was incorporated into `sprint/p3-mvp-integration-20261105` at `99fa9a3`, together with the proven Gate 1 predecessor and real Base UI component interaction tests. The initially submitted P3 native lab attempts stopped before tests; no earlier P3 PASS is claimed. The candidate also fixes marker start-ticks parsing, log-line splitting and transfer-encoded body rejection. The [exact integrated quality checkpoint](2026-11-05-p3-mvp-integration-candidate.md) tracks the new Termux result and pending phone acceptance. Keep feature actions disabled until that gate is explicitly accepted.
