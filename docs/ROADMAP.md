---
status: active
owner: core
last_reviewed: 2026-11-17
purpose: Development direction, not a duplicate stage tracker
---

# PocketHost roadmap

**Canonical status:** [MVP execution tracker](MVP_EXECUTION_PLAN.md).

1. **A8 baseline — implemented, partially qualified:** private LAN Termux/runit panel; independently protected Local Agent, observability and process ownership. No public-production claim.
2. **Services — READY_FOR_ACCEPTANCE:** S1–S4 fixed-template worker lifecycle physically exercised once; custom scripts, reboot/Boot and general health acceptance open. Implementation frozen.
3. **Hosting — ACTIVE:** Static Create → Publish → Start → LAN render/HTTP check accepted by owner. Next static update/rollback and trusted Node source → build → deploy → readiness/logs → rollback.
4. **Platform — DEFERRED:** LAN/Boot policy, SSH/GitHub authentication and physical reboot only with separate consent.
5. **Quality/stabilization — ACTIVE:** exact-SHA QA, bounded files/modules, stale fixtures, UI consistency, isolation warning and backup/restore qualification.
6. **Post-MVP:** proper process isolation before untrusted hosting, domains/HTTPS, reliable installer, optional Android Companion/Shizuku.

Only verified A8 Local Agent performs code → guarded DEV deploy → readback, with independently approved QA. Never add a scheduler, Actions, Mac/S22 execution or automatic retry.
