---
status: design-only
last_reviewed: 2026-11-21
purpose: Prepare the existing Pi Zero Cloudflare connector for future independent A8 applications without a second tunnel
---

# Cloudflare shared-tunnel MVP: Pi Zero connector, PocketHost origins

## Observed, not assumed

Verified through separate Pi Zero 2 W and Galaxy A8 Local Agent read-only results on 2026-11-20; detailed task IDs and timestamps are in [current handoff](HANDOFF_NEXT_CHAT.md):

- Pi Zero `192.168.0.23` runs the **only active connector**, a named locally managed `cloudflared` tunnel under systemd. Effective configuration is `/etc/cloudflared/config.yml`, with keys `tunnel`, `credentials-file`, `url`, and **no ingress rules**.
- Existing Pi origin is **`http://127.0.0.1:8000` (Pi local)**. It was reachable during read-only inspection; its public hostname, DNS state, application identity and security requirements have **not been verified**.
- Pi can reach A8 `192.168.0.16` on ports `18878` and `8022` on the later successful read-only check. These ports are management interfaces, **not public application ingress candidates**.
- A8 `cloudflared` 2026.11.1 is installed but its package service is stopped, without local tunnel credentials. **That is compatible with the shared Pi connector topology**, not a reason to create another named tunnel.
- Cloudflare edge status, DNS mapping and end-to-end HTTPS for any future app are **not yet accepted**.

## Chosen MVP topology

```text
Public hostname of an independently deployed application
    -> Cloudflare DNS route -> existing named tunnel
    -> cloudflared on Pi Zero
    -> private LAN HTTP origin on A8, owned by PocketHost

Existing Pi service
    -> same named tunnel
    -> Pi origin http://127.0.0.1:8000
```

**Do not copy tunnel credentials or config to A8.** Another connector with the same credentials would be a replica, not another tunnel, and its `127.0.0.1` would point to A8 rather than Pi. Do not switch off/restart Pi's connector merely to stage this plan.

## Future ingress design — illustrative, do NOT apply

The intended smallest compatible change keeps the existing Pi origin as the final catch-all until its current public DNS hostnames have been inventoried. This avoids unintentionally changing old traffic during first rollout.

```yaml
tunnel: <EXISTING_TUNNEL_UUID>
credentials-file: <EXISTING_PI_CREDENTIALS_PATH>
ingress:
  - hostname: <NEW_PUBLIC_APP_HOSTNAME>
    service: http://192.168.0.16:<OWNED_APP_PRIVATE_PORT>
  - service: http://127.0.0.1:8000
```

This is **a template, not valid deployment config**. The final catch-all is intentionally the existing Pi origin rather than `http_status:404` while existing hostnames are not known. Once all hostnames are inventoried and explicitly mapped, a `404` catch-all is preferable. Use the exact same tunnel UUID; create a DNS route **only for the newly approved hostname** and ensure it does not collide with an existing DNS record. Cloudflare's documented `cloudflared tunnel ingress validate` and `cloudflared tunnel ingress rule` can check a separate candidate config before any restart.

## Gates before ever applying a public route

1. **Choose an independent PocketHost-owned application** and verify that it is reachable from Pi over the LAN on a dedicated port. Do **not** use the PocketHost DEV admin panel `192.168.0.16:18878`, SSH `8022`, or anonymous loopback MQTT `1883`.
2. Record the current Pi tunnel UUID, effective config hash, known DNS routes and the owner of the old `127.0.0.1:8000` application **without exporting credentials**. Preserve the full existing config and its permissions in a private rollback copy on Pi.
3. Prepare a separate candidate config. Offline-validate exact host matching, precedence, fallback, and origin connectivity. Do not reload Pi while validation is incomplete.
4. Confirm public application authentication/security, DNS hostname, TLS behavior, environment variables, persistent data, backups and rollback. Only then authorize the specific ingress/DNS edit.
5. Perform a bounded one-time cutover with old-origin and new-origin readback, and rollback immediately if prior traffic fails. Never assume PID/systemd `active` implies public application availability.

## Relation to photomap.pl

`photomap.pl` is **a future first complete independent hosting migration, not a current tunnel or deployment target**. Before changing any `photomap.pl` DNS, verify its real application stack and database/storage needs, deploy an independent copy into PocketHost, confirm uploads, background jobs (if any), persistent storage, backup/restore, logs, health and rollback on a non-production address. Then separately approve domain/TLS migration. Until that point, the live site and its infrastructure remain untouched.

## Current handoff boundary

Autostart scripts and current-session service states have since been inspected; **real post-reboot recovery remains open**. This design is still **not applied**. Next Cloudflare change is gated on identifying a dedicated independent A8 application, verifying the Pi tunnel's current public hostname/DNS and planning a safe one-hostname ingress/DNS modification with rollback. No reboot, second connector, public admin exposure or new scheduler.

See [21 November A8 checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) and [current handoff](HANDOFF_NEXT_CHAT.md) for current state rather than treating this design document as the project backlog.
