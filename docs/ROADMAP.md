---
status: active
owner: core
last_reviewed: 2026-11-22
purpose: Product sequence, not duplicate release history or QA diary
---

# PocketHost roadmap

For the last **device-attested deployment**, use the [21 November checkpoint](checkpoints/2026-11-21-pocket-host-mvp-handoff.md) plus [current handoff](HANDOFF_NEXT_CHAT.md). Source separation and newer evidence summary: [22 November checkpoint](checkpoints/2026-11-22-source-modules-documentation-checkpoint.md). Acceptance state: [MVP tracker](MVP_EXECUTION_PLAN.md).

1. **Private-LAN Basic on A8:** owned panel and monitoring, independent Local Agent, dedicated SSH, Mosquitto loopback and manual health checks are working in their documented scopes. Reboot durability and latest-version full browser sign-off are open.
2. **Independent Hosting Basic:** Static and trusted Node lifecycle have device-verified paths. Reuse existing ZIP/folder/GitHub imports; the active-ZIP API export -> isolated reimport/HTTP comparison is **already PASS**; finish **browser ZIP upload** on a new disposable site, then one generic independent-project lifecycle.
3. **Recovery:** keep distinct rollback versions versus encrypted backups. Qualify persistent uploads/database state and a separate staging restore without touching user sites. Off-device Restic remains [deferred](P1_OFF_DEVICE_RESTIC_PLAN.md).
4. **Shared Cloudflare Tunnel:** preserve the existing one Pi Zero connector and origin, then — after choosing a safe A8 app — prepare validated hostname-based ingress for the same named tunnel. No second tunnel or public PocketHost admin route by default. [Design only](CLOUDFLARE_SHARED_TUNNEL_MVP.md).
5. **Autostart / Services:** physically verify Android boot restoration only in an approved reboot window; finish generic S1–S4 worker acceptance, readbacks and negative paths.
6. **Production gates:** comprehensive latest-SHA quality/physical acceptance, public-app TLS/auth policy, credential custody, off-device recovery and genuine isolation for untrusted sources. Optional Companion/Shizuku and other runtimes remain deferred.
7. **Future real application migration:** `photomap.pl` is the intended first complete **independent** hosted project **only after** the generic project, recovery and safe domain flow is accepted. No migration now.

**Delivery:** A8 Local Agent only; code → guarded deploy → readback, with **separate exact-SHA permission for any tests**. No schedulers, GitHub Actions, Codex/Work, automatic retries, unapproved reboot/public exposure or data export. [Rules](../AGENTS.md).
