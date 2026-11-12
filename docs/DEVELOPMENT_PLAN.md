---
status: active
owner: core
last_reviewed: 2026-11-12
purpose: Short execution plan that implements the canonical roadmap without duplicate history
---

# PocketHost Development Plan

## Operating rhythm

Use fresh main and [FAST FLOW](DEV_ITERATION.md): change one
coherent component, run only mapped Node/Vitest and applicable
lint/type checks on verified Samsung Termux Local Agent, preserve
caches, and use existing Vite HMR. Do not rerun successful unrelated
suites, install packages repeatedly, create duplicate environments
or treat task publication as PASS. Close a milestone with its
remaining G1/G2 and separate physical G3 evidence.

## Active development path — two Hosting tasks

**[ROADMAP](ROADMAP.md) is authoritative.** Deliver full **Basic**
functionality inside official Termux; Pro is an optional technical
extension relying on external Android applications, **not** a paid
tier or a restricted Basic. Freeze Companion/Shizuku development and
defer one-APK I0–I4. Do not reorder the existing menu yet.

1. **Node.js Hosting + GitHub (P0):** build on existing M0/M1
   identities, M2 runit/backup and M3 staging/project candidates.
   Close one disposable end-to-end browser flow: create/import from
   files or GitHub, inspect manifest/lockfile and dependency plan,
   install/build on explicit approval, own the process and port,
   start/stop, readiness/logs, update and last-good rollback.
   No duplicate supervisor, installer or service registry.
2. **Hosting panel integrations (P0):** finish Cloudflare
   Tunnel/domains/HTTPS, SSH controls, project files and terminal,
   **per-project web traffic** analytics (not Android RX/TX),
   and scoped backup/restore. Use official Termux CLIs and existing
   typed host adapters. Protect foreign tunnels, SSH, services and
   production workloads; keep admin UI private until authenticated.

**Static Hosting isolation rule:** H2 is already working and
remains a parallel, independent Hosting type. Do not refactor
or migrate its SiteFleetHost execution path as a prerequisite
for Node.js. Retain separate files/ports/processes/release
history; share only verified infrastructure interfaces and
panel components. Exercise H2 smoke/regression tests when
shared host contracts change, proving no cross-type
start/stop/update/rollback interference. See
[architecture](ARCHITECTURE.md) and [roadmap](ROADMAP.md).

After usable Hosting, prepare a versioned Termux PocketHost bundle
and a minimal one-command installer plus first-run panel flow. Test
installer assumptions early using disposable/isolated fixtures,
then run a clean Termux-to-public-site acceptance with failure,
rollback, restore and Android restart cases. No separate APK is
required for Basic.

**Immediate verification before more features:** the open
[repository repair](checkpoints/2026-11-12-general-repository-repair-continuation.md)
must receive an exact-SHA Samsung terminal receipt. Check pending
Local Agent tasks before queuing a duplicate; do not rerun historical
complete suites without a milestone reason. Physical Node Hosting
and public-ingress acceptance remain separate gates.

## Change discipline

- Source/UI ownership: [code map](CODE_MAP.md) and nearest AGENTS.md.
- Architecture contracts: [ARCHITECTURE](ARCHITECTURE.md) and
  [MODULES](MODULES.md); host filesystem/process work stays in host.
- Reuse: existing PocketHost, official Termux CLI and approved
  libraries before new framework; verify license/Termux support.
- Tests: dependent files first, negative host tests when touching
  privileges. No no-op formatting rewrites across unaffected files.
- Evidence: exact-SHA status, short failure excerpt and actionable
  next step in a checkpoint; **no duplicated chronological status**
  in ROADMAP, QUALITY_GATES or this plan.

See [current handoff](HANDOFF_NEXT_CHAT.md) for incomplete acceptance,
and [checkpoint archive](checkpoints/README.md) for previously
accepted older scopes. The old extended development chronology is
recoverable in Git history at 685daea477ab5e4de63e8bd99bf20c10c7647bd9.
