---
status: accepted
owner: core
last_reviewed: 2026-11-06
purpose: Current PocketHost handoff after accepted live P4 catalog and stopped PhotoMap import
---

# PocketHost — next-chat handoff

## Start protocol

Continue `MichalMatu/PocketHost` on **existing** `sprint/p3-mvp-integration-20261105`; check both actual current feature and `main` HEADs before any work (last observed `main` was `8378663725f10beacf9c527f194e7f568170284d`). Do **not** create branches, force push, invoke GitHub Actions or query their status, use Codex/ChatGPT Work, or execute project tests on Mac/ChatGPT Linux sandbox. Use **GitHub Connector + exact Samsung Termux Local Agent only**, retrieving the fresh host/installation identity from private `MichalMatu/local-agent` / `agent-control`; never assume an old host ID establishes current liveness.

Read `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY_GATES.md`, [ADR-0007](adr/0007-photomap-managed-instance-layout.md), [ADR-0008](adr/0008-photomap-p4-managed-catalog.md), [PhotoMap import closeout](checkpoints/2026-11-06-photomap-runit-autorestart-regression.md), and [P4 final checkpoint](checkpoints/2026-11-06-p4-managed-photomap-catalog.md). Read nearest host/runtime/sites/packages `AGENTS.md` before edits. Do a fresh **read-only** device/service preflight.

## Accepted state — do not repeat

- **P4 live deployment:** accepted terminal same-path cutover v3; P3 owned process and LAN preserved. The deployed QA code is `85a9634`, distinct from the prior exact source-test SHA `471fdfec`.

- **P0–P2:** foundation, fixed allowlisted host status of six external Termux services, React admin shell and user-accepted GUI are previously verified.
- **P3:** separate `pockethost-demo` static server with scoped owner-verified Start/Stop, sample release and one-use rollback, a manually launched admin on loopback and opt-in private trusted-LAN gateway. P3 preview is independently running and must not be replaced without guarded cutover.
- **PhotoMap TEST import:** `import-20261106` under `~/Projects/PocketHost-Managed`, from source Git `d49e94c9` plus original dirty edits. Original checkout and independent code backup preserved. SQLite, **2,196 media files** and 4.26 GB of copied data verified. PhotoMap runit/autostart disabled; port 8010 off. The old PhotoMap run script **still launches the old checkout**; never reuse it for a managed runtime.
- **P4 code:** `/managed-projects`, fixed GET-only `/api/v1/managed-photomap`, `ManagedPhotoMapHost`, explicit owner/schema/release/large-inventory guards, six allowlisted tool versions and four dependency lock hashes. Full native source gate at **`471fdfecfa8bf41f52ef1db198959ba94857c2ac`** passed with **51/51 Node tests, 62 Markdown documents, Prettier, ESLint, TypeScript, app lint/build and 6/6 UI tests**. Task: `pockethost-p4-closeout-final-native-quality-20261106-v1` (done/exit 0). Reuse these exact-SHA receipts; do not repeat accepted tests without a code change.
- **Independent native gates:** `pockethost-p4-closeout-real-import-adapter-20261106-v1` done/exit 0 (real owned manifest, 2,196 media, six tools, four locks, all write capabilities disabled). `pockethost-p4-closeout-live-readonly-preflight-20261106-v1` done/exit 0 (healthy owned P3 preview, six other services running, PhotoMap off). `pockethost-p4-closeout-obsolete-import-stage-cleanup-20261106-v1` done/exit 0 (removed **only** obsolete v1 failed import stage: 597,768,154 bytes). No duplicate cleanup.
- **Main:** not merged by the P4 sprint. The last source QA SHA is not the same as later **documentation-only** branch HEADs; always distinguish them.

## P4 live catalog — accepted

Samsung Local Agent task `pockethost-p4-same-root-guarded-cutover-20261106-v3` completed `done`, exit 0. The P4 application was deployed at source `85a9634978969c2c6c43ae7a1ab644fedeba3841` **in the original P3 admin checkout path**. JSON GET 200 with correct ownership/release, POST 405, forged Host/Origin 403, loopback and LAN all passed. The P3 demo retained its original owned script path, lifecycle and identical content; six unrelated services remained unchanged. PhotoMap stayed stopped with port 8010 off. A scoped P3 rollback record is preserved. Earlier cross-checkout failures were rolled back; do not replay them. See [P4 live checkpoint](checkpoints/2026-11-06-p4-live-panel-cutover.md).

## Accepted inert runtime code — after P4

Exact feature source `32c09f2c4a92b918f919f67570a27b0a7193ea9a` has **terminal Samsung native PASS** at `pockethost-photomap-runtime-native-final-gate-20261106-v4`: full root `npm run check` (60/60 Node, 64 Markdown, Prettier, ESLint, TypeScript) and targeted 9/9 runtime tests. The real imported PhotoMap was inspected; Start/Stop were correctly denied, port 8010 stayed off, all six external services stayed running. New typed port, runtime policy and host PRoot adapter are **inert**, not an approved running instance; don't rerun these tests without code changes. [Runtime checkpoint](checkpoints/2026-11-06-photomap-runtime-inert-native.md).

External PRoot `photomap-dev` is still unfrozen. CLI `proot-distro 5.10.3` has been inspected read-only; rootfs footprint/sessions require a separate observed receipt before a staged clone. Do not use old PhotoMap launch scripts or `proot-distro backup` if it could modify source permissions. **Next bounded gate:** controlled, owner-only versioned rootfs and SQLite working copy, verified separately on Samsung. No actual PhotoMap Start/Stop acceptance or app UI mutation endpoint yet.

## Next engineering sprint — isolated PhotoMap runtime MVP

1. Inspect the imported PhotoMap source, `scripts/termux-dev.sh`, Debian PRoot and backend/frontend configuration **read-only**; identify the exact Python dependencies, database, private/public media paths and port without leaking secrets.
2. Design a project-local, **isolated and versioned Debian PRoot/Python environment**, with immutable source release and independent data. Avoid shared global package changes or reusing the old checkout. Require explicit owner authorization before a real PhotoMap start.
3. Implement an owned host adapter behind a typed runtime port: exact project ID/root, PID + Linux start ticks + executable/cwd validation, fail-closed Stop, port-conflict/timeout checks, bounded redacted logs and explicit manual Start/Stop. No runit registration, autostart, arbitrary shell input or foreign PID/process-group management.
4. Validate on the physical Samsung through Local Agent: unit/negative tests, project-local dependencies, guarded temporary health smoke, explicit final stop, original data integrity, six unrelated services unchanged, IleStoi readiness, no Cloudflare/Raspberry Pi operations.
5. Only after runtime acceptance add **explicitly approved project-local package plans** and tested transactional restore of source + Python runtime + SQLite/migrations + media. No generic rollback button until the full recovery path is demonstrably safe. Generalize to more projects after PhotoMap succeeds, not before.

## Final handoff requirement

Keep `main`, IleStoi.pl, Local Agent, MQTT, SSH, tunnel, the live P3 owned site and Raspberry Pi PhotoMap untouched unless narrowly authorized. Every new checkpoint must cite a real terminal task result, exact source SHA, native test scope, no-autostart status, process ownership evidence and rollback/cleanup behavior. Do not repeat successful tests or re-copy the four gigabytes of imported data without a reason supported by new evidence.
