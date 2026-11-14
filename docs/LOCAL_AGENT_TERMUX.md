---
status: active
owner: core
last_reviewed: 2026-11-14
purpose: Exclusive host executor and trusted-task contract
---

# Samsung Termux Local Agent

Only the verified Samsung Termux Local Agent runs PocketHost builds, guarded panel updates, verification and owner-authorized tests. GitHub Connector transports source and tasks. Never Mac, Linux sandbox, Actions, Codex or Work.

Default: **one task for code → deploy → read-only verify**, with **no tests**. The owner must explicitly say it is time for tests before the agent may pass `--tests` to FAST FLOW or run any format, lint, typecheck, QA, smoke or documentation checks.

Use fresh private host/installation evidence, the existing clean QA checkout, cached dependencies and a single bounded task. Terminal receipt with exact live SHA is mandatory; do not duplicate pending tasks or retry automatically.

Only the positively owned PocketHost DEV panel may use guarded runit refresh/rollback after PID/start ticks/cwd/source/foreign-service verification. Protect all unrelated services and keep Android loopback/private LAN.
