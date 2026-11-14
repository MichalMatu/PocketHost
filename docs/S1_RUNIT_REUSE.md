---
status: in-progress
owner: core
last_reviewed: 2026-11-14
purpose: S1 termux-services source review and verified service enrollment boundary
---

# S1 — reuse upstream runit, do not build another supervisor

## Open-source decision

The upstream [termux/termux-services](https://github.com/termux/termux-services) already provides `service-daemon` with `runsvdir`, `sv-enable` / `sv-disable` and `svlogger`; see [README](https://github.com/termux/termux-services/blob/master/README.md), [sv-enable](https://github.com/termux/termux-services/blob/master/sv-enable), and [service-daemon](https://github.com/termux/termux-services/blob/master/service-daemon).

- Reuse the existing Termux packages and runit binaries on the Galaxy A8. Do **not** vendor, fork, reimplement, upgrade or replace them in S1.
- `sv` controls process liveness; `sv-enable` and `sv-disable` alter the `down` marker. These utilities **do not attest ownership**, readiness, application health, source revision or project membership.
- Termux:Boot only brings up the service daemon after Android boot; it does not independently prove an app's lifecycle ownership. Physical reboot remains a separate owner-approved qualification.
- Do not add Kubernetes, Nomad, PM2 or a competing health/restart scheduler. Scoped app health policy belongs to PocketHost's registry, runit owns process supervision.

## S1 implementation boundary

The previously installed adapter `TermuxServiceAdmin` gave a discovered `pockethost-*` unit the option to register simply because its name matched. This is a weak ownership shortcut.

The first S1 increment changes that contract:

1. Discovery is read-only for **all unenrolled units**, regardless of prefix.
2. HTTP users cannot register an arbitrary observed unit by giving its name.
3. **Only a trusted in-process PocketHost service provisioner**, after creating its own unit and before operating on it, can invoke `registerProvisioned(name, {target, runSha256})`. This verifies an exact canonical service directory, safe ownership/mode, executable non-symlink `run` script and expected script hash, and atomically records the target. It deliberately accepts safe unit names independent of the legacy `pockethost-` prefix.
4. `NodeRunitHost` uses this trusted path only **after** creating its own runit script, private project state and unit marker. This is not adoption of an observed service.
5. Every later lifecycle/log/autostart operation requires a matching registered canonical target. System SSH, Local Agent, PocketHost panel/watch and any unregistered/external unit remain protected; no action is issued to them.
6. Existing registrations are read for backward compatibility under their previous exact-target checks; do not silently promote any newly observed names.

**This is a foundation, not full S1 acceptance.** Still needed: a safe owner-visible workflow for creating/enrolling arbitrary app services (not blind adoption), immutable service identity and drift recovery, lifecycle and negative tests, status UX, and stage-level A8 owner acceptance. No tests run for this interim implementation per the approved fast-flow convention.

## Invariants for next S1 slice

- No browser or untrusted caller may select a process PID, arbitrary executable, unvalidated service script or foreign directory and call it owned.
- Provisioner evidence comes from code that actually created the service; names, prefixes, `sv status` and occupied ports are insufficient.
- ServiceRegistry vs. ProjectRegistry stay separate; do not couple generic runit enrollment to a particular hosted project.
- Filesystem identity and service script integrity need fail-closed checks at the action boundary, and negative tests at stage closure.
- Never transfer SSH, Local Agent or other external service ownership without separate explicit independently attested approval.
- No physical reboot, new background worker, WAN exposure or package changes without explicit owner consent.

Progress is tracked in [the MVP execution plan](MVP_EXECUTION_PLAN.md), starting from S1.
