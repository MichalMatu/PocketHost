---
status: accepted
owner: ui
last_reviewed: 2026-11-08
purpose: Fast DEV-only change and PocketHost panel review loop
---

# PocketHost DEV — Fast Iteration Runbook

## Working status

PocketHost is **DEV software**, served from Termux for its owner to
review. The running LAN administration page is an **existing DEV panel**,
not a customer production deployment. Do not set up a second preview
panel simply to make a menu or CSS change.

Use the loop **edit -> commit to current main -> small, relevant Samsung
check -> update existing PocketHost panel -> owner checks -> repeat**.
Small iterations are measured in visible features, not exhaustive
acceptance checklists. The owner has explicitly approved repeated
PocketHost-only refreshes/restarts for this DEV loop.

## Fast commands (run on Samsung Termux through Local Agent)

| Action | Command |
| --- | --- |
| Quick navigation/route contract | `npm run dev:quick` |
| Focused UI interactions | `npm run dev:ui -- tests/termux-center.interaction.test.tsx` |
| Manual PocketHost Vite start | `npm run dev:panel` |
| Start fast DEV UI GitHub watcher | `npm run dev:sync` |
| Check one GitHub UI update | `npm run dev:sync:once` |
| Verify sync path guard | `npm run dev:sync:test` |
| Final milestone or core change | `npm run dev:full` |

For ordinary CSS/copy/menu work, the owner can directly inspect the
updated DEV page; no compilation, full test suite, coverage or formal
G3 acceptance after **every** minor change. Run a small targeted check
when code behavior, routing or critical controls change. Full quality
gates belong to a significant milestone closeout or risky backend change.

## Update the existing panel, not a second environment

1. Verify current GitHub `main`, exact Samsung Local Agent installation,
   and the **PocketHost-owned** checkout and panel process identity.
   Reuse verified identity evidence where unchanged; avoid repeating
   comprehensive host preflight for each minor UI edit.
2. Sync the accepted source to the existing PocketHost DEV checkout;
   check the expected commit and any uncommitted modifications. Do not
   touch other checkouts or services.
3. If the existing Vite instance observes the changed UI files, use its
   normal **HMR/browser refresh**; do not restart merely for a TSX/CSS edit.
4. If a restart is actually required, stop **only** the exact verified
   PocketHost-owned panel process and restart using its existing manual
   launch configuration. Verify the same loopback/LAN origin is healthy.
   Keep a known-good source SHA for rollback. Never stop a process based
   solely on PID, port or name; verify recorded process start identity.
5. The owner reviews `/system`, `/files` or another changed route.
   Collect concrete feedback and perform the next small change.

No extra authentication ceremony, per-change owner confirmation,
artificially named production release, mandatory full G2/G3 matrix,
new work branch, new QA environment, or duplicate backend is needed
for a routine DEV-only panel iteration.

## Non-negotiable boundaries

PocketHost shares a Termux user with **other services and sites**.
The DEV label is not permission to kill, reconfigure or restart them.
Preserve Local Agent, IleStoi.pl, other hosted sites, their processes,
data and independent ports. Keep administrative access limited to the
existing trusted private LAN/loopback; do not create a WAN listener,
disable security checks, install packages, enable autostart or perform
state migrations just to speed up UX work. If a desired operation
cannot be executed by the available tools, state the limitation
instead of reporting a fictitious deployment.

## When to slow down

Use broader native gates and explicit review when changing host adapter
commands, package operations, filesystem boundaries, service control,
network exposure, persistent data migrations, or externally owned
processes. Do not describe a device result as passed until its actual
task receipt is available. Public/product release acceptance is separate
from owner review of the DEV panel.

## Fast GitHub to Samsung auto-sync (opt-in, 2026-11-08)

Start **one** watcher with `npm run dev:sync` in the existing PocketHost DEV
checkout while the existing Vite panel runs. Every eight seconds it fetches
`origin/main` and, only when the checkout is clean and the panel's recorded
PID/start-ticks/cwd match, updates the same working tree to that SHA.
Vite then picks up changed frontend files through HMR. No new panel process,
listener or service is created; there is no automatic runit/boot startup.
The watcher is manually started for a DEV session and can be stopped with
Ctrl+C (or Termux process management if started by the owner's Agent).

The unattended allowlist is `apps/admin/src/**`, `apps/admin/tests/**`,
`docs/**` and root text docs. Changes to `vite.config.ts`, package/dependency
manifests, host adapters, network rules, service controls, scripts or other
backend paths **pause automatic deployment** and return `MANUAL_REVIEW`.
Any conflict, dirty worktree, unknown remote, PID reuse, failed Git fetch
or interrupted checkout is a HOLD. The watcher never resets, kills processes,
runs tests, starts terminals, installs packages or changes LAN settings.

The first installation of this watcher is a one-time manual source sync by
the verified Local Agent. Later small UI-only commits flow automatically to
Vite, without another agent task or test matrix. Logs use JSON lines;
`SYNCED` contains the exact deployed SHA, `CURRENT` is a no-op,
`MANUAL_REVIEW` is not deployed, and `HOLD` means no verified update.
Keep normal full checks for milestone closeout.

## UX iteration — 2026-11-08

Monitoring formats memory/storage in binary GiB for large values and reserves
card space while loading. When system CPU counters are inaccessible on
Android, the UI shows available Termux process observations (process count
and cumulative CPU ticks) without misrepresenting them as system CPU
utilization. The Access info dialog explains Android restrictions and
Termux:API setup; it **never claims to grant system permissions**.

## Owner default LAN availability (2026-11-08)

The existing DEV PocketHost Vite session now automatically starts its
private-subnet LAN gateway (ports 18878/18879) when the Vite HTTP listener
starts. The browser can reach `/system`, `/dashboard` and `/shizuku`.
The address is selected from real private interfaces, preferring
`POCKETHOST_LAN_BIND` when it still belongs to the host and otherwise Wi-Fi.
To opt out for a session set `POCKETHOST_LAN_AUTOSTART=0` before start.
Only the PocketHost gateway is affected; this does not install a new
Termux:Boot entry or start the panel after a complete phone reboot.
Manual disable stays effective until the next PocketHost panel restart.
