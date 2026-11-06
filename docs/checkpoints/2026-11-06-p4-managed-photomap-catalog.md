---
status: accepted-with-follow-up
owner: core
last_reviewed: 2026-11-06
purpose: Final P4 source and physical import acceptance with explicit live deployment boundary
---

# P4 — managed PhotoMap TEST catalog checkpoint

## Completed scope

P4 adds **one real, privately imported, stopped project** (`photomap-test`) without assuming that a general-purpose managed runtime already exists.

- `src/shared/managed-project.ts`: typed managed-project snapshot, status and disabled capabilities.
- `src/modules/host/managed-photomap-host.ts`: fixed-path, fail-closed manifest reader with owner/schema/release matching, symlink and path guards, bounded large-media inventory, sanitized tool versions and lock SHA-256 values.
- `apps/admin/vite.config.ts`: loopback, same-origin **GET-only** `/api/v1/managed-photomap` endpoint with fixed Host/Origin/method rules.
- `apps/admin/src/app/managed-projects/page.tsx`: managed PhotoMap release, data counts, six tool statuses and four dependency locks. Existing 32 upstream routes, `/host` and P3 static demo remain independent.
- Start/Stop, package changes, autostart and whole-instance rollback are **not enabled** for PhotoMap.

The managed import `import-20261106` succeeded independently before P4 code work. It preserves **2,746 release source files**, **3,011 backed-up original-code files**, a **19,574,784-byte SQLite** and **2,196 media files** (total copied data **4,258,135,454 bytes**), all checked during the import. Original PhotoMap Git HEAD `d49e94c9` **plus dirty local edits** remains preserved. [Import forensic checkpoint](2026-11-06-photomap-runit-autorestart-regression.md).

## Exact physical Samsung evidence

The authoritative tested **source SHA** is `471fdfecfa8bf41f52ef1db198959ba94857c2ac` on `sprint/p3-mvp-integration-20261105`. Later commits altering only documentation do not change that code baseline.

| Private Local Agent task suffix                         | Result           | Evidence                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p4-closeout-final-native-quality-20261106-v1`          | **done, exit 0** | Pinned clean source, root `npm run check` **51/51 Node tests**, 62 Markdown files without errors, Prettier, ESLint, TypeScript, admin lint/build and **6/6 UI tests** PASS |
| `p4-closeout-live-readonly-preflight-20261106-v1`       | **done, exit 0** | Verified running P3 panel and demo, six external Termux services `running`, PhotoMap runit registration absent and port 8010 off                                           |
| `p4-closeout-real-import-adapter-20261106-v1`           | **done, exit 0** | Actual `ManagedPhotoMapHost.inspect()` recognized owned imported release, **2,196 media files**, **6 tools**, **4 locks** and all three mutation capabilities disabled     |
| `p4-closeout-obsolete-import-stage-cleanup-20261106-v1` | **done, exit 0** | Deleted **only** failed v1 partial staging, after validating exactly 1,780 files and 597,768,154 bytes against the accepted final release                                  |

All task names have prefix `pockethost-`; terminal receipts are stored in private `MichalMatu/local-agent` branch `agent-control`, under the exact Samsung installation. None of these P4 tasks started PhotoMap, modified global packages, registered autostart, changed Raspberry Pi production or stopped another service.

Earlier task retries were triggered by invalid timeout budgets, Git branch drift, a missing docs index entry, and three formatting errors. Those issues were resolved; their original terminal receipts remain available privately without being repeated as active blockers here.

## Explicit release boundary

**Accepted:** PhotoMap stopped import; P4 catalog source; native root/admin quality; actual managed manifest read; guarded cleanup; independent P3/six-service preflight.

**Not deployed:** The running P3/Vite admin preview was **not restarted or switched to P4**. A GET returning HTTP 200 for the new catalog path on the existing preview is not proof of P4 routing because Vite may serve its SPA fallback. P4 live acceptance still requires a guarded, reversible source update and **JSON schema/ownership GET 200**, POST 405 and forged Host/Origin 403, while preserving P3 owned process/script identity and all six external services. No production or trusted-LAN admin update was claimed.

**Not implemented:** Isolated Debian PRoot/Python dependency runtime, manual PhotoMap Start/Stop, project-scoped package changes, consistent SQLite/media restore, or entire-instance rollback. The old run script still targets the original checkout, and the imported PRoot remains `external-unfrozen`. Port 8010 and autostart stay off.

The repository `main` remained at `8378663725f10beacf9c527f194e7f568170284d` at the last check. No branch merge, new branch or force push occurred.

Resume from [HANDOFF_NEXT_CHAT](../HANDOFF_NEXT_CHAT.md) to finish the guarded P4 GUI gate and then develop an isolated PhotoMap runtime without repeating accepted imports or tests.
