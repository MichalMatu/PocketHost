---
status: in-progress
owner: core
last_reviewed: 2026-11-06
purpose: Track exact P3 MVP candidate integration, real Termux QA and release blockers
---

# PocketHost — P3 single-site MVP integration candidate

## Exact source and scope

- Baseline: `main` `8378663725f10beacf9c527f194e7f568170284d` (two documentation commits beyond the feature ancestry).
- Root Gate 1 verified branch: `93cba36b822d4e097fe070fcb24a9cf325df33cd`.
- P3 implementation: `46b07cd925677f3a1b5a8abe1669ab22dc669e3b`.
- Base UI interaction test branch: `3563512081a785838c71f5ab45e0a2039106e1bf`.
- Combined candidate: `sprint/p3-mvp-integration-20261105` starting at `99fa9a3bc0ea42b0c41d81b2a66610fe31eb3a7b`.
- The root and admin package locks are committed in the candidate. The admin lock is restored from a real Termux-native `npm install --package-lock-only` result.

The candidate adds a disabled-by-default single test site using loopback `127.0.0.1:18787`, stable own-process verification, two built-in static documents, bounded logs, explicit create/start/stop, version switching and rollback. There is no arbitrary upload, process adoption, external ingress, autostart or production authentication. It also retains the original 32 demo routes and adds an isolated `/owned-site` page.

During source integration, the process-start-ticks validation regex and log-line splitting were corrected, and the DEV mutation API rejects transfer-encoded bodies. Regression tests were extended. These candidate changes **do not constitute a hardware PASS**.

## Accepted predecessor evidence

- `pockethost-root-gate1-published-native-20261105-v1`: exact `93cba36b`; clean native `npm ci`, full root `npm run check`, 31/31 tests, Markdownlint, Prettier, ESLint and TypeScript PASS; clean checkout. This supersedes the earlier historical Gate 1 HOLD.
- `pockethost-appearance-ui-interaction-native-20261105-v1`: exact `3563512`; jsdom menu interactions, app lint and Vite build PASS. This is a component-level pass, **not** a current physical Chrome E2E pass.
- Original accepted P2 preview remains manually launched on `127.0.0.1:8787`, with Base UI crash fixed and owner-confirmed.
- Earlier `pockethost-p3-owned-site-lab-native-20261105-v1` and `v2` **failed before P3 tests** owing to branch drift and a missing test worktree; they must not be counted as passes.

## New physical Termux preflight

The private host receipt `pockethost-p3-integration-preflight-20261105-v1` finished `done / exit 0`: base checkout clean, Git `2.55.0`, Node `26.4.0`, npm `11.19.0`, Python `3.14.6`. The root Gate 1 worktree at `93cba36b` is clean. The previous UI worktree contains a locally updated admin lock; this was not reset or changed. The earlier P3 test worktree is absent. Port 8787 accepts connections; port 18787 did not accept a connection at preflight. None of these observations is an ongoing service-liveness guarantee.

The new exact-source isolated test request is `pockethost-p3-mvp-integration-native-gates-20261105-v1`. Its terminal result must be read before declaring integrated native quality. The task is restricted to a separate Git worktree and ephemeral fixture processes, not the live preview or external services.

## Release blocking gates

1. Full Termux `npm ci` for both root and admin packages, root Gate 0/1, admin ESLint, TypeScript/Vite build, actual jsdom appearance interactions, P3 own-site lifecycle tests and negative cases on a **single pinned candidate SHA**.
2. Recheck process ownership under PID reuse, port collision, startup failure, concurrent requests, malformed input, forged Host/Origin, missing intent header and unexpected payloads. Do not enable P3 actions while any case is unverified.
3. Preserve all main-only documentation commits during final branch integration and rerun gates on the resulting exact head; do not silently force push or discard existing history.
4. Only after independent native gates pass, run a separately guarded actual-device demo: create, start, HTTP GET/HEAD and Chrome render at `127.0.0.1:18787`, switch to v2, roll back to v1, inspect logs, stop, and confirm external service states unchanged.
5. Document terminal receipts and rollback, then merge to `main` if every mandatory gate is green. Until then this is **candidate / HOLD**, not an accepted hosting MVP.

## Safe release boundary

Do not restart or replace the accepted port-8787 preview to satisfy tests prematurely. Never modify IleStoi.pl, Local Agent, sshd, Cloudflared, Mosquitto or other observed Termux services. Keep the feature flag off by default and never publish the DEV control plane to WAN.

## Przerwanie i wznowienie — 2026-11-06

**Nowy stan zastępuje wcześniejsze oznaczenie bramki integracyjnej jako niewykonanej.**

- Kod i pliki zależności opublikowano w commicie `a76958a8a04af6c50e0746ba3bb6abd0f1992761` na `sprint/p3-mvp-integration-20261105`. `main` nadal wskazywał `8378663725f10beacf9c527f194e7f568170284d` podczas sprawdzenia 2026-11-06.
- Zadanie `pockethost-p3-mvp-release-quality-native-20261106-v1` na fizycznym Termuxie zakończyło się `done`, exit 0, `all_pass: true`, źródło dokładnie `a76958a`; wynik został opublikowany w prywatnej gałęzi `local-agent:agent-control`.
- Czysty odizolowany worktree: `npm ci` root i admin PASS; pełny `npm run check` PASS (42/42 testy, Markdownlint 55 plików / zero błędów, Prettier, ESLint, TypeScript); admin ESLint i Vite build PASS; Vitest interakcji wyglądu 6/6 PASS; testy lifecycle P3 9/9 PASS; końcowy Git status czysty.
- Pozostaje **HOLD tylko dla wydania MVP na telefonie**, ponieważ nie wykonano akceptacji stałego własnego serwera i renderowania w rzeczywistym Chrome. Nie mylić testów serwera na izolowanych losowych portach z akceptacją fizycznej witryny na porcie 18787.
- Podczas sprintu nie zmieniano aktywnego podglądu na porcie 8787, nie włączano domyślnie wyłączonego API P3 i nie scalano do `main`.

### Jedna następna czynność

Po wznowieniu sprawdź świeży HEAD i stan czystego worktree oraz portów 8787/18787. Następnie przez **wyłącznie GitHub Connector + właściwy Termux Local Agent** wykonaj osobny, ograniczony test sprzętowy P3: utworzenie własnej witryny, uruchomienie na `127.0.0.1:18787`, GET/HEAD, Chrome, publikacja wersji 2, rollback do wersji 1, logi, kontrolowany stop oraz porównanie wyłącznie dozwolonych stanów usług obcych. Nie restartuj panelu na 8787 i nie dotykaj innych usług. Jeżeli test lub bezpieczeństwo odmówią, pozostaw `main` nietknięty i oznacz wynik HOLD. Dopiero po akceptacji zaktualizuj dokumentację i scal do `main`.

## Latest P3 owner-view checkpoint — 2026-11-06

Historical candidate HOLD text above is superseded for live HTTP and visual access. P3 native ownership/lifecycle tests 9/9 passed, and the bounded physical server acceptance checked GET/HEAD, built-in v1/v2 sample publish, rollback to v1 and logs while preserving the other six services. The exact no-login LAN source `f89519a892eb8222940d25877a7ba04c004a6736` passed the Termux root Gate 1, admin build/lint and UI tests.

The owner supplied MacBook Chrome screenshots of the actual P3 `My test site` view (owned, running, v1) and of the separately hosted v1 page through the LAN gateway, and confirmed both worked without login. See [LAN checkpoint](2026-11-06-local-network-access.md). **Actual Mac browser write-button interactions and final `main` merge remain pending.** The demo server is intentionally kept running.

## Owner's MacBook GUI mutation acceptance and rollback semantics defect — 2026-11-06

The owner reports **Switch sample version and Rollback version work in real MacBook Chrome**, with content changing between built-in v1 and v2 in both directions. The supplied screenshot shows the owned site `running` / `Content v1` and bounded logs. This closes the previous *basic browser button interaction* uncertainty, not the later semantic-quality defect.

Reaudit of the exact live host adapter found that `rollback()` swaps `previousVersion` with `contentVersion` and therefore can alternate v1/v2 indefinitely. This is technically the current two-document demo behavior, but it is misleading as a production-quality rollback. The P3 correction must consume the previous-version pointer after one rollback; a second rollback must be rejected until an explicit new publish. The UI should disable the button when `canRollback=false`.

The code fix is treated as a **new candidate gate**, not silently shipped to the active owned service. Re-run native Termux Gate 1, P3 lifecycle/negative cases, admin lint/build and UI tests on the exact published SHA; a controlled live upgrade and Mac browser acceptance are required before any merge to `main`.
