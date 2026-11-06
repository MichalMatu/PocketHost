---
status: accepted
owner: core
last_reviewed: 2026-11-06
purpose: Single authoritative PocketHost next-chat handoff after P4 native code and PhotoMap stopped import
---

# PocketHost — next-chat handoff

## Start protocol

Continue `MichalMatu/PocketHost` on **existing** `sprint/p3-mvp-integration-20261105`; check both actual current feature and `main` HEADs before any work (last observed `main` was `8378663725f10beacf9c527f194e7f568170284d`). Do **not** create branches, force push, invoke GitHub Actions or query their status, use Codex/ChatGPT Work, or execute project tests on Mac/ChatGPT Linux sandbox. Use **GitHub Connector + exact Samsung Termux Local Agent only**, retrieving the fresh host/installation identity from private `MichalMatu/local-agent` / `agent-control`; never assume an old host ID establishes current liveness.

Read `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY_GATES.md`, [ADR-0007](adr/0007-photomap-managed-instance-layout.md), [ADR-0008](adr/0008-photomap-p4-managed-catalog.md), [PhotoMap import closeout](checkpoints/2026-11-06-photomap-runit-autorestart-regression.md), and [P4 final checkpoint](checkpoints/2026-11-06-p4-managed-photomap-catalog.md). Read nearest host/runtime/sites/packages `AGENTS.md` before edits. Do a fresh **read-only** device/service preflight.

## Accepted state — do not repeat

- **P0–P2:** foundation, fixed allowlisted host status of six external Termux services, React admin shell and user-accepted GUI are previously verified.
- **P3:** separate `pockethost-demo` static server with scoped owner-verified Start/Stop, sample release and one-use rollback, a manually launched admin on loopback and opt-in private trusted-LAN gateway. P3 preview is independently running and must not be replaced without guarded cutover.
- **PhotoMap TEST import:** `import-20261106` under `~/Projects/PocketHost-Managed`, from source Git `d49e94c9` plus original dirty edits. Original checkout and independent code backup preserved. SQLite, **2,196 media files** and 4.26 GB of copied data verified. PhotoMap runit/autostart disabled; port 8010 off. The old PhotoMap run script **still launches the old checkout**; never reuse it for a managed runtime.
- **P4 code:** `/managed-projects`, fixed GET-only `/api/v1/managed-photomap`, `ManagedPhotoMapHost`, explicit owner/schema/release/large-inventory guards, six allowlisted tool versions and four dependency lock hashes. Full native source gate at **`471fdfecfa8bf41f52ef1db198959ba94857c2ac`** passed with **51/51 Node tests, 62 Markdown documents, Prettier, ESLint, TypeScript, app lint/build and 6/6 UI tests**. Task: `pockethost-p4-closeout-final-native-quality-20261106-v1` (done/exit 0). Reuse these exact-SHA receipts; do not repeat accepted tests without a code change.
- **Independent native gates:** `pockethost-p4-closeout-real-import-adapter-20261106-v1` done/exit 0 (real owned manifest, 2,196 media, six tools, four locks, all write capabilities disabled). `pockethost-p4-closeout-live-readonly-preflight-20261106-v1` done/exit 0 (healthy owned P3 preview, six other services running, PhotoMap off). `pockethost-p4-closeout-obsolete-import-stage-cleanup-20261106-v1` done/exit 0 (removed **only** obsolete v1 failed import stage: 597,768,154 bytes). No duplicate cleanup.
- **Main:** not merged by the P4 sprint. The last source QA SHA is not the same as later **documentation-only** branch HEADs; always distinguish them.

## First remaining gate — P4 live catalog

**The existing P3 admin panel was deliberately left unchanged.** Before P4 is considered deployed, plan a **guarded and reversible** panel code cutover that preserves the P3 owned demo's exact script path and process-identity checks; the live preview/source record may have changed independently. Verify owner PID/start ticks, six external services, both working loopback/LAN paths and restoration plan. After cutover require **actual JSON** `GET /api/v1/managed-photomap` response with owner `pockethost` and release `import-20261106`, POST 405, forged Host/Origin 403, P3 ownership/lifecycle intact and PhotoMap still OFF. Do not count an arbitrary Vite SPA fallback HTTP 200 as a passing API gate. If any guard fails, keep P3 intact and label the live P4 gate HOLD.

## Next engineering sprint — isolated PhotoMap runtime MVP

1. Inspect the imported PhotoMap source, `scripts/termux-dev.sh`, Debian PRoot and backend/frontend configuration **read-only**; identify the exact Python dependencies, database, private/public media paths and port without leaking secrets.
2. Design a project-local, **isolated and versioned Debian PRoot/Python environment**, with immutable source release and independent data. Avoid shared global package changes or reusing the old checkout. Require explicit owner authorization before a real PhotoMap start.
3. Implement an owned host adapter behind a typed runtime port: exact project ID/root, PID + Linux start ticks + executable/cwd validation, fail-closed Stop, port-conflict/timeout checks, bounded redacted logs and explicit manual Start/Stop. No runit registration, autostart, arbitrary shell input or foreign PID/process-group management.
4. Validate on the physical Samsung through Local Agent: unit/negative tests, project-local dependencies, guarded temporary health smoke, explicit final stop, original data integrity, six unrelated services unchanged, IleStoi readiness, no Cloudflare/Raspberry Pi operations.
5. Only after runtime acceptance add **explicitly approved project-local package plans** and tested transactional restore of source + Python runtime + SQLite/migrations + media. No generic rollback button until the full recovery path is demonstrably safe. Generalize to more projects after PhotoMap succeeds, not before.

## Final handoff requirement

Keep `main`, IleStoi.pl, Local Agent, MQTT, SSH, tunnel, the live P3 owned site and Raspberry Pi PhotoMap untouched unless narrowly authorized. Every new checkpoint must cite a real terminal task result, exact source SHA, native test scope, no-autostart status, process ownership evidence and rollback/cleanup behavior. Do not repeat successful tests or re-copy the four gigabytes of imported data without a reason supported by new evidence.
