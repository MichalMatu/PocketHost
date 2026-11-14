---
status: accepted
owner: host
last_reviewed: 2026-11-14
purpose: Minimal module boundary
---

# Host module

Only src/modules/host may perform filesystem/process/runit/IPC operations. Verify ownership, path, PID/start ticks/cwd and rollback; foreign services remain read-only.
