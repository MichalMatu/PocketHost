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
3. **Hosting — P0 DEVICE FLOW PASS; UI SIGN-OFF OPEN:** Static Create/Publish/Start and v2 HTTP → rollback passed on A8. Authenticated trusted Node Create/Stage/Deploy/HTTP/Logs/Update/Stop/Start/Rollback passed. Browser visual acceptance, generic/untrusted source isolation and public access remain open.
4. **Platform — DEFERRED:** LAN/Boot policy, SSH/GitHub authentication and physical reboot only with separate consent.
5. **Quality/stabilization P1 — ACTIVE:** live `fbb7c93...` on A8 (guarded deploy PASS, new log-deep-link regression tests written but **not run**). Previous three exact-SHA P1 scoped UI/API QA runs PASS (`263d64b`, `5cd0d80`, `e966f74`). New unverified log target now fails closed rather than opening different owned logs. Full repository QA, Hosting P0 functional sign-off and physical reboot remain OPEN. Browser backup mutations disabled. **DEFERRED BACKLOG:** [off-device encrypted Restic copy and independent recovery](P1_OFF_DEVICE_RESTIC_PLAN.md); no transfer or restore without a new owner decision.
6. **Post-MVP:** proper process isolation before untrusted hosting, domains/HTTPS, reliable installer, optional Android Companion/Shizuku.

Only verified A8 Local Agent performs code → guarded DEV deploy → readback, with independently approved QA. Never add a scheduler, Actions, Mac/S22 execution or automatic retry.
