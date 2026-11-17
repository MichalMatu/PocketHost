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
5. **Quality/stabilization — ACTIVE:** scoped encrypted Node Restic backup → isolated staging restore passed on A8 (not off-device). Browser backup mutations remain feature-disabled. Finish exact-current-SHA QA only with fresh scope approval; retain code budgets, module boundaries, fixture repair and isolation warning.
6. **Post-MVP:** proper process isolation before untrusted hosting, domains/HTTPS, reliable installer, optional Android Companion/Shizuku.

Only verified A8 Local Agent performs code → guarded DEV deploy → readback, with independently approved QA. Never add a scheduler, Actions, Mac/S22 execution or automatic retry.
