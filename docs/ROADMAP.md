---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Canonical near-term milestones
---

# PocketHost roadmap

**Basic:** official-Termux Hosting; **Pro:** optional Android-app capabilities, frozen. Static H2 and Node remain independent.

0. **P0 — A8 cold bootstrap completed 14 November:** exact panel SHA `1234603ed7c356cb6c05f57aacfcf260e79e4f5b`, owner/PID and loopback HTTP 200 confirmed. Runit + boot hook configured; reboot autostart remains unverified. S22 unchanged. [Handoff](HANDOFF_NEXT_CHAT.md).
1. P0 — qualify one-task FAST FLOW **on the installed A8 panel**: owner-only refresh/rollback and exact-SHA terminal result; focused QA is opt-in on owner instruction. The panel and Local Agent remain independently supervised.
2. M2–M3 — disposable owned Node.js project: GitHub/files import → dependency review → build → runit/readiness → update/rollback.
3. M4 — Hosting Cloudflare/domains/HTTPS, SSH, per-site **HTTP** analytics, files/terminal and backup/restore.
4. M5 — multi-component projects, storage/secrets and coordinated recovery.
5. After functional Hosting — versioned bundle and one-command installer for official Termux; no required Android helper APK.
6. Physical device acceptance — Samsung end-to-end project, failures, rollback, recovery and isolation. G2/G3 separate.
7. M6–M7 (later) — explicitly approved migration (Local Agent last), further runtimes and security/API. Unified APK deferred.

PocketHost is the coordinator of installed/enrolled service lifecycle, autostart, health, logs and recovery; official runit supervises processes. SSH/Git are managed host capabilities, while existing SSH and Local Agent remain protected until separately attested enrollment. Keep ModuleRegistry, ServiceRegistry and ProjectRegistry distinct. Never silently adopt discovered services. G2/G3 remain separate from DEV acceptance.
