---
status: accepted
owner: ui
last_reviewed: 2026-11-05
purpose: Record desktop-first reusable dashboard and CMS deferral
---

# ADR-0005: Desktop-first admin shell and pinch zoom

## Context

The owner provided a ShadcnStore-like dashboard screenshot, wants existing proven UI structure instead of rebuilding navigation, charts, tables and settings, and explicitly chooses desktop-first with pinch zoom on Android.

## Decision

- Preferred candidate: MIT-licensed [ShadcnStore dashboard Vite source](https://github.com/shadcnstore/shadcn-dashboard-landing-template) with React, TypeScript and Tailwind. For the **first version copy the complete Vite template, including every existing route, page, component and asset**, even when not used by PocketHost yet; adapt the features only in later sprints, after on-device Termux build/tests through Local Agent host commands.
- Version 2.0 of the candidate uses **Base UI/base-nova**; do not silently mix with the earlier maia/Radix proposal. Pin the component family, versions, theme tokens and license notice.
- One React GUI: desktop-first sidebar, cards, tables, charts and settings; on Android retain browser-native pinch and pan, a usable desktop canvas, and reachable interactions. Avoid a second mobile implementation.
- No general-purpose CMS in PocketHost MVP. A CMS manages website content, whereas PocketHost controls Termux hosting, processes, sites and packages. Optional independent per-site CMS can be evaluated later.
- Termux/Local Agent controls and safety remain unchanged; no automatic launch or modifications to IleStoi.pl.

## Quality qualification

Check exact upstream revision, dependency scope/license, design-token/style compliance, real Termux installation/build, desktop interactions and Android portrait/landscape pinch zoom. Do not claim browser screenshot/interaction PASS without real Termux/Android evidence. No source application code is added in this ADR.
