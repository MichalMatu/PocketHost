---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Canonical near-term milestones
---

# PocketHost roadmap

**Basic:** official-Termux Hosting; **Pro:** optional Android-app capabilities, frozen. Static H2 and Node remain independent.

1. P0 — finish one-task FAST FLOW: targeted QA, owner-only refresh/rollback and exact-SHA terminal result.
2. M2–M3 — disposable owned Node.js project: GitHub/files import → dependency review → build → runit/readiness → update/rollback.
3. M4 — Hosting Cloudflare/domains/HTTPS, SSH, per-site **HTTP** analytics, files/terminal and backup/restore.
4. M5 — multi-component projects, storage/secrets and coordinated recovery.
5. M6–M7 — explicitly approved migration (Local Agent last), further runtimes and security/API. Unified APK deferred.

Keep ModuleRegistry, ServiceRegistry and ProjectRegistry distinct. Never adopt discovered services. G2/G3 remain separate from DEV acceptance.
