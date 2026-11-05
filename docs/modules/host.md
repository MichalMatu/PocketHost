---
status: accepted
owner: host
last_reviewed: 2026-11-05
purpose: Define the exclusive Termux host adapter contract
---

# Host Module

## Responsibility

The only module that may interact with operating system processes, Termux tools and host filesystem APIs. It exposes narrow, typed capabilities to feature modules through application ports.

## P1 implementation: read-only fixed probes

`src/modules/host/host-snapshot.ts` implements a typed, sanitized snapshot. It probes only the explicitly registered Termux `runit` service names `wreckscanner`, `cloudflared`, `sshd`, `mosquitto`, and `ilestoi-healthwatch`. Each service is **externally owned**, and only `running`, `stopped` or `unknown` status is returned — never raw process output, PIDs, arguments, filesystem data or credentials. The adapter invokes the fixed `sv status` binary without a shell with a strict timeout and small output cap. Unknown service IDs are rejected before execution.

The **development-only** Vite middleware `GET /api/v1/host/snapshot` is constrained to `127.0.0.1:8787`, blocks cross-origin requests, exposes no CORS headers and implements no write methods. The new `/host` page reads the snapshot using existing shadcn cards and badges while all 32 upstream demo routes remain intact. This API is not a production authentication design: do not expose it publicly or ship it in a production release. Future application-server packaging requires its own explicit auth/capabilities ADR.

## Initial permissions

Read-only, allowlisted inventory probes with per-call timeout, bounded output and redaction. Explicitly represent unavailable tools and permission errors. No fallback to unrestricted shell.

## Forbidden

No arbitrary command strings, modification of existing service configuration, package installs, process kills or scanning user files without explicit future approval.

## Quality

Test allowlist rejection, timeout and error paths. No shell execution can occur in UI or other modules.
