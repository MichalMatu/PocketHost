---
status: source-implemented-validation-open
owner: core
last_reviewed: 2026-11-09
purpose: Complete M0/M1 source, QA, physical safety and autonomous next-chat handoff
---

# PocketHost — M0/M1 complete checkpoint and next-chat handoff

## Authoritative scope and snapshot

- Repository: `MichalMatu/PocketHost`, **main only**; source snapshot at checkpoint preparation: `2b5d300fd63e825305415a97d25ef1278860984e`.
- Native development executor: the previously verified Samsung S22 Termux Local Agent; control transport is the **separate private** `MichalMatu/local-agent` repository on `agent-control`. PocketHost has **no** own `agent-control` branch or Agent project binding.
- This checkpoint is a source/documentation commit only. It does not certify that the phone is running the checkpoint SHA; it does not deploy, reboot, restart or modify any service.
- On resumption, get **fresh** main, control head and exact task results; a concurrently active chat may advance them. Never overwrite concurrent work or assume the SHA above is still HEAD.
- Decision: **M0 functional decoupling implemented, full G1/G2 and fresh physical acceptance OPEN; M1 first persistence slice implemented, post-refactor Samsung acceptance OPEN. No final milestone PASS.**

## Completed M0 source scope

1. H2 owned static websites, releases and file inventory separated from generic Termux/System Services, File Manager and Backups UI. Historical P3/PhotoMap routes remain compatible.
2. PhotoMap TEST event diagnostics moved out of generic observability into a bounded explicit legacy read-only endpoint; no launch or silent ownership.
3. Six historical host status aliases retained for wire compatibility and renamed generically in `src/modules/host/observed-service-catalog.ts`; each remains external-only. `TermuxServiceAdmin.list()` remains authoritative for actual generic runit inventory.
4. H2 bounded ZIP/folder import, immutable versions, rollback, owner markers and exact child PID/process identity guards preserved. No approved adoption of IleStoi, PhotoMap, SSH, tunnel or Agent.

## Native Samsung QA — exact evidence, no replay

| Task/source | Confirmed result | Unfinished qualification |
| --- | --- | --- |
| `pockethost-m0-final-source-checkall-s22-c97132c6-20261109-v1` / `c97132c6` | 196/196 Node, 18/18 focused host/PhotoMap, 18/18 scoped UI passed; isolated clean source. | Complete gate stopped on MD012 in handoff. |
| `pockethost-m0-post-docfix-fullqa-s22-05498852-20261109-v1` / `05498852` | 196/196 Node and structure/docs/boundaries passed; isolated clean source. | Markdownlint had five MD022/MD032 errors in three docs; downstream gate not reached. |
| `pockethost-m0-remaining-gates-s22-5bccbe2-20261109-v1` / `5bccbe2` | **PASS:** Markdownlint, root ESLint, TypeScript, coverage gate, admin ESLint, admin build; checkout remained clean and correctly pinned. | **FAIL:** Prettier check on nine files; complete UI suite showed four failures. Overall task `failed/1`, full source acceptance **OPEN**. |
| `pockethost-m0-remaining-gates-s22-5bccbe2b-20261109-v1` / `5bccbe2` | Request exists; **no terminal result observed** when checkpoint prepared. | Read durable result first. Do not submit duplicate run. |
| `pockethost-m1-registry-store-focused-s22-01db6f2-20261109-v1` / `01db6f2` | Request exists; **no terminal result observed**. | Older M1 store SHA predates module-boundary relocation and cannot certify current main. |
| `pockethost-m1-registry-boundary-focused-s22-2b5d300f-20261109-v1` / `2b5d300f` | Request exists; **no terminal result observed**. | Obtain exact terminal receipt before further tests. |

The nine files reported by the exact `5bccbe2` Prettier gate were
`docs/checkpoints/2026-11-09-m0-implementation-ui-separation-sprint.md`,
`docs/checkpoints/2026-11-09-m0-photomap-diagnostics-isolation.md`,
`docs/checkpoints/2026-11-09-m0-preimplementation-readiness.md`,
`src/modules/config/hosting-registry.ts`,
`src/modules/packages/node-dependency-plan.ts`,
`tests/quality/admin-preservation.test.mjs`,
`tests/quality/host-snapshot.test.mjs`,
`tests/quality/hosting-registry.test.mjs` and
`tests/quality/node-dependency-plan.test.mjs`.
Some of these files changed after `5bccbe2`; re-check current file state before editing.

The full UI failure tail includes `tests/system-dashboard.interaction.test.tsx`
(expected metric text `2,312 MiB`) and
`tests/termux-admin.interaction.test.tsx` (invalid/undefined rendered component).
Those observations alone do not establish root causes or the precise other two
failures; retrieve a focused native failure receipt before changing UI logic.

**No successful focused test is to be repeated merely to create a fresh counter.**
The exact `5bccbe2` PASS results cannot certify the later M1 code or new docs.
Use only missing/affected gates with exact source SHA, and maintain a distinct
final-source closure receipt if formal G2 is eventually required.

## M1 implementation — one store, not two

- `src/shared/hosting-platform.ts`: versioned module, service and project declarations, component references and opaque `SecretRef`.
- `src/shared/hosting-registry.ts`: pure bounded `createHostingRegistries` validation: unique identifiers, planned services, positive origin, duplicate bindings, reserved/duplicate ports, stale module versions, opaque secret refs and schema checks.
- `src/modules/config/hosting-registry.ts`: compatibility re-export of shared pure validator; no host filesystem imports.
- `src/modules/host/hosting-registry-store.ts`: **single** opt-in revisioned private JSON store, caller-supplied canonical directory, explicit PocketHost owner envelope, file/link checks, exclusive writer lock, atomic replacement and stale-revision refusal. No implicit lifecycle rights.
- `tests/quality/hosting-registry.test.mjs` and `tests/quality/hosting-registry-store.test.mjs`: declarative and negative fixture coverage. Physical source QA after refactor is not yet confirmed.

Timeline: existing store at `0b5d397`, tests at `01db6f2`; duplicate store candidate `ff58f15` was removed at `895f90f`; one host-owned store and shared validation boundary established at `99957605`; module docs `673ed9a4`; handoff and heading cleanup through `2b5d300fd63e`.

**Not completed:** durable compatibility migration beyond v1, live admin/API bindings, positive host ownership attestation for new services, any runtime lifecycle operation, H2 project migration, M2 runit health/recovery orchestration, and M3 disposable Node.js Hosting end-to-end.

## Physical, service and release gates

Historical (earlier source, not current-SHA approval): PocketHost-owned panel supervision under **existing Termux runit** and private LAN `8787`/`18878` HTTP 200 were observed, with a controlled **panel-only** restart recovering in six seconds and six protected services still running. The real full-device reboot, watchdog hang/flap behavior and exact-current-source acceptance are separate OPEN gates.

Fresh M0 physical acceptance remains **OPEN**: exact-source phone deployment confirmation; disposable H2 Create/Start/Publish/HTTP/Rollback; strict owner and protected runit state comparison; LAN health; independent Agent continuity. Do not do any of these by touching external sites or services or by assuming historical receipts apply to new source. Do not restart the working DEV panel merely for documentation validation.

No unauthorized changes to IleStoi/PhotoMap/SSH/Cloudflare/Local Agent, no service adoption, no force-push, no new branch, no global package upgrades, no new supervisor, no WAN/public exposure, no GitHub Actions, no Codex, no ChatGPT Work; no executing PocketHost tests in Mac/Linux/ChatGPT sandbox. All PocketHost execution goes through the exact Samsung Termux Local Agent in a verified isolated clean QA checkout.

## Next-chat autonomous sequence

1. Fetch fresh `PocketHost/main` and private `local-agent/agent-control`. Read `AGENTS.md`, `docs/LOCAL_AGENT_TERMUX.md`, `docs/ROADMAP.md`, `docs/QUALITY_GATES.md`, this checkpoint and current handoff. Check any concurrently published commits before a write.
2. Inspect **all three outstanding task results** listed above (second `5bccbe2b`, original M1 store, refactored M1 boundary). Record terminal status and exact SHA; absence of a published result means **UNKNOWN**, not PASS or not-running.
3. For M0, fix only the confirmed Prettier issues that remain on fresh main. Diagnose the four failing full-UI cases with focused, native tests and change only their confirmed causes. Retain historical 196 + 18 + 18 PASS; do not blindly rerun them.
4. For M1, validate one shared validator / one host-owned file store with focused tests and module-boundary gate at the actual final code SHA. Preserve all existing negative guards. Do not wire new live APIs or adopt external runit services until this slice passes.
5. Obtain only missing exact-SHA lint/format/type/build/coverage/UI evidence necessary for formal M0/G2 closure. If failures persist, maintain `OPEN` with precise reasons; never falsify a green gate.
6. Separate source acceptance from deliberately scoped, owner-approved **disposable** physical H2 and protected-service checks. Observe before/after the six protected services and Agent independently. Do not touch production services, active sites or tunnel routing to fulfill a source gate.
7. After qualifying M1 persistence and positive ownership contracts, advance to the smallest M1 next slice (versioning/migration or explicit service attestation) with its own focused negatives and checkpoint. M2 shared execution/recovery and M3 Node.js remain separate milestones.

**Closeout rule:** checkpoint is complete as a handoff document; M0 source G1/G2, M0 physical G3 and M1 native acceptance are explicitly **OPEN**, not milestone PASS.
