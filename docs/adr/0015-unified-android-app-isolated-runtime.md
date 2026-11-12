---
status: superseded-by-adr-0017
owner: core
last_reviewed: 2026-11-12
purpose: Historical isolated custom-prefix APK proposal; no longer an active product plan
---

# ADR-0015 — Retired isolated APK runtime proposal

**SUPERSEDED:** [ADR-0017 Termux-first integration](0017-termux-first-single-app-integration.md)
is the only current one-app architecture decision.

This earlier proposal tested a separately identified Android APK and
a custom Termux-compatible runtime. That direction would require its
own package-prefix bootstrap and package maintenance and is **not**
the owner's requested reuse-first architecture. No S1 standalone
runtime development is authorized by this document.

Keep the original discussion in Git history at
[6b6557c](https://github.com/MichalMatu/PocketHost/commit/6b6557cbdcfbc655752dbf3b26cd5e721308008b).
The active Termux installation, host code and services are unchanged.
