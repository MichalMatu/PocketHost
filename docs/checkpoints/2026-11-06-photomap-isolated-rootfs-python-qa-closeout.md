---
status: accepted-with-follow-up
owner: runtime
last_reviewed: 2026-11-06
purpose: Record exact Samsung acceptance of staged Debian rootfs, independent PhotoMap workset, Python dependencies and the full source gate without approving runtime launch
---

# PhotoMap — staged Debian, Python and source QA closeout

## Decision

**Accepted:** existing project-local Debian rootfs copies, separate disposable source/SQLite workset, installed Python dependency inventory, and latest runtime adapter source quality. **Not accepted:** an active managed PhotoMap service, PID/health/Stop lifecycle, backend logs, migrations, transactional restore, package installation or UI mutation controls.

The source tested by the final quality task is **`d5b559156becdc91a1f49e0ab2982d7c2c7f699f`** on the existing `sprint/p3-mvp-integration-20261105` branch. At this checkpoint, `main` remained `8378663725f10beacf9c527f194e7f568170284d`. The source branch was 175 commits ahead of `main` and zero behind. This document and subsequent documentation-only commits have separate, later SHAs; do not present their HEAD as independently source-tested.

All execution evidence comes from real Samsung Termux Local Agent terminal task-results in private `MichalMatu/local-agent` / `agent-control`; **task publication alone is not a pass**. Fetch the exact host and installation afresh before further work.

## Accepted physical device receipts — do not repeat

- `pockethost-photomap-managed-rootfs-stopped-stage-20261106-v1`: **done, exit 0**, `ISOLATED_ROOTFS_STAGED_STOPPED`. Source rootfs inventory matched the clone, Python 3.11.2 ran inside the copied Debian, independent SQLite backup passed integrity and foreign-key checks, no media recopy, six monitored services unchanged and port 8010 off. The rootfs accounted for 14,118 files and 1,075 symlinks, 365.2 MiB of counted file data.
- `pockethost-photomap-isolated-rootfs-stage-20261106-v2`: **done, exit 0**, `MANAGED_ROOTFS_STAGED_INACTIVE`. The **separately named** version `debian12-photomap-20261106-v1` was copied from the stopped Debian 12.15 source. Inventory was 14,118 files, 1,075 symlinks and 382,969,964 counted bytes; source was unchanged, inventory and critical file hashes matched, port 8010 and PRoot session stayed off, no autostart.
- `pockethost-photomap-isolated-workset-stage-20261106-v1`: **done, exit 0**, `WORKSET_STAGED_INACTIVE`. This same `debian12-photomap-20261106-v1` has a separate disposable `work/source` (2,746 files, 603,101,519 counted bytes), a separate SQLite work copy (19,574,784 bytes, `integrity_check=ok`), and empty work media directories. Original SQLite was verified unchanged and **zero** of the 2,196 preserved media files were recopied.
- `pockethost-photomap-worksource-final-native-20261106-v3`: **done, exit 0**, `SOURCE_BIND_NATIVE_PASS` at exact `d5b5591`. The host negative suite passed **6/6**; root `npm run check` passed **62/62 Node tests**, **65 Markdown files, zero errors**, Prettier, ESLint and TypeScript. Verified existing staged rootfs, work source and SQLite, and port 8010 off. The work-source bind protection prevents mounting the preserved imported source as the guest writable source.
- `pockethost-photomap-staged-debian-python-readonly-smoke-20261106-v2`: **done, exit 0**, `STAGED_PYTHON_READONLY_PASS`. The existing copied Debian interpreter returned Python **3.11.2**, with FastAPI 0.139.0, Starlette 1.3.1, Uvicorn 0.34.0, SQLModel 0.0.22, Alembic 1.14.0, Pillow 12.2.0, Mutagen 1.47.0 and python-multipart 0.0.31. No installation or PhotoMap launch occurred; version was inactive, source/work DB were present and port 8010 off.

The earlier **405.2 MiB** was a filesystem footprint measured before copying; the 365.2 MiB and 382,969,964-byte values above are file inventory measurements, not conflicting promises of an identical disk-usage metric. Neither rootfs is a new full security boundary: PRoot still shares the Termux OS user.

## Failed attempts — resolved or non-executed

- Initial rootfs stage v1 rejected a wrong Python location before copying; corrected rootfs stage v2 passed.
- `pockethost-photomap-worksource-guard-native-20261106-v1` detected a Prettier-only difference after its 6/6, lint and type checks passed; source formatting was corrected in `d5b5591`.
- Worksource-final v2 stopped on a faulty QA dirty-tree guard, **before** tests; corrected v3 passed.
- The first Python read-only smoke v1 was rejected with `task_budget_exhausted`, **not started**; corrected v2 passed.

Do not treat these historical failed task IDs as current source failures or rerun them. Do not overwrite or recopy either successful staged version just to reproduce a receipt.

## Code and configuration audit — remaining safety gates

- `src/shared/photomap-runtime.ts`, `src/modules/runtime/photomap-runtime.ts` and `src/modules/host/photomap-runtime-host.ts` enforce the fixed owned instance, port, release, fail-closed disabled markers, path/symlink guards, and PID/start-ticks/executable/cwd/argv checks. These checks passed **source and negative tests**, not a live managed PRoot lifecycle.
- The staged **`debian12-photomap-20261106-v1`** profile is intentionally `staged-unapproved` and reports `isolated_rootfs=false` for activation policy, while `active-version.json` is absent and the imported `runtime.json` still has `enabled=false`, `launch_allowed=false`, `managed_proot_snapshot=false` and `autostart=false`. **Never flip these fields merely to obtain a passing Start.**
- The other version, **`debian-arm64-v1`**, is an independently staged stopped clone with its own SQLite copy. It must not be silently merged with or substituted for the tested `debian12-photomap-20261106-v1` workset.
- Source host launcher currently names `/opt/pockethost-venv/bin/python`, while the physical interpreter probe ran `/opt/photomap-venv/bin/python`. Reconcile the exact executable path, working directory, dependency manifest and staged release contract **in code and negative tests** before any launch.
- Current launcher uses a fixed `uvicorn server:create_app --factory` entrypoint. PhotoMap's normal `server.py` path performs migration and recovery side effects. Review import/config/SQLite behavior against the **working** DB only; no live health, child-process ownership or guaranteed cleanup has been demonstrated. The event log is not yet captured application stdout/stderr.
- Do not infer preserved-media readability from an empty work media tree. An initial health-only smoke may use that empty tree if explicitly approved; data-backed PhotoMap acceptance is a separate gate.
- No new public listener, runit registration, package mutation, external process stop, Cloudflare change or Raspberry Pi action is allowed. P3 preview, six external Termux services and original/backup PhotoMap artifacts remain outside this runtime's ownership.

## Next bounded work and release HOLD

1. Fresh **read-only** Samsung preflight: exact agent identity/intake, both rootfs version manifests, independently copied SQLite, current Git SHAs/clean checkout, P3 ownership, six external services, storage headroom, PRoot sessions and port 8010. Preserve both copies and all historical receipts.
2. Choose one versioned runtime explicitly; align the actual Python executable, interpreter/dependency checks, profile hashes, source bind and activation contract. Add negative tests for owner/cwd/argv/PID reuse, port collision, failed launch, orphan handling and strict Stop; run them **only on Samsung** through Local Agent.
3. Separately authorize a **single manually bounded** live PhotoMap Start/health/Stop on the isolated working source and SQLite, with guaranteed safe recovery, exact process attestation and a final independent port-8010-off and service-health readback. No autostart.
4. Only after that: project-local package plans and actual restoration of source, Python runtime, SQLite/migrations and media; verify rollback before exposing general controls.
5. P3 Mac browser **publish/rollback button click** acceptance, UI accessibility follow-up, final checkpoint and decision about merging `main` are independent release holds.

**Overall:** staged environment + same-SHA source QA PASS; PhotoMap lifecycle/release HOLD. See [ADR-0009](../adr/0009-photomap-isolated-runtime.md), [quality gates](../QUALITY_GATES.md) and [handoff](../HANDOFF_NEXT_CHAT.md).

## Subsequent exact-source negative gate — 2026-11-06

Samsung task `pockethost-photomap-python-contract-final-samsung-20261106-v2` finished **done / exit 0** at source `a5443070f1c6e41798641aa9c2098a9acc9e17a4`.
The guest PRoot launch plan now names the independently observed `/opt/photomap-venv/bin/python`, and the host adapter requires additional explicit `approved-manual`, `launch_allowed`, `activation_approved` and exact interpreter profile controls. The isolated host negative tests passed **9/9**; full `npm run check` passed **65/65 Node tests**, **66 Markdown files with zero errors**, Prettier, ESLint and TypeScript. The task independently verified that port 8010 remained OFF.

The earlier `pockethost-photomap-guarded-python-contract-native-20261106-v1` task found an ESLint `no-regex-spaces` violation although its 65/65 tests passed. A test-only regex quantifier change at `a5443070` resolved it. Do not repeat these accepted tests without a code change.

**Still open:** the inactive staged profile is *not* approved for activation; no live PhotoMap process, precise PRoot child PID attestation, real HTTP health/Stop, backend log capture, full rollback, package mutations or browser lifecycle controls were accepted. Preserve both copied Debian versions, original SQLite/media and the running P3/six foreign services. The next hardware gate must be scoped and fail-closed.
