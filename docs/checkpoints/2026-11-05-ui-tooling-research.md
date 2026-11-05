---
status: accepted
owner: core
last_reviewed: 2026-11-05
purpose: Record source inspection results and unresolved Termux UI tooling verification
---

# Tooling Research Checkpoint — 2026-11-05

## Verified in source repositories

- The existing Termux Local Agent host-command lane operates independently of optional project binding; host/installation identity is still needed for exact transport routing.
- [OpenVisio](https://github.com/syntaxPriest/openvisio-oss) provides graph indexing, CLI and MCP. Its npm core declares `lmdb`; native Termux support is **unverified**.
- [shadcn/ui](https://github.com/shadcn-ui/ui) supports preset `maia`, reusable React components and Vite setup.
- [@shadcn/lint](https://github.com/shadcn-ui/lint) defines real JSX styling contract rules; plain CSS and real rendered appearance need other checks.
- [Termux:GUI](https://github.com/termux/termux-gui) supports WebView and native widgets via separate Android plugin; initial PocketHost PWA needs no such dependency.

## Decision recorded

Selected proposed web UI tooling and strict design-token rules in [DESIGN_SYSTEM](../DESIGN_SYSTEM.md), and researched additional candidate gates in [TOOLING_EVALUATION](../TOOLING_EVALUATION.md). The owner requires all future code, package installations, tests and compilation to happen **only on Termux through the Local Agent**. No project binding required.

## Not verified

This was **GitHub source/documentation inspection only**. No Agent task was dispatched, no phone package was installed, no native build/visual screenshot was run, and there is no fresh mobile PASS for the new tools. Existing IleStoi.pl and Local Agent installation were not modified.

## Next step

Use the verified private host-command channel for a harmless, bounded native toolchain preflight, confirm isolated PocketHost checkout and dependency-free Gate 0, then qualify/lock proposed packages one group at a time. No autostart in DEV.
