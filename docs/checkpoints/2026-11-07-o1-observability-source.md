---
status: source-candidate-device-qa-pending
owner: core
last_reviewed: 2026-11-07
purpose: O1 observational MVP source, task evidence and release holds
---

# PocketHost O1 — Observability source checkpoint

## Source commits

- Baseline: `main@9aa07b1ceba0e308bee6deaa1ab794919c044f18`.
- Collectors, pure aggregation and negative tests: `ec5198e`.
- Loopback GET API, React dashboard and event redaction: `7f14640`.
- Linux stat fixture correction: `19eaa36`.
- Global npm/pip package inventory and tests: `6680b4e`, `2129d43`.
- Documentation updates: this checkpoint commit. Fetch fresh `main`
  for its full immutable SHA; do not assume the last source SHA is final.

## Actual delivered source candidates

- O1.1: bounded CPU delta, memory/storage from the existing host API,
  sysfs battery, network byte counters and six fixed runit statuses.
  Permission denial and unavailable data are explicit.
- O1.2: bounded (maximum 96 entries) partial `/proc` inspection with
  PID, PPID, start ticks, CPU ticks, optional RSS, and only self or
  unverified ownership. PID reuse never grants a signal capability.
  Per-process CPU percentage and exhaustive Android enumeration are
  not yet supported.
- O1.3: sanitized consumption of the existing structured PhotoMap
  TEST runtime event log; no PhotoMap process launch or recovery.
  Persistent cross-runtime diagnostics remain future work.
- O1.4: fixed shell-free Termux package queries, global npm and pip
  read-only inventory; cached apt upgrade hints are unverified.
- O1.5: `/observability` in existing React admin; CPU history
  (36 manual-request samples), overview metrics, service states,
  process and package tables, alerts and runtime event list.
  Backend is GET-only, loopback/dev-only, without background sampling.

## Real device evidence and tasks

- Earlier accepted application baseline:
  `pockethost-claim-final-clean-native-gate-bc5e55-20261107-v1`,
  101 Node and 16 admin tests PASS on an older source SHA;
  **not evidence for O1 source**.
- The previous O1 documentation/shell planning QA task
  `pockethost-o1-setup-native-docs-gate-9aa07b1-20261107-v1`
  returned done/0: structure, docs, Markdownlint, Prettier,
  boundaries and types PASS, checkout clean, PhotoMap 8010 closed.
  This was before O1 collectors.
- New preflight
  `pockethost-o1-readonly-preflight-20261107-0301-v1`
  failed admission with `invalid_task_file`: finalization reserve
  exceeded its task timeout. **No command executed.**
- Corrected preflight:
  `pockethost-o1-readonly-preflight-20261107-0304-v2`:
  **done/0 PASS**, checkout clean, 6/6 protected runit services
  running, port 8010 closed. Samsung: Node 26.4.0,
  npm 11.19.0 and Python 3.14.6.
- First native source gate:
  `pockethost-o1-first-native-gates-19eaa36-20261107-v1`;
  source `19eaa369c85a5d841a9769842e95a1028dc8130a`.
  Failed closed with `main moved`; no tests were executed.
- Samsung source `f8672fd968691778d67651cd411336ad69463c66`:
  `pockethost-o1-final-native-checkall-f8672fd-20261107-v1`
  failed full gate at `npm test`: **107/108 PASS**; only old
  route-count expectation (35 instead of 36) failed. Structure,
  docs and boundaries PASSED. Later format, lint, types,
  coverage, admin build and UI tests were not reached.
- The same exact checkout performed live read-only O1:
  RAM 7271 MiB total, 2131 MiB free; storage accessible;
  36 accessible process records including one `self`;
  30 safe package entries; cached upgrade hints are
  unverified. CPU `unavailable`, battery and network
  `permission-denied` due Android restrictions.
  All six services were running before/after; 8010 closed,
  checkout clean. **Real device probes PASS, full gate FAIL.**
- `pockethost-o1-prettier-diff-f8672fd-20261107-v1`:
  done/0; formatter reported only four source/test files
  needing formatting. It restored and left QA checkout clean.
  Formatting changes and route-count regression were then
  prepared for a new exact-source quality run.
- **Final-HEAD full quality gate and browser acceptance
  are still pending in this intermediate checkpoint.**

## Safety and outstanding acceptance

No device service or package mutation is authorized by these commits.
The six foreign services and Local Agent must remain untouched.
PhotoMap TEST port 8010, P3 real Chromium keyboard/ARIA acceptance
and PRoot detached/reparented-descendant recovery remain release holds.

Next sprint starts from fresh main, reads corrected preflight and native
gate receipts, fixes source/format issues, then sends a fresh bounded
final-HEAD Samsung `npm run check:all` and a read-only live API
observation. Do not replay ambiguous tasks.
