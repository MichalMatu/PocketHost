---
status: in-progress
owner: core
last_reviewed: 2026-11-06
purpose: Single next-chat entrypoint after P4 managed PhotoMap checkpoint
---

# PocketHost — handoff to next chat

## Execution rules

Continue the `MichalMatu/PocketHost` project **only with GitHub Connector and Samsung Termux Local Agent**. No Codex, ChatGPT Work, GitHub Actions (including status checks), Mac/Linux sandbox execution, new branches, force push or changes to unrelated services. Use the existing branch `sprint/p3-mvp-integration-20261105` unless separately authorized. At session start, read current `main` and branch HEAD; **never assume the recorded SHA is still current**. Revalidate the Samsung host and installation through the private `MichalMatu/local-agent` `agent-control` supervisor namespace, then run an explicitly bounded read-only preflight. Do not record installation IDs, secrets, personal IPs or process arguments in public documents.

Mandatory docs: `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY_GATES.md`, `docs/adr/0007-photomap-managed-instance-layout.md`, `docs/adr/0008-photomap-p4-managed-catalog.md`, `docs/checkpoints/2026-11-06-photomap-runit-autorestart-regression.md`, and `docs/checkpoints/2026-11-06-p4-managed-photomap-catalog.md`. Read the nearest host/runtime/sites/packages agent contracts before editing them.

## Durable state at handoff

- P0 foundation, P1 host/6-service monitoring, P2 React dashboard, P3 manually launched owned static demo and owner-approved trusted-LAN gateway all have prior native acceptance records. The P3 demo is **not** PhotoMap.
- PhotoMap TEST on Samsung was copied into `~/Projects/PocketHost-Managed` as stopped release `import-20261106`; source, backups, SQLite (19,574,784 bytes) and 2,196 images are independently preserved. Original PhotoMap checkout (Git `d49e94c9` plus dirty edits) remains intact. No autostart or listener on port 8010. The import task `pockethost-photomap-managed-import-copy-20261106-v2` is **done / exit 0**. This is **not** a runtime image or full-instance rollback.
- P4 source candidate on the existing feature branch includes `/managed-projects`, read-only GET `/api/v1/managed-photomap`, fixed ownership/manifest validation, dependency versions/lock SHA-256 and disabled capability flags. `main` was still at `8378663725f10beacf9c527f194e7f568170284d` when last checked; obtain fresh HEADs.
- Native preflight `pockethost-p4-photomap-preflight-20261106-v2`: **done / exit 0**, runtime flags false, runit registration absent and port 8010 free.
- QA historical result `pockethost-p4-photomap-rapid-native-diagnostics-20261106-v1`: **50/50 Node foundation PASS**, Markdownlint **61 documents, 0 errors**; Prettier flagged three files. No full latest-SHA quality PASS or guarded live P4 panel deployment should be inferred from that result.
- Source contains a guard for large hashed media inventories (actual data manifest stores 2,196 per-file entries), which must be covered by final native tests.

## Next engineering milestone: isolated PhotoMap runtime MVP

Do **not** begin before the P4 remaining quality/deployment gate is closed or explicitly accepted as a documented blocker.

1. Inspect the imported run script and Termux Debian PRoot layout **read-only**. It still refers to the original PhotoMap checkout; never execute it verbatim for the managed instance.
2. Design an exact, per-project **immutable source and isolated Python dependency runtime** using real managed paths. Verify backend config, database URL, public/private media mappings, frontend outputs and port usage without copying secrets to Git.
3. Add a typed managed-runtime adapter behind `host`, with strict owner record, PID + Linux start ticks + executable/cwd validation, fail-closed stop, port collision checks, timeout/bounded sanitized logs, explicit manual Start/Stop and cleanup. **No runit autostart**, arbitrary shell commands or process-group kills without verified ownership.
4. Physical Samsung gates: read-only preflight, isolated test fixtures, native tests incl. negative identity/path/port/startup cases, guarded temporary manual start, health and UI checks, explicit stop, compare six unrelated services and IleStoi readiness. Never touch production Raspberry Pi.
5. Only after owned runtime works, propose **project-local package update plans** with explicit approval, and transactionally restorable **code + Python environment + SQLite/migrations + media** snapshots. Do not claim rollback before testable end-to-end restore.
6. Generalize beyond the PhotoMap adapter only after its real acceptance; avoid premature multi-tenant infrastructure or AI/DNS/WAN work.

## Cleanup and safety debt

The failed original managed import left a separate v1 staging root (approx. 598 MB), and isolated P4 QA clones may remain on Samsung. They are **not** part of the live managed release. Never delete unverified directories; scoped cleanup may be performed only after checking exact path, expected ownership and no active process references. Never remove PhotoMap backups, originals, the current managed root, installed runtime dependencies, the active PocketHost preview, or Local Agent directories.

## Release criterion

Every checkpoint must record: actual current Git SHAs, terminal Local Agent task IDs and exit codes, native root `npm run check`, `admin:lint`, `admin:build`, `test:ui`, live GET 200 / POST 405 / forged Origin and Host 403 for the catalog, six-service state comparison, manual-launch and no-autostart facts, untouched original data and an exact rollback plan for code changes. If any gate is missing, label **HOLD**, not DONE.

## Outstanding checkout gates

The final P4 code snapshot before closing this chat is `471fdfecfa8bf41f52ef1db198959ba94857c2ac`; verify fresh HEADs when resuming. Documentation-only commits can follow that source snapshot. The Samsung native formatting task `pockethost-p4-closeout-format-current-20261106-v1` finished `done / exit 0` and its approved formatting changes were committed.

**Four terminal receipts must be checked before repeating or extending any action:** `pockethost-p4-closeout-final-native-quality-20261106-v1`, `pockethost-p4-closeout-live-readonly-preflight-20261106-v1`, `pockethost-p4-closeout-obsolete-import-stage-cleanup-20261106-v1`, and `pockethost-p4-closeout-real-import-adapter-20261106-v1`. They were pending at the last read. Do not guess completion, reissue the same device mutation or clean more filesystem paths. If final QA is green, complete the remaining guarded HTTP/browser acceptance before merging or starting a live runtime sprint. If it is not green, fix only the evidenced failing gate and rerun at a new pinned SHA.

No current P4 admin preview cutover was executed in the prior chat; P3 services are intended to remain running unchanged.
