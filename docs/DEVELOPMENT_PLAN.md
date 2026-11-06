---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Define staged delivery with phase gates
---

# Development Plan

## P0 — repository foundation (Gate 0 accepted; Gate 1 accepted on its exact branch)

**Execution contract:** All PocketHost coding-command execution, dependency installation, compilation and validation run on Termux through the installed Local Agent (the existing host-command lane; no project binding required). The [fast-start runbook](LOCAL_AGENT_TERMUX.md) is the source for dispatch and evidence; no Mac/sandbox fallbacks.

Create docs index, ADRs, owner module instructions, manifest-controlled layout, guardrail tests, formatting/lint/type configurations and first checkpoint. No application code and no host modifications. **Exit:** Gate 0 passes and Gate 1 tooling is configured; lockfile/dependency verification tracked if registry unavailable.

## P1 — real Termux inventory (read-only; first vertical slice accepted)

Build and test the typed fixed-allowlist Termux host snapshot with `runit` service states for IleStoi.pl and surrounding external services. Integrate the new `/host` route into the existing full admin template while preserving all 32 upstream screens. The first endpoint is **GET-only and DEV-only** on loopback, with no external service control. **Exit (first vertical slice accepted):** on-device 18/18 tests, Vite build, lint and HTTP/API negative-method/origin checks PASS. The user confirms the panel looks good. Further read-only diagnostics and full root Gate 1 remain follow-up work. Real Android Chrome confirmed navigation across 31 concrete non-redirect routes, functional pinch zoom and subsequent six-control PocketHost branding/upsell smoke; detailed E2E accessibility remains future work.

**P1.1 accepted on real Android Termux:** Local Agent private supervisor and Termux-home filesystem capacity are now visible on the same `/host` page. **21/21 tests, app lint and build PASS**; GET 200, POST 405, foreign Origin 403, forged Host 403; six fixed external services observed. See [P1.1 accepted checkpoint](checkpoints/2026-11-05-host-health-work-start.md).

## P2 — local GUI

Launch a desktop-first dashboard manually by CLI, ideally using the **entire** pinned ShadcnStore Vite React admin template (all routes/screens retained initially), then adapting features in later sprints, retaining browser-native pinch zoom on Android. Display inventory, detected settings, ownership and service health. UI binds loopback, no login exposed over WAN. **Exit:** user can inspect existing server and nothing can stop it.

**P2 UI branding accepted:** Remove upstream Pro upgrades, promotional banners, provider links and fake provider user profile from the rendered shell without deleting the 32 demo routes. Keep responsive mobile behavior and native pinch. Real Termux 26/26 tests, Vite build, ESLint, guarded HTTP cutover and Android Chrome UI smoke PASS. This is a standalone MIT React frontend and **does not require a third-party account**; see [commercial UI checkpoint](checkpoints/2026-11-05-commercial-template-cleanup.md).

**P2 appearance acceptance:** Header theme selector consolidates Light/Dark/System, colors, layout and reset. Removed floating cog. Initial Base UI menu-group runtime error was repaired in `0645ee2` and the owner confirmed the panel works. 31/31 latest native tests, app ESLint, build and guarded HTTP restart PASS. The latest independent Android UI interaction CDP test is pending because ADB was disconnected. See [full P0–P2 checkpoint](checkpoints/2026-11-05-pocket-host-full-checkpoint.md).

**P3 prerequisite result:** native root Gate 1 and reproducible root lockfile PASS at exact `93cba36b` (receipt `pockethost-root-gate1-published-native-20261105-v1`). Actual Base UI interactions PASS in Termux jsdom at `3563512`. Both are integrated into a P3 candidate and require a fresh all-in-one gate on that candidate; Android Chrome acceptance is separate.

## P3 — PocketHost-owned server

A single isolated owned demo server and controls were implemented in `sprint/p3-mvp-integration-20261105`, with explicit start/stop, logs, sample version publication and one-use rollback. Native Samsung quality, guarded demo start and trusted-home-LAN gateway viewing were accepted; owner-confirmed Mac Chrome display and the read-only device health receipt are recorded in the [LAN checkpoint](checkpoints/2026-11-06-local-network-access.md). **The exact Mac browser publish/rollback click gate and merge to `main` remain separate release decisions.** The P3 static demo is intentionally distinct from PhotoMap.

## P4 — package catalog and assisted configuration

Add reviewed install plans, explicit approvals and safe diagnostics; installation is never implicit during discovery.

## P4.1 — managed PhotoMap catalog candidate (2026-11-06)

On `sprint/p3-mvp-integration-20261105`, P4 adds the first real stopped managed project: `photomap-test` with a typed validated registry, source release, database/media count, tool availability and project lock checksums. The DEV GET-only endpoint and `/managed-projects` panel passed **full native Samsung source quality** at `471fdfec` (51/51 Node tests, six UI tests, root lint/types/format/Markdown and admin build). **P4 live cutover accepted** on Samsung (`pockethost-p4-same-root-guarded-cutover-20261106-v3`): JSON GET and request-security negatives passed; P3 and six external services remained unchanged. PhotoMap runtime start/stop, PRoot isolation, package changes and whole-instance rollback remain disabled. See [ADR-0008](adr/0008-photomap-p4-managed-catalog.md).

## P4.2 — inactive PhotoMap runtime adapter (native accepted)

Samsung task `pockethost-photomap-disabled-marker-hardening-native-20261106-v1` accepted the exact code at `4e7f1c2`: **61/61 Node tests**, 65 Markdown documents, Prettier, lint and TypeScript PASS. The typed runtime port and host adapter reject foreign owners, forged paths and stale process markers, and the real imported instance refused Start/Stop. This is a source/negative-test gate, **not** permission to run PhotoMap. See [checkpoint](checkpoints/2026-11-06-photomap-runtime-inert-native.md) and [ADR-0009](adr/0009-photomap-isolated-runtime.md).

The independent Debian rootfs/source and SQLite work-copy stages still require distinct physical validation. No generic package or transactional rollback controls will be exposed before real restoration testing.

## P5 — AI deploy, domains and Android package

Add scoped publish API, site validation, version rollback, optional public ingress and packaging only after threat model, contract and device tests.

## Blockers

P0–P2 native acceptance, P3 single-site device hosting and the trusted-home-LAN gateway are documented. The P4 live catalog and inert PhotoMap adapter gates are accepted. Remaining blockers are owned Debian/Python runtime staging and a separate manual PhotoMap lifecycle acceptance on Samsung, P3 Mac browser mutation-button verification before merge, accessibility E2E and Local Agent boot-resilience qualification. A historical PASS at another SHA never substitutes for a current-source PASS.

## Current state and next bounded step — 2026-11-06

The **P3 LAN viewing milestone is accepted**: the real MacBook Chrome screenshots show the owning dashboard and hosted demo page without login, and independent Termux HTTP/security verification passed. See [LAN acceptance](checkpoints/2026-11-06-local-network-access.md).

**P3 release gate not yet closed:** browser interactions for `Switch sample version` and `Rollback version` have not been user-tested from the MacBook; never infer their browser behavior from visible controls. Keep the demo live at v1 and avoid merging until that acceptance and a fresh six-service snapshot are recorded.

**Current next step:** preserve accepted P4 live catalog and the 61/61 inert adapter gate, then verify the standalone Debian PRoot copy, stage a separate SQLite/source work set and qualify manual Start/Stop on the Samsung. Do **not** enable package updates or full rollback until dependency, database and media restoration is proven. Start with [P4 closeout](checkpoints/2026-11-06-p4-managed-photomap-catalog.md) and [next-chat handoff](HANDOFF_NEXT_CHAT.md).
