---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Resume PocketHost after Samsung-verified 62/62 source quality and inactive copied Debian/Python/SQLite PhotoMap staging
---

# PocketHost — next-chat handoff

## Exact start protocol

Continue **\`MichalMatu/PocketHost\`** on existing **\`sprint/p3-mvp-integration-20261105\`** only. First read the **actual** feature and \`main\` HEADs; do not assume a handoff SHA is still current. At checkpoint time, \`main=8378663725f10beacf9c527f194e7f568170284d\`, and last exactly source-tested feature code \`d5b559156becdc91a1f49e0ab2982d7c2c7f699f\`. Documentation commits after this source test have a later HEAD and do not represent a second device source QA.

**Execution:** GitHub Connector for code/docs and private control transport, **exact Samsung Termux Local Agent** for any Git/test/build/command execution. Re-read the actual private \`MichalMatu/local-agent\` \`agent-control\` host/installation identity, intake and task-results before sending commands; never assume that an old identity demonstrates live service health. No Codex, ChatGPT Work, GitHub Actions **or their status checks**, Mac/sandbox project tests, new branches, force-push or repeat of accepted tests.

Required reads: root \`AGENTS.md\`, \`docs/AGENTS.md\`, \`docs/LOCAL_AGENT_TERMUX.md\`, \`docs/README.md\`, \`docs/ARCHITECTURE.md\`, \`docs/DEVELOPMENT_PLAN.md\`, \`docs/QUALITY_GATES.md\`, [ADR-0007](adr/0007-photomap-managed-instance-layout.md), [ADR-0008](adr/0008-photomap-p4-managed-catalog.md), [ADR-0009](adr/0009-photomap-isolated-runtime.md), [new staged-runtime QA checkpoint](checkpoints/2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md), [import closeout](checkpoints/2026-11-06-photomap-runit-autorestart-regression.md), and nearest \`src/modules/host\` / \`src/modules/runtime\` \`AGENTS.md\` before changes. Begin with a **read-only** device/service preflight.

## Accepted work — do not repeat

- **P0–P2:** foundational checks, fixed allowlisted six-service host status, full React admin template with original routes, UI/branding and appearance acceptance. Read-only external inventory only.
- **P3:** PocketHost-owned static demo server and guarded Start/Stop, sample publication and one-use rollback, manual loopback admin and opt-in trusted private-LAN gateway. Existing P3 process and live state must be preserved. Browser visual acceptance on the Mac passed; **actual Mac publish/rollback button interactions remain open**.
- **PhotoMap imported TEST data:** owner-verified \`import-20261106\` with 2,746 release source files, original source Git \`d49e94c9\` plus preserved dirty edits, SQLite of **19,574,784 bytes**, 2,196 media files and **4,258,135,454 bytes** of imported data. Original checkout, independent original-code backup, and source/data are not to be changed or recopied. PhotoMap runit/autostart off; its old run script still launches the **original** checkout, never a managed instance.
- **P4 live read-only catalog:** \`/managed-projects\` and GET-only \`/api/v1/managed-photomap\` with disabled mutation capabilities. Earlier exact code gate \`471fdfec\`: 51/51 root Node, six UI tests, admin lint/build and format/types/docs PASS. Live same-path cutover \`pockethost-p4-same-root-guarded-cutover-20261106-v3\` **done/0**, deployed code \`85a9634\`, JSON GET 200, POST 405, forged Host/Origin 403, P3 identity/content preserved, six external services unchanged. **Do not replay earlier cross-checkout failed cutovers.**
- **Inert PhotoMap host/runtime code:** previous device gates \`32c09f2\` (60/60) and \`4e7f1c2\` (61/61) remain historical and accepted. Latest accepted source gate \`pockethost-photomap-worksource-final-native-20261106-v3\` at **\`d5b5591\`** is **done/0**: six host negatives passed, **62/62 root Node tests**, 65 Markdown files/zero errors, ESLint, TypeScript and Prettier. Port 8010 off; staged artifacts present. **No live PhotoMap process accepted.**
- **Existing inactive staged Debian and workset:** \`pockethost-photomap-managed-rootfs-stopped-stage-20261106-v1\` (done/0) and \`pockethost-photomap-isolated-rootfs-stage-20261106-v2\` (done/0) established **two differently named copies**: \`debian-arm64-v1\` and \`debian12-photomap-20261106-v1\`. The second rootfs is Debian 12.15, 14,118 files and 1,075 symlinks, and is paired with disposable \`work/source\` (2,746 files) and independent work SQLite (19,574,784 bytes, integrity \`ok\`) by \`pockethost-photomap-isolated-workset-stage-20261106-v1\` (done/0). **No media recopy**.
- **Isolated Python smoke:** \`pockethost-photomap-staged-debian-python-readonly-smoke-20261106-v2\` **done/0**: staged Debian Python **3.11.2**, all eight required Python distributions available (FastAPI, Starlette, Uvicorn, SQLModel, Alembic, Pillow, Mutagen, python-multipart). No installs, no PhotoMap launch, port 8010 off. Full details and exact receipts: [staging checkpoint](checkpoints/2026-11-06-photomap-isolated-rootfs-python-qa-closeout.md).

Failed tasks \`isolated-rootfs-stage-v1\`, \`worksource-guard-native-v1\`, \`worksource-final-native-v2\` and Python smoke \`v1\` were superseded by the passing task IDs above. Do not replay their side effects or treat them as unresolved quality regressions.

## Current HOLD, not a ready-to-start PhotoMap

The copied Debian and work database are ready for **further isolated validation**, not for runtime activation. \`debian12-photomap-20261106-v1\` is explicitly \`staged-unapproved\` (\`isolated_rootfs=false\`), with no \`runtime/active-version.json\`; imported \`runtime.json\` still has \`enabled=false\`, \`launch_allowed=false\`, \`managed_proot_snapshot=false\`, \`autostart=false\`. These are deliberate fail-closed guards.

**Specific code mismatch to resolve:** managed PRoot adapter launch plan currently requests \`/opt/pockethost-venv/bin/python\`; the real staged interpreter probe used \`/opt/photomap-venv/bin/python\`. Do not bypass the profile or modify flags to force a launch. Reconcile the launcher, pinned requirements/profile, version identity and \`/proc\` attestation in code and same-SHA negative tests first. Real HTTP health, PID ownership across PRoot, effective Stop, backend output, SQLite migration behavior and final post-stop status are **unverified**. \`server.py\` normally performs migration/recovery; never aim it at preserved imported SQLite.

The existing P3 static demo, IleStoi.pl, Local Agent, MQTT, SSH, tunnel, PhotoMap original/data, other six services and Raspberry Pi are out of scope for mutations. No new listening interface except an approved short-lived loopback smoke, no runit/autostart, no global \`pkg\` updates, no unverified PID kill or package install. PRoot is filesystem/dependency separation, not an OS sandbox.

## Recommended bounded continuation

1. Fresh read-only exact-host/installation preflight. Confirm source HEAD and clean isolated QA checkout, both stopped staged versions, working SQLite, manifest flags, free space, six unrelated services, P3 ownership, PRoot sessions and port 8010.
2. Resolve the version/profile/Python-path inconsistency using **one selected existing copy**, not a third duplicate. Add fail-closed owner/PID/start-ticks/cwd/executable/argv/port/timeout/Stop/child-process tests; validate code only through Samsung Local Agent and record exact SHA.
3. With separate explicit approval for this exact test, run one bounded **manual** PhotoMap health smoke against disposable source/SQLite only, then identity-verified graceful Stop, independent port 8010 off, no orphan and all services/P3 unchanged. Preserve a safe contingency if a process cannot be conclusively owned and stopped. No UI write endpoint yet.
4. After real lifecycle acceptance, design package installation and **whole-instance** recovery (source, Python environment, SQLite migrations, media); require demonstrated restore before enabling any package/rollback control.
5. Independently finish P3 Mac browser publish/rollback clicks, accessibility follow-up, a new device service snapshot, release checkpoint and explicit merge decision. P5 AI deploy/domain/API remains future scope.

## Next handoff rule

Preserve all passed task-results and their exact source SHAs. Every new checkpoint records terminal result ID, device-local commands/exit codes, code version, process ownership proof, recovery and explicit effects. Do not merge \`main\` while the P3 button gate or PhotoMap runtime release decision remains open. No additional PhotoMap Start/Stop acceptance is claimed by this handoff.
